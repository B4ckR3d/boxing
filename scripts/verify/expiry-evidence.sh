#!/usr/bin/env bash
# Verifies the expiry sweep against the dev database: sold back to 0, audit row written.
set -euo pipefail
cd "$(dirname "$0")/../.."
DBURL=$(grep -m1 '^DATABASE_URL=' .env | cut -d= -f2- | tr -d '"\047')
USER=$(printf '%s' "$DBURL" | sed -E 's|.*://([^:]+):.*@.*|\1|')
PASS=$(printf '%s' "$DBURL" | sed -E 's|.*://[^:]+:([^@]+)@.*|\1|')
DB=$(printf '%s' "$DBURL" | sed -E 's|.*@[^/]+/([^?]+).*|\1|')
mysql -h 127.0.0.1 -u "$USER" -p"$PASS" "$DB" -e "
SELECT o.orderNumber, o.status, o.adminNote, t.sold, t.quota
FROM TicketOrder o JOIN TicketType t ON t.id = 'cmwdof19m0000e5swkljx3akq'
WHERE o.orderNumber = 'TFN-MWEDCUI1-OLFQ5N4';
SELECT action, actorId, summary, metadata FROM AuditLog WHERE entityId = 'cmwedcuif0000e1swn1yuu6i9';
"
