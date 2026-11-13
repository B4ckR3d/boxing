/**
 * Browser probe for the Pemkab crest + gold plaque treatment in the official-support block.
 *
 *   npm run build && npm run start -- -p 3015   # in another shell
 *   node scripts/verify/official-crest.cjs
 *
 * Asserts: crest actually decodes (not a broken image), it is not clipped, the plaque
 * frame/stamp use the gold token (not the leftover subtle/red borders), and no horizontal
 * document overflow appears in either theme at three breakpoints.
 */
const { chromium } = require("playwright");
const { existsSync, mkdirSync } = require("node:fs");

const BASE = process.env.BASE_URL || "http://localhost:3015";
const CHROME_BIN = process.env.CHROME_BIN || (existsSync("/usr/bin/google-chrome") ? "/usr/bin/google-chrome" : undefined);
const SHOT_DIR = process.env.SHOT_DIR || "/tmp/tfn-crest";
const PAGES = ["/", "/tickets"];
const VIEWPORTS = [
  ["mobile-390", { width: 390, height: 844 }],
  ["tablet-834", { width: 834, height: 1112 }],
  ["desktop-1440", { width: 1440, height: 900 }],
];

const rgb = (s) => s.replace(/\s+/g, " ").trim();

(async () => {
  mkdirSync(SHOT_DIR, { recursive: true });
  const browser = await chromium.launch(CHROME_BIN ? { executablePath: CHROME_BIN } : {});
  const results = [];

  for (const path of PAGES) {
    for (const [label, viewport] of VIEWPORTS) {
      const page = await browser.newPage({ viewport, deviceScaleFactor: 2 });
      await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });

      for (const theme of ["dark", "light"]) {
        if (theme === "light") {
          const toggle = page.getByRole("button", { name: /Toggle dark\/light mode/i });
          if (await toggle.count()) await toggle.first().click();
          await page.waitForTimeout(350);
        }

        const probe = await page.evaluate(() => {
          const h3 = [...document.querySelectorAll("h3")].find((el) =>
            /PEMERINTAH KABUPATEN TEMANGGUNG/i.test(el.textContent || ""),
          );
          if (!h3) return { found: false };

          const plaque = h3.closest("[class*='shadow-brutal-red']");
          const crest = plaque?.querySelector("img[src*='pemkab']") || null;
          const stamp = [...plaque.querySelectorAll("span")].find((s) => /resmi|endorsed/i.test(s.textContent || ""));

          const b = (el) => (el ? el.getBoundingClientRect() : null);
          const plaqueRect = b(plaque);
          const crestRect = b(crest);
          const cs = (el, prop) => (el ? getComputedStyle(el).getPropertyValue(prop) : null);

          // Tailwind v4 emits color-mix/oklab for opacity modifiers; canvas normalises it to sRGB.
          const toRGBA = (cssColor) => {
            try {
              const c = document.createElement("canvas");
              c.width = c.height = 1;
              const ctx = c.getContext("2d", { willReadFrequently: true });
              ctx.clearRect(0, 0, 1, 1);
              ctx.fillStyle = "#000000";
              ctx.fillStyle = cssColor;
              ctx.fillRect(0, 0, 1, 1);
              const d = ctx.getImageData(0, 0, 1, 1).data;
              return [d[0], d[1], d[2], d[3]];
            } catch {
              return null;
            }
          };

          const isLight = document.documentElement.classList.contains("light");

          return {
            found: true,
            theme: document.documentElement.className || "(none)",
            isLight,
            crest: crest
              ? {
                  src: crest.currentSrc || crest.src,
                  natural: [crest.naturalWidth, crest.naturalHeight],
                  rendered: [Math.round(crestRect.width), Math.round(crestRect.height)],
                  complete: crest.complete,
                  objectFit: getComputedStyle(crest).objectFit,
                  // Next serves a srcset variant; the visible size is what matters, not the variant width
                  requestedSizes: crest.getAttribute("sizes") || null,
                }
              : null,
            plaque: plaqueRect
              ? {
                  w: Math.round(plaqueRect.width),
                  h: Math.round(plaqueRect.height),
                  borderTopColor: cs(plaque, "border-top-color"),
                  borderTopWidth: cs(plaque, "border-top-width"),
                  borderRGBA: toRGBA(cs(plaque, "border-top-color")),
                  hasHairline: !!plaque.querySelector("[class*='inset-\\[5px\\]']"),
                  goldSpine: !!plaque.querySelector("[class*='w-\\[3px\\]']"),
                }
              : null,
            stamp: stamp
              ? {
                  text: stamp.textContent.trim(),
                  color: cs(stamp, "color"),
                  rgba: toRGBA(cs(stamp, "color")),
                  border: cs(stamp, "border-top-color"),
                }
              : null,
            crestClipped: crest
              ? crestRect.width < 1 ||
                crestRect.height < 1 ||
                crestRect.left < plaqueRect.left ||
                crestRect.right > plaqueRect.right ||
                crestRect.bottom > plaqueRect.bottom
              : true,
            textClipped: plaque ? plaque.scrollWidth > plaque.clientWidth + 2 : true,
            docOverflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
          };
        });

        if (probe.found && probe.plaque) {
          const shotName = `${SHOT_DIR}/${path === "/" ? "home" : "tickets"}-${label}-${theme}.png`;
          const plaque = await page
            .locator("h3", { hasText: /PEMERINTAH KABUPATEN TEMANGGUNG/i })
            .locator("xpath=ancestor::div[contains(@class,'shadow-brutal-red')][1]")
            .first();
          await plaque.screenshot({ path: shotName }).catch(() => {});
          probe.shot = shotName;
        }

        results.push({ path, viewport: label, theme, ...probe });
      }
      await page.close();
    }
  }

  await browser.close();

  const GOLD_RGB = { dark: [212, 160, 23], light: [138, 97, 0] };
  const nearGold = (rgba, expected) =>
    Array.isArray(rgba) &&
    rgba[3] > 50 &&
    Math.abs(rgba[0] - expected[0]) <= 14 &&
    Math.abs(rgba[1] - expected[1]) <= 14 &&
    Math.abs(rgba[2] - expected[2]) <= 14;

  const checks = results.map((r) => {
    const problems = [];
    const gold = GOLD_RGB[r.isLight ? "light" : "dark"];

    if (!r.found) problems.push("block not found");
    if (r.found) {
      if (!r.crest) problems.push("crest img missing");
      else {
        // Next serves a srcset variant (320w here); decoding at all + correct aspect is what matters.
        if (!r.crest.complete) problems.push("crest not complete");
        if (r.crest.natural[0] < 200 || r.crest.natural[1] < 300) problems.push(`crest decoded small: ${r.crest.natural.join("x")}`);
        const ratio = r.crest.natural[0] / r.crest.natural[1];
        if (Math.abs(ratio - 640 / 968) > 0.02) problems.push(`crest aspect off: ${ratio.toFixed(3)}`);
        if (r.crest.rendered[1] < 80) problems.push(`crest rendered tiny: ${r.crest.rendered.join("x")}`);
        if (r.crest.objectFit !== "contain") problems.push(`objectFit=${r.crest.objectFit}`);
      }
      if (r.crestClipped) problems.push("crest clipped by plaque");
      if (r.textClipped) problems.push("plaque content overflows");
      if (r.docOverflowX) problems.push("document overflows horizontally");
      if (!r.plaque.hasHairline) problems.push("gold hairline frame missing");
      if (!r.plaque.goldSpine) problems.push("gold spine missing");
      if (parseFloat(r.plaque.borderTopWidth || "0") < 1) problems.push("plaque has no border");
      if (!nearGold(r.plaque.borderRGBA, gold))
        problems.push(`border not gold: ${r.plaque.borderTopColor} → rgba(${(r.plaque.borderRGBA || []).join(",")})`);
      if (!r.stamp) problems.push("RESMI stamp missing");
      else if (!nearGold(r.stamp.rgba, gold)) problems.push(`stamp text not gold: ${r.stamp.color}`);
    }

    return {
      path: r.path,
      viewport: r.viewport,
      theme: r.isLight ? "light" : "dark",
      ok: problems.length === 0,
      problems,
      crest: r.crest ? `${r.crest.natural.join("x")} decoded → ${r.crest.rendered.join("x")} shown` : null,
      border: r.plaque ? r.plaque.borderTopColor : null,
    };
  });

  const failed = checks.filter((c) => !c.ok);
  console.log(JSON.stringify({ summary: { total: checks.length, passed: checks.length - failed.length, failed: failed.length }, failed, detail: results }, null, 2));
  process.exitCode = failed.length === 0 ? 0 : 1;
})();
