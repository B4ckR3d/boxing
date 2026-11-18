const { chromium } = require("playwright");
const BASE = "http://localhost:3015";
const EXE = "/home/irhan/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome";
const OUT = "/tmp/shots";

(async () => {
  const fs = require("fs");
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: EXE });

  // Desktop public tickets
  const d = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "id-ID" });
  const p = await d.newPage();
  await p.goto(`${BASE}/tickets`, { waitUntil: "networkidle" });
  await p.screenshot({ path: `${OUT}/tickets-desktop.png`, fullPage: true });

  // Admin ticketing after login
  const a = await d.newPage();
  await a.goto(`${BASE}/admin/login`, { waitUntil: "networkidle" });
  await a.fill('input[name="email"]', "superadmin@boxing.local");
  await a.fill('input[name="password"]', process.env.DEMO_USER_PASSWORD || "");
  await a.click('button[type="submit"]');
  await a.waitForURL(/\/admin(\/|$)/, { timeout: 20000 });
  await a.goto(`${BASE}/admin/ticketing`, { waitUntil: "networkidle" });
  await a.screenshot({ path: `${OUT}/admin-ticketing-desktop.png`, fullPage: true });

  // Status page (lookup form)
  await p.goto(`${BASE}/tickets/status`, { waitUntil: "networkidle" });
  await p.screenshot({ path: `${OUT}/status-desktop.png`, fullPage: true });

  // Mobile tickets
  const m = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "id-ID", isMobile: true, hasTouch: true });
  const mp = await m.newPage();
  await mp.goto(`${BASE}/tickets`, { waitUntil: "networkidle" });
  await mp.screenshot({ path: `${OUT}/tickets-mobile.png`, fullPage: true });

  console.log("saved:", fs.readdirSync(OUT).join(", "));
  await browser.close();
})();
