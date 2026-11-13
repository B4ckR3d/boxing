/**
 * Live gate probe: buy → admin confirm → scan QR at the gate → re-scan → buyer view.
 *
 *   npm run build && npm run start -- -p 3015
 *   DEMO_USER_PASSWORD=… node scripts/verify/checkin-e2e.cjs
 *
 * The QR payload is recomputed from AUTH_SECRET exactly as `ticket-token.ts` does it, so this
 * exercises the signed-QR path (not just the manual fallback).
 */
const { chromium } = require("playwright");
const { createHmac } = require("node:crypto");
const fs = require("node:fs");

const BASE = "http://localhost:3015";
const EXE = "/home/irhan/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome";

function secret() {
  const line = fs.readFileSync(".env", "utf8").split("\n").find((l) => l.startsWith("AUTH_SECRET="));
  return (line || "").split("=").slice(1).join("=").trim().replace(/^["']|["']$/g, "");
}

const payloadFor = (orderNumber) =>
  `TFN1.${orderNumber}.${createHmac("sha256", secret()).update(`TFN1|${orderNumber}`).digest("hex").slice(0, 12).toUpperCase()}`;

(async () => {
  const browser = await chromium.launch({ executablePath: EXE });
  const errs = [];
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errs.push(e.message));

  // 1. Buy one ticket through the public UI
  await page.goto(`${BASE}/tickets`, { waitUntil: "networkidle" });
  await page.locator("button[aria-pressed]", { hasText: "TRIBUN BARAT" }).first().click();
  await page.fill('input[name="customerName"]', "Gate Probe");
  await page.fill('input[name="customerEmail"]', "gate.probe@example.com");
  await page.fill('input[name="customerPhone"]', "081377776666");
  await page.fill('input[name="reference"]', "TRX-GATE-1");
  await page.click('button[type="submit"]');
  await page.waitForSelector("#receipt-title", { timeout: 20000 });
  const order = (await page.locator("dd.select-all").first().innerText()).trim();
  const token = (await page.locator("dd.select-all").nth(1).innerText()).trim();
  console.log("1. ORDER:", order);

  // 2. Admin confirms the payment
  const admin = await ctx.newPage();
  admin.on("pageerror", (e) => errs.push(`admin: ${e.message}`));
  await admin.goto(`${BASE}/admin/login`, { waitUntil: "domcontentloaded" });
  await admin.fill('input[name="email"]', "superadmin@boxing.local");
  await admin.fill('input[name="password"]', process.env.DEMO_USER_PASSWORD || "");
  await admin.click('button[type="submit"]');
  await admin.waitForURL(`${BASE}/admin`, { timeout: 25000 });
  await admin.goto(`${BASE}/admin/ticketing?status=pending`, { waitUntil: "networkidle" });
  const card = admin.locator("article", { hasText: order }).first();
  await card.getByRole("button", { name: "Konfirmasi" }).click();
  // The pending list refreshes and the card leaves the filter, so re-query from the confirmed view.
  await admin.waitForTimeout(2500);
  await admin.goto(`${BASE}/admin/ticketing?status=confirmed`, { waitUntil: "networkidle" });
  console.log("2. CONFIRMED:", (await admin.locator("article", { hasText: order }).first().innerText()).replace(/\s+/g, " ").slice(0, 60));

  // 3. Gate page is reachable from the ticketing panel
  await admin.goto(`${BASE}/admin/ticketing`, { waitUntil: "networkidle" });
  await admin.getByRole("link", { name: /scan check-in/i }).click();
  await admin.waitForURL(`${BASE}/admin/ticketing/scan`, { timeout: 20000 });
  console.log("3. SCAN PAGE:", await admin.locator("h1").first().innerText());

  const scan = async (code) => {
    const before = await admin.locator("section[aria-label='Riwayat scan sesi ini'] li").count();
    await admin.fill("#ticket-code", code);
    await admin.click('button[type="submit"]');
    // The result banner swaps between accepted/refused, so wait on the append-only session log.
    await admin.waitForFunction(
      (n) => document.querySelectorAll("section[aria-label='Riwayat scan sesi ini'] li").length > n,
      before,
      { timeout: 20000 },
    );
    const entry = admin.locator("section[aria-label='Riwayat scan sesi ini'] li").first();
    const title = (await entry.locator("p").first().innerText()).trim();
    const detail = (await entry.locator("p").nth(1).innerText()).trim();
    const accepted = title !== "Ditolak";
    const alert = admin.locator('section[role="alert"]');
    const code_ = (await alert.count()) ? (await alert.locator("p").last().innerText()).trim() : "";
    const banner = accepted
      ? (await admin.locator("section[aria-live] p").first().innerText()).trim()
      : (await alert.locator("p").first().innerText()).trim();
    return { accepted, verdict: banner, detail: `${title} · ${detail}`, code: code_ };
  };

  // 4. First scan of the signed QR is accepted
  const first = await scan(payloadFor(order));
  console.log("4. FIRST SCAN:", first.accepted ? "ADMITTED" : "REFUSED", "|", first.detail);
  await admin.screenshot({ path: "/tmp/shot-scan-admitted.png", fullPage: false });

  // 5. The same QR a second time is refused, with the time of the first entry
  const second = await scan(payloadFor(order));
  console.log("5. SECOND SCAN:", second.accepted ? "ADMITTED (BUG)" : "REFUSED", "|", second.verdict, "|", second.detail, "|", second.code);
  await admin.screenshot({ path: "/tmp/shot-scan-refused.png", fullPage: false });

  // 6. A forged payload shares the generic message (no oracle)
  const forged = await scan(`TFN1.${order}.DEADBEEFDEAD`);
  console.log("6. FORGED QR:", forged.accepted ? "ADMITTED (BUG)" : "REFUSED", "|", forged.detail);

  // 7. Admin panel shows the order as already inside, and the operator is named
  await admin.goto(`${BASE}/admin/ticketing?status=used`, { waitUntil: "networkidle" });
  console.log("7. USED FILTER:", (await admin.locator("article", { hasText: order }).first().innerText()).replace(/\s+/g, " ").slice(0, 90));

  // 8. Buyer still sees their ticket and can re-download the PDF
  const check = await ctx.newPage();
  await check.goto(`${BASE}/tickets/status?order=${order}&token=${token}`, { waitUntil: "domcontentloaded" });
  const buyerStatus = (await check.locator("article span").first().innerText()).trim();
  const pdf = await check.request.get(`${BASE}/tickets/${order}/ticket?token=${encodeURIComponent(token)}`);
  console.log("8. BUYER VIEW:", buyerStatus, "| PDF:", pdf.status(), pdf.headers()["content-type"]);
  await check.screenshot({ path: "/tmp/shot-status-used.png", fullPage: false });

  console.log("JS ERRORS:", errs.length ? errs.join(" || ") : "(none)");
  await browser.close();
})();
