#!/usr/bin/env bash
# Residue check for the tfn_test database after integration runs.
set -euo pipefail
cd "$(dirname "$0")/../.."
DBURL=$(grep -m1 '^TEST_DATABASE_URL=' .env | cut -d= -f2- | tr -d '"\047')
USER=$(printf '%s' "$DBURL" | sed -E 's|.*://([^:]+):.*@.*|\1|')
PASS=$(printf '%s' "$DBURL" | sed -E 's|.*://[^:]+:([^@]+)@.*|\1|')
DB=$(printf '%s' "$DBURL" | sed -E 's|.*@[^/]+/([^?]+).*|\1|')
mysql -h 127.0.0.1 -u "$USER" -p"$PASS" "$DB" -e "
SELECT
  (SELECT COUNT(*) FROM Event WHERE name LIKE 'itest-%') AS leaked_events,
  (SELECT COUNT(*) FROM TicketType WHERE eventId IN (SELECT id FROM Event WHERE name LIKE 'itest-%')) AS leaked_types,
  (SELECT COUNT(*) FROM User WHERE email LIKE 'itest-%') AS leaked_users,
  (SELECT COUNT(*) FROM AuditLog WHERE action='TICKET_HOLD_EXPIRED') AS expiry_audits_left;
"
