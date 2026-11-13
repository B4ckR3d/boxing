#!/usr/bin/env bash
# Resets DEV ticketing state after browser probes: deletes every ticket order and zeroes `sold`.
# NEVER run this against tfn_test or production — it refuses unless MYSQL_DATABASE is tfn_local.
set -euo pipefail
cd "$(dirname "$0")/../.."
DBURL=$(grep -m1 '^DATABASE_URL=' .env | cut -d= -f2- | tr -d '"\047')
USER=$(printf '%s' "$DBURL" | sed -E 's|.*://([^:]+):.*@.*|\1|')
PASS=$(printf '%s' "$DBURL" | sed -E 's|.*://[^:]+:([^@]+)@.*|\1|')
DB=$(printf '%s' "$DBURL" | sed -E 's|.*@[^/]+/([^?]+).*|\1|')
if [ "$DB" != "tfn_local" ]; then
  echo "refusing: .env DATABASE_URL points at '$DB', expected tfn_local" >&2
  exit 1
fi
mysql -h 127.0.0.1 -u "$USER" -p"$PASS" "$DB" -e "
DELETE FROM AuditLog WHERE entityType IN ('TicketOrder','TicketType');
DELETE FROM TicketPayment;
DELETE FROM TicketOrderItem;
DELETE FROM TicketOrder;
UPDATE TicketType SET sold = 0;
SELECT
  (SELECT COUNT(*) FROM TicketOrder) AS orders,
  (SELECT COUNT(*) FROM TicketPayment) AS payments,
  (SELECT SUM(sold) FROM TicketType) AS sold_total,
  (SELECT SUM(quota) FROM TicketType) AS quota_total;
"
