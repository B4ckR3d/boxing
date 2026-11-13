#!/usr/bin/env bash
# Removes the expiry probe order from the dev database. Capacity was already released by the sweep,
# so `sold` must NOT be touched here — the row count check proves it stayed at 0.
set -euo pipefail
cd "$(dirname "$0")/../.."
DBURL=$(grep -m1 '^DATABASE_URL=' .env | cut -d= -f2- | tr -d '"\047')
USER=$(printf '%s' "$DBURL" | sed -E 's|.*://([^:]+):.*@.*|\1|')
PASS=$(printf '%s' "$DBURL" | sed -E 's|.*://[^:]+:([^@]+)@.*|\1|')
DB=$(printf '%s' "$DBURL" | sed -E 's|.*@[^/]+/([^?]+).*|\1|')
ORDER='cmwedcuif0000e1swn1yuu6i9'
mysql -h 127.0.0.1 -u "$USER" -p"$PASS" "$DB" -e "
DELETE FROM AuditLog WHERE entityType='TicketOrder' AND entityId='$ORDER';
DELETE FROM TicketPayment WHERE orderId='$ORDER';
DELETE FROM TicketOrderItem WHERE orderId='$ORDER';
DELETE FROM TicketOrder WHERE id='$ORDER';
SELECT
  (SELECT COUNT(*) FROM TicketOrder) AS orders_left,
  (SELECT sold FROM TicketType WHERE id='cmwdof19m0000e5swkljx3akq') AS vip_ringside_sold,
  (SELECT COUNT(*) FROM AuditLog WHERE action='TICKET_HOLD_EXPIRED') AS expiry_audits_left;
"
