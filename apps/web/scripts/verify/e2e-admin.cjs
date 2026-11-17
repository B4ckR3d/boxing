const { chromium } = require("playwright");

const BASE = "http://localhost:3015";
const EMAIL = "superadmin@boxing.local";
const PW = process.env.DEMO_USER_PASSWORD;

(async () => {
  const browser = await chromium.launch({
    executablePath: "/home/irhan/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome",
  });

  // ---- 0. Unauthenticated guard check ----
  const anon = await browser.newContext();
  const anonPage = await anon.newPage();
  await anonPage.goto(`${BASE}/admin/ticketing`, { waitUntil: "domcontentloaded" });
  console.log("GUARD: /admin/ticketing as anon ->", new URL(anonPage.url()).pathname);
  await anon.close();

  // ---- 1. Login ----
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR:", e.message));

  await page.goto(`${BASE}/admin/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[name="email"]', EMAIL);
  await page.fill('input[name="password"]', PW);
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/admin`, { timeout: 20000 });
  console.log("LOGIN: reached", new URL(page.url()).pathname);

  // ---- 2. Ticketing admin list ----
  await page.goto(`${BASE}/admin/ticketing`, { waitUntil: "networkidle" });
  await page.waitForSelector("text=Ticketing", { timeout: 15000 });
  const cards = page.locator("article");
  console.log("ORDERS LISTED:", await cards.count());

  // ---- 3. Confirm the E2E order ----
  const target = process.env.ORDER_NO || "TFN-MWDOX4XQ-FJYTL88";
  const card = page.locator("article", { hasText: target }).first();
  const before = (await card.innerText()).replace(/\s+/g, " ");
  console.log("BEFORE CONFIRM:", before.slice(0, 140));
  await card.getByRole("button", { name: "Konfirmasi" }).click();
  await page.waitForTimeout(2500);
  await page.reload({ waitUntil: "networkidle" });
  const after = (await page.locator("article", { hasText: target }).first().innerText()).replace(/\s+/g, " ");
  console.log("AFTER CONFIRM:", after.slice(0, 140));

  // ---- 4. Reject the curl-debug order ----
  const rejectTarget = "TFN-MWDORZDQ-PGK4VO4";
  const rcard = page.locator("article", { hasText: rejectTarget }).first();
  if (await rcard.count()) {
    console.log("BEFORE REJECT:", (await rcard.innerText()).replace(/\s+/g, " ").slice(0, 140));
    await rcard.locator('input[name="reason"]').fill("E2E reject check");
    await rcard.getByRole("button", { name: "Tolak" }).click();
    await page.waitForTimeout(2500);
    await page.reload({ waitUntil: "networkidle" });
    console.log("AFTER REJECT:", (await page.locator("article", { hasText: rejectTarget }).first().innerText()).replace(/\s+/g, " ").slice(0, 140));
  } else {
    console.log("REJECT: order not listed");
  }

  // ---- 5. Public tickets page consistency ----
  await page.goto(`${BASE}/tickets`, { waitUntil: "networkidle" });
  const cats = (await page.locator("select[name=ticketTypeId] option").allInnerTexts()).map((s) => s.replace(/\s+/g, " "));
  console.log("PUBLIC CATEGORIES:", cats.join(" | "));

  await browser.close();
})();
