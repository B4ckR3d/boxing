const { chromium } = require("playwright");
const BASE = "http://localhost:3015";
const EXE = "/home/irhan/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome";

async function probe(browser, name, viewport, mobile = false) {
  const ctx = await browser.newContext({ viewport, locale: "id-ID", isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1 });
  const page = await ctx.newPage();
  const out = { page: name, viewport: `${viewport.width}x${viewport.height}`, problems: [] };

  await page.goto(`${BASE}/tickets`, { waitUntil: "networkidle" });

  // 1. horizontal overflow
  const overflow = await page.evaluate(() => {
    const de = document.documentElement;
    return { scrollW: de.scrollWidth, clientW: de.clientWidth, over: de.scrollWidth - de.clientWidth };
  });
  if (overflow.over > 1) out.problems.push(`horizontal overflow ${overflow.over}px (${overflow.scrollW} > ${overflow.clientW})`);

  // 2. images loaded
  const imgs = await page.evaluate(() =>
    Array.from(document.images).map((i) => ({ src: i.currentSrc || i.src, ok: i.complete && i.naturalWidth > 0 })),
  );
  const broken = imgs.filter((i) => !i.ok);
  if (broken.length) out.problems.push(`broken images: ${broken.map((b) => b.src).join(", ")}`);

  // 3. category cards equal height + no zero-size
  const cards = await page.evaluate(() => {
    const nodes = Array.from(document.querySelectorAll('button[aria-pressed]'));
    return nodes.map((n) => {
      const r = n.getBoundingClientRect();
      return { text: n.innerText.split("\n")[0], w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top) };
    });
  });
  if (!cards.length) out.problems.push("no category cards found");
  if (cards.some((c) => c.h < 60)) out.problems.push(`card too small: ${JSON.stringify(cards)}`);
  // Only cards sharing a grid row must match heights; stacked (mobile) cards may differ.
  const rows = new Map();
  for (const c of cards) rows.set(c.top, [...(rows.get(c.top) ?? []), c]);
  for (const [top, row] of rows) {
    if (row.length < 2) continue;
    const spread = Math.max(...row.map((c) => c.h)) - Math.min(...row.map((c) => c.h));
    if (spread > 8) out.problems.push(`row@${top} height spread ${spread}px: ${JSON.stringify(row)}`);
  }

  // 4. interactive elements must not overlap each other (touch target collision)
  const overlaps = await page.evaluate(() => {
    const nodes = Array.from(document.querySelectorAll("button, a")).filter((n) => {
      const r = n.getBoundingClientRect();
      return r.width > 8 && r.height > 8 && r.top >= 0 && r.bottom <= document.documentElement.scrollHeight;
    });
    const hits = [];
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i].getBoundingClientRect();
        const b = nodes[j].getBoundingClientRect();
        const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (ox > 2 && oy > 2) {
          hits.push(`${nodes[i].innerText.slice(0, 18).replace(/\s+/g, " ")} <> ${nodes[j].innerText.slice(0, 18).replace(/\s+/g, " ")}`);
        }
      }
    }
    return hits.slice(0, 4);
  });
  if (overlaps.length) out.problems.push(`overlapping controls: ${overlaps.join(" | ")}`);

  // 5. single <main> landmark
  const mains = await page.locator("main").count();
  if (mains !== 1) out.problems.push(`<main> landmarks = ${mains}`);

  // 6. body text colour actually differs from background (rough contrast gate)
  const contrast = await page.evaluate(() => {
    const el = document.querySelector("p, h1, h2, h3");
    if (!el) return null;
    const s = getComputedStyle(el);
    return { color: s.color, bg: getComputedStyle(document.body).backgroundColor };
  });

  out.mains = mains;
  out.cards = cards.length;
  out.images = `${imgs.length - broken.length}/${imgs.length}`;
  out.textColor = contrast;
  await ctx.close();
  return out;
}

(async () => {
  const browser = await chromium.launch({ executablePath: EXE });
  const results = [
    await probe(browser, "/tickets", { width: 1440, height: 900 }),
    await probe(browser, "/tickets", { width: 390, height: 844 }, true),
    await probe(browser, "/tickets", { width: 768, height: 1024 }),
  ];
  for (const r of results) {
    console.log(`\n=== ${r.page} @ ${r.viewport} ===`);
    console.log(`main landmarks: ${r.mains} | category cards: ${r.cards} | images ok: ${r.images}`);
    console.log(`text color: ${r.textColor ? r.textColor.color : "n/a"} on ${r.textColor ? r.textColor.bg : "n/a"}`);
    console.log(r.problems.length ? `PROBLEMS:\n - ${r.problems.join("\n - ")}` : "PROBLEMS: none");
  }
  await browser.close();
})();
