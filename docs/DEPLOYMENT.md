# Production Deployment & Hosting Guide

> **Status:** v1.0  
> **Source of Truth:** [prd.md](../prd.md)  
> **Target Infrastructures:** Linux VPS (Ubuntu 22.04 / 24.04 LTS), Docker, Managed MySQL 8.4, Reverse Proxy (Nginx / Cloudflare)  

---

## 1. Production Architecture Overview

```
[ Client Traffic ]
        │ (HTTPS 443)
[ Cloudflare / CDN / WAF ]
        │
[ Nginx Reverse Proxy (SSL Termination, Rate Limiting, HTTP/2) ]
        │ (HTTP 3000)
[ Next.js Node.js Application (PM2 / Docker Standalone) ]
        │
[ MySQL 8.4 Managed Instance / Cloud SQL / AWS RDS ]
        │
[ S3-Compatible Object Storage (AWS S3 / Cloudflare R2) ]
```

---

## 2. Environment Variables Checklist

Ensure the following variables are configured in production:
```bash
NODE_ENV=production
APP_URL=https://championship.boxing.org

# Database Configuration
MYSQL_HOST=db.internal.boxing.org
MYSQL_PORT=3306
MYSQL_DATABASE=boxing_prod
MYSQL_USER=boxing_app
MYSQL_PASSWORD=strong-random-generated-password
DATABASE_URL=mysql://boxing_app:strong-random-generated-password@db.internal.boxing.org:3306/boxing_prod
DATABASE_POOL_SIZE=25

# Cryptographic Keys (32-byte base64 strings)
AUTH_SECRET=randomly-generated-32-byte-base64-secret
ENCRYPTION_KEY=randomly-generated-32-byte-base64-secret

# Security Policies
AUTH_ENFORCE_MFA=true
SESSION_TTL_HOURS=8
SESSION_IDLE_MINUTES=30
AUTH_MAX_FAILED_LOGINS=5
AUTH_LOCKOUT_MINUTES=15

# Object Storage (S3 / Cloudflare R2)
STORAGE_DRIVER=s3
S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
S3_REGION=auto
S3_BUCKET=boxing-media-prod
S3_ACCESS_KEY_ID=access-key-here
S3_SECRET_ACCESS_KEY=secret-key-here
S3_PUBLIC_URL=https://media.boxing.org
```

---

## 3. Production Build & Run Steps

### Option A: PM2 on Linux VPS
```bash
# 1. Install Node.js 20+ and PM2
npm install -g pm2

# 2. Deploy Code and Install Packages
npm ci          # NOT `--only=production`: the Next build needs devDeps (typescript, tailwind, eslint)

# 3. Generate Prisma Client
npm run db:generate

# 4. Deploy Migrations
npm run db:deploy

# 5. Build Next.js Production Bundle
npm run build

# 6. Start Application with PM2 Cluster
pm2 start npm --name "boxing-championship" -- run start
pm2 save
pm2 startup
```

### Option B: aaPanel + PM2 (the actual production box)

`scripts/deploy.sh` is the deploy entrypoint on the box. It assumes `APP_DIR=/www/wwwroot/boxing`
and PM2 process `boxing-tfn`, both overridable by env var (`APP_DIR=… PM2_NAME=… ./scripts/deploy.sh`).

```bash
cd /www/wwwroot/boxing
./scripts/deploy.sh
```

The script runs, in order: **env preflight** (fails loudly if `APP_URL`, `DATABASE_URL`,
`AUTH_SECRET` or `ENCRYPTION_KEY` are empty — the dev fallbacks were removed) → `git reset --hard
origin/main` → `npm ci --include=dev` → `prisma generate` → **`prisma migrate deploy`** (required:
without it the ticketing/check-in tables never appear and the first write 500s) → `rm -rf .next` +
`npm run build` → `pm2 restart boxing-tfn --update-env` → HTTP smoke test on `127.0.0.1:3000` →
idempotent `scripts/cron/install.sh`.

