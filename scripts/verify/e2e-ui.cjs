const { chromium } = require("playwright");

const BASE = "http://localhost:3015";
const EXE = "/home/irhan/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome";

(async () => {
  const browser = await chromium.launch({ executablePath: EXE });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const failures = [];
  page.on("pageerror", (e) => failures.push(`pageerror: ${e.message}`));

  // ---- Public tickets page ----
  await page.goto(`${BASE}/tickets`, { waitUntil: "networkidle" });
  await page.screenshot({ path: "/tmp/shot-tickets.png", fullPage: false });

  console.log("H1:", (await page.locator("h1").first().innerText()).replace(/\s+/g, " "));
  const cards = page.locator("button[aria-pressed]");
  console.log("CATEGORY CARDS:", await cards.count());
  for (const t of await cards.allInnerTexts()) console.log("  -", t.replace(/\s+/g, " ").slice(0, 80));

  // nested <main> a11y regression check
  const mainCount = await page.locator("main").count();
  console.log("MAIN ELEMENTS:", mainCount, mainCount === 1 ? "(OK)" : "(NESTED MAIN — regression)");

  // Select VIP card (highest price) by text, bump qty with the stepper
  const vip = page.locator("button[aria-pressed]", { hasText: "VIP" }).first();
  await vip.click();
  await page.click('button[aria-label="Tambah jumlah"]');
  const total = await page.locator("form p.font-display").first().innerText().catch(() => "?");
  console.log("TOTAL AFTER +1:", total, "| qty input:", await page.inputValue('input[name="quantity"]'));

  await page.fill('input[name="customerName"]', "Budi Santoso");
  await page.fill('input[name="customerEmail"]', "budi.ui@example.com");
  await page.fill('input[name="customerPhone"]', "081211112222");
  await page.fill('input[name="reference"]', "TRX-UI-001");
  await page.click('button[type="submit"]');
  await page.waitForSelector("#receipt-title", { timeout: 15000 });

  const orderNo = await page.locator("dd.select-all").first().innerText();
  const token = await page.locator("dd.select-all").nth(1).innerText();
  console.log("RECEIPT:", orderNo, "token len", token.trim().length);
  await page.screenshot({ path: "/tmp/shot-receipt.png" });

  // ---- Deep-link status page ----
  await page.click('text=Cek status pesanan');
  await page.waitForSelector("article", { timeout: 15000 });
  const statusBadge = await page.locator("article span").first().innerText();
  console.log("STATUS PAGE BADGE:", statusBadge.trim());
  console.log("STATUS PAGE ORDER:", await page.locator("article h2").first().innerText());
  await page.screenshot({ path: "/tmp/shot-status.png" });

  // ---- Public page must NOT be reachable without login for admin ----
  const anon = await browser.newContext();
  const anonPage = await anon.newPage();
  await anonPage.goto(`${BASE}/admin/ticketing`, { waitUntil: "domcontentloaded" });
  console.log("ADMIN GUARD:", new URL(anonPage.url()).pathname);
  await anon.close();

  // ---- Admin panel ----
  const ctx = await browser.newContext();
  const admin = await ctx.newPage({ viewport: { width: 1360, height: 950 } });
  admin.on("pageerror", (e) => failures.push(`admin pageerror: ${e.message}`));
  await admin.goto(`${BASE}/admin/login`, { waitUntil: "domcontentloaded" });
  await admin.fill('input[name="email"]', "superadmin@boxing.local");
  await admin.fill('input[name="password"]', process.env.DEMO_USER_PASSWORD);
  await admin.click('button[type="submit"]');
  await admin.waitForURL(`${BASE}/admin`, { timeout: 20000 });

  await admin.goto(`${BASE}/admin/ticketing?status=pending`, { waitUntil: "networkidle" });
  await admin.screenshot({ path: "/tmp/shot-admin.png", fullPage: true });
  console.log("ADMIN H1:", (await admin.locator("h1").first().innerText()).replace(/\s+/g, " "));
  console.log("ADMIN STATS:", (await admin.locator("section[aria-label='Ringkasan ticketing'] div.bg-charcoal").allInnerTexts()).map((s) => s.replace(/\s+/g, " ")).join(" | "));
  console.log("PENDING CARDS:", await admin.locator("article").count());

  const card = admin.locator("article", { hasText: orderNo.trim() }).first();
  await card.getByRole("button", { name: "Konfirmasi" }).click();
  await admin.waitForTimeout(2500);
  await admin.goto(`${BASE}/admin/ticketing?status=confirmed`, { waitUntil: "networkidle" });
  const confirmedText = await admin.locator("article", { hasText: orderNo.trim() }).first().innerText().catch(() => "");
  console.log("CONFIRMED VIA UI:", confirmedText.replace(/\s+/g, " ").slice(0, 90));

  console.log("JS ERRORS:", failures.length ? failures.join(" || ") : "(none)");
  await browser.close();
})();
