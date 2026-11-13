/**
 * Releases seats held by unpaid ticket orders that were never confirmed or rejected.
 *
 * Run manually:      npm run ticketing:expire-holds
 * Schedule (cron):   use scripts/cron/expire-holds.sh — it adds PATH hardening, flock, logging
 *                    and real exit codes around this command. Install with:
 *                      ./scripts/cron/install.sh            # hourly at :17
 *                      ./scripts/cron/install.sh print      # the crontab line only
 *
 * The window comes from TICKET_HOLD_EXPIRY_HOURS (default 24). `--conditions=react-server` is required
 * because the service layer imports the `server-only` marker package, which throws outside Next.js.
 */
import "dotenv/config";
import { env } from "@/lib/env";
import { prisma } from "@/lib/db/prisma";
import { expireStaleHolds } from "@/server/services/ticketing.service";

async function main() {
  const hours = env().TICKET_HOLD_EXPIRY_HOURS;
  const startedAt = Date.now();
  const summary = await expireStaleHolds({ olderThanHours: hours });
  const elapsed = Date.now() - startedAt;

  console.log(
    `[expire-holds] window=${hours}h scanned=${summary.scanned} expired=${summary.expired} skipped=${summary.skipped} seatsReleased=${summary.releasedSeats} (${elapsed}ms)`,
  );
  for (const orderNumber of summary.orderNumbers) console.log(`  - cancelled ${orderNumber}`);

  if (summary.expired > 0) {
    console.log("[expire-holds] reminder: buyers keep the old token; /tickets/status will now show DIBATALKAN.");
  }
}

main()
  .catch((error) => {
    console.error("[expire-holds] FAILED:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
