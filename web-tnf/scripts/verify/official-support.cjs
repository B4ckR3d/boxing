/**
 * Browser probe for the official-support / government backing block.
 * Measures layout invariants and clips a screenshot per breakpoint.
 *
 *   npm run start -p 3015   # in another shell (needs a production build)
 *   node scripts/verify/official-support.cjs
 */
const { chromium } = require("playwright");
const { existsSync } = require("node:fs");

const BASE = process.env.BASE_URL || "http://localhost:3015";
// Prefer a system Chrome; the bundled headless shell may not be downloaded on this host.
const CHROME_BIN = process.env.CHROME_BIN || (existsSync("/usr/bin/google-chrome") ? "/usr/bin/google-chrome" : undefined);
const PAGES = ["/", "/tickets", "/?lang=en"];
const VIEWPORTS = [
  ["mobile-390", { width: 390, height: 844 }],
  ["tablet-834", { width: 834, height: 1112 }],
  ["desktop-1440", { width: 1440, height: 900 }],
];

(async () => {
  const browser = await chromium.launch(CHROME_BIN ? { executablePath: CHROME_BIN } : {});
  const out = [];

  for (const path of PAGES) {
    for (const [label, viewport] of VIEWPORTS) {
      const page = await browser.newPage({ viewport, deviceScaleFactor: 2 });
      await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });

      const probe = await page.evaluate(() => {
        const h2 = document.getElementById("official-support-heading");
        const sec = h2 && h2.closest("section");
        if (!sec) return { found: false };

        const r = (el) => {
          const b = el.getBoundingClientRect();
          return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) };
        };
        const tiles = [...sec.querySelectorAll("ul > li")];
        const ticker = sec.querySelector(".tfn-ticker");
        const dl = sec.querySelector("dl");
        const plaque = sec.querySelector("h3")?.closest("[class*='relative'][class*='border']") || null;

        // Anything inside the block that overflows horizontally = broken layout.
        const overflowing = [...sec.querySelectorAll("*")]
          .filter((el) => el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 0)
          .slice(0, 6)
          .map((el) => ({
            tag: el.tagName.toLowerCase(),
            cls: (el.className || "").toString().slice(0, 60),
            scrollW: el.scrollWidth,
            clientW: el.clientWidth,
          }));

        return {
          found: true,
          docOverflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
          section: r(sec),
          h2Font: getComputedStyle(h2).fontSize,
          tiles: tiles.map((t) => ({
            h: Math.round(t.getBoundingClientRect().height),
            w: Math.round(t.getBoundingClientRect().width),
            title: t.querySelector("p")?.textContent?.trim(),
          })),
          tileHeightsUniform: [...new Set(tiles.map((t) => Math.round(t.getBoundingClientRect().height)))].length <= 1,
          ticker: ticker
            ? { anim: getComputedStyle(ticker).animationName, scrollW: ticker.scrollWidth, rect: r(ticker) }
            : null,
          ledgerRows: dl
            ? [...dl.querySelectorAll("tbody tr, div")].map((row) => ({
                label: row.querySelector("dt")?.textContent?.trim(),
                value: row.querySelector("dd")?.textContent?.trim(),
                h: Math.round(row.getBoundingClientRect().height),
              }))
            : null,
          plaque: plaque ? r(plaque) : null,
          overflowing,
        };
      });

      const shot = `/tmp/tfn-official-${path.replace(/[^a-z0-9]/gi, "_")}-${label}.png`;
      const section = page.locator("section:has(#official-support-heading)");
      if (await section.count()) {
        await section.first().screenshot({ path: shot });
      }

      out.push({ path, viewport: label, ...probe, shot });
      await page.close();
    }
  }

  await browser.close();
  console.log(JSON.stringify(out, null, 2));
})();
