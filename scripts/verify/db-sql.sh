#!/usr/bin/env bash
# Runs a single SQL statement against the DEV or TEST database — never production.
#
#   ./scripts/verify/db-sql.sh "SELECT COUNT(*) FROM TicketOrder"
#   ./scripts/verify/db-sql.sh "SELECT id, sold FROM TicketType" tfn_test
#   TFN_SQL_RAW=1 ./scripts/verify/db-sql.sh "SELECT id FROM Event"    # tab-separated, no borders
#
# Credentials come from .env DATABASE_URL (the same ones the app uses — never `-u root`).
# The target database must match the expected name, so a stray shell can't wipe the wrong schema.
set -euo pipefail
cd "$(dirname "$0")/../.."

SQL="${1:?usage: db-sql.sh \"SELECT ...\" [tfn_local|tfn_test]}"
EXPECT_DB="${2:-tfn_local}"

DBURL=$(grep -m1 '^DATABASE_URL=' .env | cut -d= -f2- | tr -d '"\047')
USER=$(printf '%s' "$DBURL" | sed -E 's|.*://([^:]+):.*@.*|\1|')
PASS=$(printf '%s' "$DBURL" | sed -E 's|.*://[^:]+:([^@]+)@.*|\1|')
DB=$(printf '%s' "$DBURL" | sed -E 's|.*@[^/]+/([^?]+).*|\1|')

if [ "$DB" != "$EXPECT_DB" ]; then
  echo "refusing: .env DATABASE_URL points at '$DB', expected '$EXPECT_DB'" >&2
  exit 1
fi

FLAGS=(-h 127.0.0.1 -u "$USER" -p"$PASS" "$DB")
[ "${TFN_SQL_RAW:-0}" = "1" ] && FLAGS=(-h 127.0.0.1 -u "$USER" -p"$PASS" -N -B "$DB")

mysql "${FLAGS[@]}" -e "$SQL"
