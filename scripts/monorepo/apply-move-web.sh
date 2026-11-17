#!/usr/bin/env bash
# Langkah A — pindahkan aplikasi Next.js dari root ke apps/web.
# Sifat: memindahkan (bukan menyalin). Git-tracked → `git mv` (riwayat terjaga);
# sisanya → `mv`. Tidak ada penghapusan file, tidak ada commit.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

mkdir -p apps/web/src apps/web/scripts

move() {
  local src="$1" dest="$2"
  [ -e "$src" ] || { echo "  lewati (tidak ada): $src"; return; }
  # Direktori: pakai `mv` biasa — `git mv` gagal untuk direktori yang sebagian isinya
  # untracked (mis. public/theme-init.js). Git tetap mendeteksi rename saat commit
  # karena berbasis kemiripan konten.
  if [ -d "$src" ]; then
    mv "$src" "$dest"
  elif git ls-files --error-unmatch "$src" >/dev/null 2>&1; then
    git mv "$src" "$dest"
  else
    mv "$src" "$dest"
  fi
  echo "  ✓ $src → $dest"
}

echo "▸ Direktori source aplikasi → apps/web/src"
for d in app components lib server styles; do
  move "src/$d" "apps/web/src/$d"
done
move "src/proxy.ts" "apps/web/src/proxy.ts"

echo "▸ Aset publik & test → apps/web"
move "public" "apps/web/public"
move "tests" "apps/web/tests"
move "storage" "apps/web/storage"

echo "▸ Konfigurasi yang dimiliki aplikasi → apps/web"
for f in next.config.ts next-env.d.ts postcss.config.mjs tsconfig.json eslint.config.mjs vitest.config.ts playwright.config.ts; do
  move "$f" "apps/web/$f"
done
move "scripts/verify" "apps/web/scripts/verify"

# src/ harus kosong sekarang (client prisma sudah pindah ke packages/db)
if [ -d src ]; then
  find src -type f | head -5
  rmdir src 2>/dev/null && echo "  ✓ src/ dihapus (kosong)" || echo "  ! src/ masih berisi — periksa manual"
fi

echo "▸ Sisa di root:"
ls -A | grep -vE '^(node_modules|\.git)$' | tr '\n' ' '
echo