`admin:bootstrap` is **opt-in** (`RUN_BOOTSTRAP=1 ./scripts/deploy.sh`) because it resets admin
passwords; a normal deploy must not change credentials. aaPanel's own Cron UI is where the
scheduled hold-expiry job goes (see 3.1).

---

## 3.1 Scheduled jobs (required — seat holds expire here)

Ticket orders sit in `PENDING_CONFIRMATION` until a human verifies the transfer. Unverified holds
must be released by a **cron job**, or those seats stay locked forever. On the production box:

```bash
cd /www/wwwroot/boxing

./scripts/cron/install.sh print      # 17 * * * *  /www/wwwroot/boxing/scripts/cron/expire-holds.sh  # TFN-EXPIRE-HOLDS
./scripts/cron/install.sh            # install for the deploy user (root on most aaPanel boxes)
./scripts/cron/install.sh status     # confirm the line + last runs
```

**aaPanel path:** Cron → Add Task → *Shell Script* → paste the `print` output (or just the script
path) → period **N Minutes = 60**. Keep the `:17` minute offset so the sweep never lands at the
top of the hour alongside log rotation and backups.

Why a wrapper and not `npm run` directly: cron's PATH has no `npm`, and two overlapping sweeps can
double-release capacity. `expire-holds.sh` provides PATH hardening, a `flock` single-instance
guard, an append-only log at `storage/logs/expire-holds.log` (self-rotating past 2 MB), and honest
exit codes (`0` ok · `1` failed · `3` unparsable output). It prints nothing when there is nothing
to release, so cron mail only arrives when seats were freed or something broke.

| Check | Command |
|---|---|
| Did it run? | `./scripts/cron/install.sh status` or `tail -5 storage/logs/expire-holds.log` |
| Is a sweep already holding? | `ls -l storage/expire-holds.lock` |
| Manual run (same code path) | `./scripts/cron/expire-holds.sh` |
| Is the window right? | `grep TICKET_HOLD_EXPIRY_HOURS .env` (default 24, max 720) |

> `tsx` is a **runtime dependency** in this project, so `npm ci --only=production` still leaves the
> sweep runnable. The wrapper checks for `node_modules/.bin/tsx` and fails with a clear message
> instead of a silent no-op if it is ever missing.

> PM2 does not need restarting for this job — cron runs it out of process. Conversely, restarting
> PM2 through `scripts/deploy.sh` never touches the crontab, so the schedule survives deploys.

---

## 3.2 Admin credentials & password reset

Login keeps failing with the password from `.env`? Then the row in the database holds an older
hash. `prisma db seed` and `scripts/bootstrap-admin.ts` used `update: {}` — they only ever created
accounts, so an existing account *never* picked up a new password. Fixed on `main`; both paths
now write the hash and clear `failedLoginCount` / `lockedUntil`.

```bash
cd /www/wwwroot/boxing

# Primary admin → password from BOOTSTRAP_ADMIN_PASSWORD (also unlocks the account)
RUN_BOOTSTRAP=1 npm run admin:bootstrap

# Any single account
npm run user:reset-password -- --email=admin@boxing.local --password='Strong-Pass-2026!'

# All seeded persona accounts → DEMO_USER_PASSWORD
npm run user:reset-password -- --all-demo
```

Passwords must pass `passwordPolicy` (min 12 chars, upper + lower + digit). Neither command prints
the password back. `prisma db seed` refuses to run when `NODE_ENV=production` while
`SEED_DEMO`/`SEED_DEMO_USERS` is `true`, so on the production box the reset path is the only way in.

> `TEST_DATABASE_URL` must never point at the production schema — the test projects truncate
> tables. Use a separate `boxing_test` database.

---

## 4. Nginx Reverse Proxy Configuration

```nginx
server {
    listen 80;
    server_name championship.boxing.org;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name championship.boxing.org;

    ssl_certificate /etc/letsencrypt/live/championship.boxing.org/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/championship.boxing.org/privkey.pem;

    # Enterprise SSL Settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers "ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384";

    # Security Headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Static Assets Caching
    location /_next/static/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_cache_valid 200 365d;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    # Proxy to Next.js
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

