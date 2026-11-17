const { chromium } = require("playwright");
const BASE = "http://localhost:3015";
const EXE = "/home/irhan/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome";

(async () => {
  const browser = await chromium.launch({ executablePath: EXE });
  const errs = [];
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errs.push(e.message));

  // 1. Public purchase through the UI
  await page.goto(`${BASE}/tickets`, { waitUntil: "networkidle" });
  await page.locator("button[aria-pressed]", { hasText: "TRIBUN BARAT" }).first().click();
  await page.click('button[aria-label="Tambah jumlah"]');
  await page.fill('input[name="customerName"]', "Rina Uji");
  await page.fill('input[name="customerEmail"]', "rina.final@example.com");
  await page.fill('input[name="customerPhone"]', "081399998888");
  await page.fill('input[name="reference"]', "TRX-FINAL-77");
  await page.click('button[type="submit"]');
  await page.waitForSelector("#receipt-title", { timeout: 20000 });
  const order = (await page.locator("dd.select-all").first().innerText()).trim();
  const token = (await page.locator("dd.select-all").nth(1).innerText()).trim();
  console.log("1. ORDER CREATED:", order,
    "| total:", (await page.locator("#receipt-total").innerText()).trim(),
    "| method:", (await page.locator("#receipt-method").innerText()).trim());

  // 2. Receipt → status deep link (server-rendered, no client fetch)
  await page.click("text=Cek status pesanan");
  await page.waitForSelector("article h2", { timeout: 20000 });
  console.log("2. DEEP LINK:", (await page.locator("article span").first().innerText()).trim(),
    "| method:", (await page.locator("article dl dd").first().innerText()).trim());

  // 3. Wrong token must not leak the order
  const wrong = await ctx.newPage();
  await wrong.goto(`${BASE}/tickets/status?order=${order}&token=salah-token`, { waitUntil: "domcontentloaded" });
  console.log("3. WRONG TOKEN:", (await wrong.locator('p[role="status"]').first().innerText()).trim(),
    "| article count:", await wrong.locator("article").count());
  await wrong.close();

  // 4. Admin rejects with a reason
  const admin = await ctx.newPage();
  await admin.goto(`${BASE}/admin/login`, { waitUntil: "domcontentloaded" });
  await admin.fill('input[name="email"]', "superadmin@boxing.local");
  await admin.fill('input[name="password"]', process.env.DEMO_USER_PASSWORD);
  await admin.click('button[type="submit"]');
  await admin.waitForURL(`${BASE}/admin`, { timeout: 25000 });
  await admin.goto(`${BASE}/admin/ticketing?status=pending`, { waitUntil: "networkidle" });
  const card = admin.locator("article", { hasText: order }).first();
  await card.getByRole("button", { name: "Tolak" }).click();
  await card.locator('input[name="reason"]').fill("Bukti transfer tidak cocok");
  await card.getByRole("button", { name: "Tolak", exact: true }).click();
  await admin.waitForTimeout(2500);
  await admin.goto(`${BASE}/admin/ticketing?status=rejected`, { waitUntil: "networkidle" });
  console.log("4. ADMIN REJECT:", (await admin.locator("article", { hasText: order }).first().innerText()).replace(/\s+/g, " ").slice(0, 70));
  await admin.screenshot({ path: "/tmp/shot-admin-final.png", fullPage: false });
  await admin.close();

  // 5. Buyer sees the rejection and quota is back
  const check = await ctx.newPage();
  await check.goto(`${BASE}/tickets/status?order=${order}&token=${token}`, { waitUntil: "domcontentloaded" });
  console.log("5. BUYER VIEW:", (await check.locator("article span").first().innerText()).trim());
  await check.screenshot({ path: "/tmp/shot-status-final.png", fullPage: false });
  await check.close();

  await page.goto(`${BASE}/tickets`, { waitUntil: "networkidle" });

  const badges = await page.locator("header .flex.items-center.gap-2").allInnerTexts();
  console.log("6. PUBLIC QUOTA AFTER REJECT:", badges.join(" / ").replace(/\s+/g, " "));

  console.log("JS ERRORS:", errs.length ? errs.join(" || ") : "(none)");
  await browser.close();
})();
