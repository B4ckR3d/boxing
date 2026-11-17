const { chromium } = require("playwright");
const fs = require("fs");

const BASE = "http://localhost:3015";
const EXE = "/home/irhan/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome";
const PW = fs
  .readFileSync("/home/irhan/Projects/My-Projects/TFN/.env", "utf8")
  .split("\n")
  .find((l) => l.startsWith("DEMO_USER_PASSWORD="))
  .split("=")
  .slice(1)
  .join("=")
  .trim();

const log = (...a) => console.log(...a);

(async () => {
  const browser = await chromium.launch({ executablePath: EXE });
  const page = await browser.newPage({ viewport: { width: 1360, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push("console: " + m.text().slice(0, 200));
  });

  // --- login ---
  await page.goto(`${BASE}/admin/login`, { waitUntil: "networkidle" });
  await page.fill('input[type="email"], input[name="email"]', "superadmin@boxing.local");
  await page.fill('input[type="password"]', PW);
  const [resp] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/auth/login"), { timeout: 20000 }).catch(() => null),
    page.click('button[type="submit"]'),
  ]);
  if (resp) log("LOGIN API:", resp.status(), (await resp.text()).slice(0, 160));
  await page.waitForTimeout(2000);
  log("AFTER LOGIN URL:", page.url());
  if (page.url().includes("/admin/login")) {
    log("LOGIN BODY:", (await page.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 300));
    await page.screenshot({ path: "/tmp/shot-login-fail.png" });
    await browser.close();
    process.exit(1);
  }
  log("LOGIN OK ->", page.url());

  // --- sponsors page ---
  await page.goto(`${BASE}/admin/sponsors`, { waitUntil: "networkidle" });
  log("SPONSOR PAGE H1:", (await page.locator("h1").first().innerText()).replace(/\s+/g, " "));

  // --- open create modal ---
  await page.getByRole("button", { name: /TAMBAH SPONSOR/i }).click();
  await page.waitForTimeout(400);

  const form = page.locator("form").filter({ has: page.locator('input[type="number"]') }).first();
  const textInputs = form.locator('input[type="text"]');
  log("MODAL TEXT INPUTS:", await textInputs.count());

  await textInputs.nth(0).fill("Demo Sponsor Nusantara");
  await form.locator("select").selectOption("PLATINUM");
  await form.locator('input[type="number"]').fill("1");
  await textInputs.nth(1).fill("/images/sponsors/demo-sponsor.svg");
  await textInputs.nth(2).fill("https://example.com");
  const cb = form.locator('input[type="checkbox"]');
  if (!(await cb.isChecked())) await cb.check();
  await page.waitForTimeout(300);
  await page.screenshot({ path: "/tmp/shot-sponsor-form.png" });

  await form.locator('button[type="submit"]').click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: "/tmp/shot-sponsor-list.png" });

  const toast = await page
    .locator('[role="status"], [data-sonner-toast], li[data-sonner-toast]')
    .allInnerTexts()
    .catch(() => []);
  log("TOASTS:", JSON.stringify(toast.map((t) => t.replace(/\s+/g, " ").slice(0, 160))));
  const modalOpen = await page.locator('input[type="number"]').count();
  log("FORM STILL OPEN:", modalOpen > 0);

  const body = await page.locator("body").innerText();
  log("LIST HAS NAME:", body.includes("Demo Sponsor Nusantara"));
  log("TOAST/ERR SNIPPET:", body.replace(/\s+/g, " ").slice(0, 200));

  // --- validation path: empty name should surface a domain message ---
  await page.getByRole("button", { name: /TAMBAH SPONSOR/i }).click();
  await page.waitForTimeout(300);
  const form2 = page.locator("form").filter({ has: page.locator('input[type="number"]') }).first();
  await form2.locator('button[type="submit"]').click();
  await page.waitForTimeout(1200);
  const vtext = await page.locator("body").innerText();
  log("VALIDATION MSG PRESENT:", /wajib|diisi|tidak dikenal/i.test(vtext));
  const m = vtext.match(/[^\n]*(wajib diisi|tidak dikenal)[^\n]*/i);
  if (m) log("VALIDATION MSG:", m[0].slice(0, 120));
  await page.screenshot({ path: "/tmp/shot-sponsor-validation.png" });
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: /^Batal$/i }).click().catch(() => {});
  await page.waitForTimeout(500);

  // --- homepage shows the sponsor ---
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  const home = await page.locator("body").innerText();
  log("HOME HAS SECTION:", /Didukung oleh|Sponsor/i.test(home));
  const logo = page.locator('img[src*="demo-sponsor"], a[rel="sponsored"]').first();
  const logoCount = await logo.count();
  log("LOGO ELEMENTS:", logoCount);
  if (logoCount) {
    await logo.scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);
    const box = await logo.boundingBox();
    log("LOGO BOX:", JSON.stringify(box));
    log("LOGO NATURAL W:", await logo.evaluate((el) => el.naturalWidth).catch(() => "n/a"));
    await page.screenshot({ path: "/tmp/shot-home-sponsor.png", fullPage: false });
  } else {
    await page.screenshot({ path: "/tmp/shot-home-nosponsor.png" });
  }

  log("PAGE ERRORS:", errors.length ? errors.slice(0, 3).join(" | ") : "none");
  await browser.close();
})();
