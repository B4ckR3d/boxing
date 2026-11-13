#!/usr/bin/env bash
#
# Production deploy for the TFN ticketing site on the aaPanel box.
# Idempotent: safe to run repeatedly. Readable on purpose — no clever stuff.
#
#   ./scripts/deploy.sh              # normal deploy
#   RUN_BOOTSTRAP=1 ./scripts/deploy.sh   # also re-run admin:bootstrap (resets admin passwords)
#   APP_PORT=3000 ./scripts/deploy.sh     # override the port used by the smoke test
#
set -euo pipefail

APP_DIR="${APP_DIR:-/www/wwwroot/boxing}"
PM2_NAME="${PM2_NAME:-boxing-tfn}"
# Port to smoke-test: APP_PORT env > PORT from .env > 3000
if [ -z "${APP_PORT:-}" ]; then
  APP_PORT="$(grep -E '^PORT=' .env 2>/dev/null | tail -1 | cut -d= -f2 | tr -d '\r' )"
  APP_PORT="${APP_PORT:-3000}"
fi
BRANCH="${BRANCH:-main}"

cd "$APP_DIR"

step() {
  printf '\n\033[1m▸ %s\033[0m\n' "$1"
}

die() {
  printf '\033[31m✗ %s\033[0m\n' "$1" >&2
  exit 1
}

# ---------------------------------------------------------------------------
# 1. Preflight — env must be valid BEFORE we touch the checkout.
#    Since AUTH_SECRET / ENCRYPTION_KEY dev fallbacks were removed from
#    src/lib/env.ts, a missing key crashes the app on boot instead of
#    silently running with a known secret. Fail here, not in production.
# ---------------------------------------------------------------------------
step "1/8 Preflight (env + toolchain)"

[ -f .env ] || die ".env not found in $APP_DIR — create it from .env.example first"

missing=()
for key in APP_URL DATABASE_URL AUTH_SECRET ENCRYPTION_KEY; do
  grep -qE "^${key}=.+" .env || missing+=("$key")
done
if [ "${#missing[@]}" -gt 0 ]; then
  die ".env has empty/missing values: ${missing[*]} (generate with: openssl rand -base64 32)"
fi

# Warn (do not fail) if the secret is too short to be a real 32-byte base64 key.
auth_len=$(grep -E '^AUTH_SECRET=' .env | head -1 | cut -d= -f2- | wc -c)
if [ "$auth_len" -lt 32 ]; then
  printf '\033[33m! AUTH_SECRET looks short (%s chars) — expected a 32-byte base64 string\033[0m\n' "$auth_len"
fi

node -v
npm -v

# ---------------------------------------------------------------------------
# 2. Sync to origin/main (server working tree is treated as disposable)
# ---------------------------------------------------------------------------
step "2/8 Syncing code from origin/$BRANCH"
git fetch --prune origin "$BRANCH"
git reset --hard "origin/$BRANCH"
echo "HEAD: $(git log -1 --oneline)"

# ---------------------------------------------------------------------------
# 2b. Optional DB snapshot before migrations (BACKUP=1 ./scripts/deploy.sh)
# ---------------------------------------------------------------------------
if [ "${BACKUP:-0}" = "1" ]; then
  step "2b/8 Backing up the database"
  npm run db:backup
fi

# ---------------------------------------------------------------------------
# 3. Dependencies — devDeps are required (tailwind, eslint config, prisma CLI)
# ---------------------------------------------------------------------------
step "3/8 Installing dependencies"
if ! npm ci --include=dev; then
  printf '\033[33m! npm ci failed (lockfile drift?) — falling back to npm install\033[0m\n'
  npm install
fi

# ---------------------------------------------------------------------------
# 4. Prisma client
# ---------------------------------------------------------------------------
step "4/8 Generating Prisma client"
npx prisma generate

# ---------------------------------------------------------------------------
# 5. Migrations — MUST run, otherwise new tables (ticketing, check-in) are
#    missing and the app 500s on the first write. `migrate deploy` only
#    applies committed migrations; it never drops data.
# ---------------------------------------------------------------------------
step "5/8 Applying migrations (prisma migrate deploy)"
npx prisma migrate deploy
npx prisma migrate status || printf '\033[33m! migrate status reported a difference — review above\033[0m\n'

# ---------------------------------------------------------------------------
# 6. Optional admin re-bootstrap (destructive for admin passwords — opt in)
# ---------------------------------------------------------------------------
step "6/8 Admin accounts"
if [ "${RUN_BOOTSTRAP:-0}" = "1" ]; then
  npm run admin:bootstrap
else
  echo "skipped (set RUN_BOOTSTRAP=1 only when you really want passwords reset)"
fi

# ---------------------------------------------------------------------------
# 7. Build — wipe .next so a partial/corrupt build can't survive a deploy
# ---------------------------------------------------------------------------
step "7/8 Building Next.js bundle"
rm -rf .next
npm run build

# ---------------------------------------------------------------------------
# 8. Restart under PM2, then smoke test the port
# ---------------------------------------------------------------------------
step "8/8 Restarting PM2 process '$PM2_NAME'"
if ! command -v pm2 >/dev/null 2>&1; then
  die "pm2 not found in PATH — install it or run this as the deploy user"
fi
if pm2 describe "$PM2_NAME" >/dev/null 2>&1; then
  pm2 restart "$PM2_NAME" --update-env
else
  pm2 start npm --name "$PM2_NAME" -- start
fi
pm2 save
pm2 describe "$PM2_NAME" | grep -E 'status|uptime|restarts' || true

echo "waiting for http://127.0.0.1:$APP_PORT ..."
code=""
for _ in $(seq 1 30); do
  code=$(curl -s -o /dev/null -m 5 -w '%{http_code}' "http://127.0.0.1:$APP_PORT/" || true)
  [ "$code" = "200" ] && break
  sleep 2
done

if [ "$code" != "200" ]; then
  printf '\033[31m✗ smoke test failed (HTTP %s) — run: pm2 logs %s --lines 80\033[0m\n' "${code:-none}" "$PM2_NAME" >&2
  exit 1
fi
echo "✓ HTTP 200 from http://127.0.0.1:$APP_PORT/"

# Cron only needs installing once; install.sh is idempotent and prints when
# there is nothing to do. Non-fatal: a missing cron must not block a deploy.
if [ -x scripts/cron/install.sh ]; then
  ./scripts/cron/install.sh >/dev/null 2>&1 && echo "✓ hold-expiry cron present" \
    || printf '\033[33m! run ./scripts/cron/install.sh to schedule hold expiry\033[0m\n'
fi

echo ""
echo "=========================================================="
echo "✅ DEPLOY OK — $(git log -1 --format='%h %s')"
echo "   Admin login: \$APP_URL/admin/login (password = DEMO_USER_PASSWORD in .env)"
echo "   See docs/ADMIN_LOGIN_GUIDE.md for account audit + recovery steps"
echo "=========================================================="
