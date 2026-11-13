const BASE = "http://localhost:3015";
const EV = process.env.EVENT_ID;
const VIP = process.env.VIP_ID;

async function post(body) {
  const r = await fetch(`${BASE}/api/ticketing/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: BASE },
    body: JSON.stringify(body),
  });
  let j = {};
  try { j = await r.json(); } catch {}
  return { status: r.status, body: j };
}

const base = {
  eventId: EV,
  ticketTypeId: VIP,
  quantity: 1,
  customerName: "Negative Test",
  customerEmail: "neg@example.com",
  customerPhone: "081200000001",
  paymentMethod: "BANK_TRANSFER",
};

(async () => {
  const cases = [
    ["qty 0", { ...base, quantity: 0 }],
    ["qty -1", { ...base, quantity: -1 }],
    ["qty 999 (oversell)", { ...base, quantity: 999 }],
    ["bad ticketTypeId", { ...base, ticketTypeId: "does-not-exist" }],
    ["empty name", { ...base, customerName: "" }],
    ["bad email", { ...base, customerEmail: "not-an-email" }],
    ["missing phone", { ...base, customerPhone: "" }],
    ["bad paymentMethod", { ...base, paymentMethod: "CRYPTO" }],
  ];
  for (const [label, body] of cases) {
    const r = await post(body);
    console.log(`${label}: HTTP ${r.status} ${JSON.stringify(r.body).slice(0, 110)}`);
  }

  // Concurrency: six simultaneous 10-ticket VIP orders against 58 remaining.
  console.log("\nCONCURRENCY (6x qty 10 vs remaining quota):");
  const reqs = Array.from({ length: 6 }, (_, i) =>
    post({ ...base, quantity: 10, customerEmail: `conc-${i}@example.com` })
  );
  const results = await Promise.all(reqs);
  results.forEach((r, i) => console.log(` #${i}:`, r.status, r.body.orderNumber ?? "quota-denied"));
  const okCount = results.filter((x) => x.status === 201).length;
  console.log("SUCCEEDED:", okCount, okCount === 5 ? "=> PASS (exactly 58 sold, no oversell)" : "=> REVIEW");
})();
