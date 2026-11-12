#!/usr/bin/env bash
set -e

echo "=========================================================="
echo "🥊 TFN BOXING CHAMPIONSHIP — PRODUCTION DEPLOY & REFRESH"
echo "=========================================================="

# Masuk ke direktori aplikasi
if [ -d "/www/wwwroot/boxing" ]; then
  cd /www/wwwroot/boxing
fi

# 1. Reset file lokal jika ada perubahan agar tidak konflik dengan git
echo "📥 1/6 Mengambil kode terbaru dari GitHub main branch..."
git fetch origin main
git reset --hard origin/main

# 2. Install dependencies (termasuk tsx, argon2, prisma)
echo "📦 2/6 Menginstal / memperbarui dependencies..."
npm install

# 3. Generate Prisma Client
echo "🗄️ 3/6 Menghasilkan client Prisma..."
npx prisma generate

# 4. Bootstrap Akun Admin & Reset Password
echo "🔐 4/6 Memastikan akun Super Admin & Platform Admin aktif..."
npm run admin:bootstrap

# 5. Build Next.js Production
echo "🏗️ 5/6 Membangun bundel produksi Next.js (npm run build)..."
npm run build

# 6. Restart Server Process
echo "🔄 6/6 Me-restart proses server di aaPanel / PM2..."
if command -v pm2 &> /dev/null; then
  pm2 restart boxing-tfn 2>/dev/null || pm2 restart all 2>/dev/null || pm2 start npm --name "boxing-tfn" -- start
  echo "✓ PM2 process restarted."
fi

echo ""
echo "=========================================================="
echo "✅ UPDATE BERHASIL DIPASANG!"
echo "   Silakan buka browser Anda dan tekan CTRL + SHIFT + R (Hard Refresh)"
echo "   Halaman Login: http://<IP-VPS>:3000/admin/login"
echo "   Email:         admin@boxing.local (atau superadmin@boxing.local)"
echo "   Password:      Demo-Ringside-2026!"
echo "=========================================================="
