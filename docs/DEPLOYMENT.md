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

# 2. Deploy Code and Install Production Packages
npm ci --only=production

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

