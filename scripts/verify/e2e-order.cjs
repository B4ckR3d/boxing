const { chromium } = require("playwright");

const BASE = "http://127.0.0.1:3015";

(async () => {
  const browser = await chromium.launch({
    executablePath: "/home/irhan/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome",
  });
  const page = await browser.newPage();

  const apiCalls = [];
  page.on("response", (r) => {
    if (r.url().includes("/api/ticketing")) apiCalls.push(`${r.request().method()} ${r.url()} -> ${r.status()}`);
  });
  page.on("pageerror", (e) => console.log("PAGEERROR:", e.message));

  await page.goto(`${BASE}/tickets`, { waitUntil: "networkidle" });

  await page.selectOption('select[name="ticketTypeId"]', { index: 2 }); // VIP Ringside
  await page.fill('input[name="quantity"]', "2");
  await page.fill('input[name="customerName"]', "Siti Rahayu");
  await page.fill('input[name="customerEmail"]', "siti.e2e@example.com");
  await page.fill('input[name="customerPhone"]', "081298765432");
  await page.selectOption('select[name="paymentMethod"]', "BANK_TRANSFER");
  await page.fill('input[name="reference"]', "BCA-778899");

  await page.click('button[type="submit"]');

  const status = page.locator('[role="status"]');
  await status.waitFor({ state: "visible", timeout: 15000 });
  const text = (await status.textContent()) ?? "";

  console.log("API CALLS:", apiCalls.length ? apiCalls.join(" | ") : "(none)");
  console.log("STATUS TEXT:", text.trim());

  await browser.close();
  process.exit(text.includes("dibuat") ? 0 : 1);
})();
