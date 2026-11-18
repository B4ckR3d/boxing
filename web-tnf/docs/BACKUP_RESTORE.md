# Database Backup & Disaster Recovery Guide

> **Status:** v1.0  
> **Source of Truth:** [prd.md](../prd.md)  
> **Database:** MySQL 8.4 via `mysqldump` / Binary Logging  

---

## 1. Backup Strategy Overview

To maintain audit integrity and prevent sports data loss, the platform adheres to the 3-2-1 backup principle:
- **3 copies** of data (Production database, local snapshot, encrypted off-site replica)
- **2 different media types** (Block storage volume, S3 glacier/object archive)
- **1 copy off-site** (Different cloud region or provider)

---

## 2. Automated Daily Snapshot Script

Save as `scripts/db-backup.sh` (or run via Node.js runner):
```bash
#!/bin/bash
set -e

BACKUP_DIR="/var/backups/boxing"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
FILENAME="boxing_backup_${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

echo "🥊 Creating compressed database snapshot: $FILENAME..."

# Dump without locking tables (InnoDB transaction safe)
mysqldump \
  --host="${MYSQL_HOST:-localhost}" \
  --port="${MYSQL_PORT:-3306}" \
  --user="${MYSQL_USER}" \
  --password="${MYSQL_PASSWORD}" \
  --single-transaction \
  --quick \
  --routines \
  --triggers \
  "${MYSQL_DATABASE:-boxing}" | gzip -9 > "${BACKUP_DIR}/${FILENAME}"

echo "✅ Snapshot created: ${BACKUP_DIR}/${FILENAME} ($(du -h ${BACKUP_DIR}/${FILENAME} | cut -f1))"

# Encrypt with OpenSSL (optional but recommended)
openssl enc -aes-256-cbc -salt -in "${BACKUP_DIR}/${FILENAME}" -out "${BACKUP_DIR}/${FILENAME}.enc" -pass env:BACKUP_ENCRYPTION_KEY

# Push to S3 bucket archive
aws s3 cp "${BACKUP_DIR}/${FILENAME}.enc" "s3://${S3_BACKUP_BUCKET}/db-backups/${FILENAME}.enc"

# Clean up snapshots older than 30 days locally
find "$BACKUP_DIR" -type f -name "*.sql.gz*" -mtime +30 -delete

echo "🚀 Remote replication complete."
```

---

## 3. Disaster Recovery / Database Restoration

### Step 1: Verify Target Database Exists
```bash
mysql -h $MYSQL_HOST -P $MYSQL_PORT -u root -p -e "CREATE DATABASE IF NOT EXISTS boxing CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

### Step 2: Decrypt & Restore Dump
```bash
# Decrypt archive
openssl enc -d -aes-256-cbc -in boxing_backup_20261104.sql.gz.enc -out boxing_backup_20261104.sql.gz -pass env:BACKUP_ENCRYPTION_KEY

# Decompress and Pipe into MySQL
gunzip < boxing_backup_20261104.sql.gz | mysql -h $MYSQL_HOST -P $MYSQL_PORT -u $MYSQL_USER -p boxing
```

### Step 3: Run Prisma Migration Check
Verify that all schema constraints and migrations are aligned:
```bash
npx prisma migrate status
```

