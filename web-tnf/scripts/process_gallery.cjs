const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const mysql = require('mysql2/promise');

const SOURCE_DIR = path.join(__dirname, '..', 'galery');
const DEST_DIR = path.join(__dirname, '..', 'public', 'images', 'gallery');
const SQL_OUTPUT = path.join(__dirname, 'sync_gallery.sql');

if (!fs.existsSync(DEST_DIR)) {
  fs.mkdirSync(DEST_DIR, { recursive: true });
}

// 5 Kategori Galeri Resmi TFN
const CATEGORIES = [
  {
    id: 'cat_vol1',
    name: 'TFN Volume 1',
    slug: 'volume-1',
    description: 'Dokumentasi laga perdana Temanggung Fight Night April 2024',
    sortOrder: 1,
  },
  {
    id: 'cat_vol2',
    name: 'TFN Volume 2',
    slug: 'volume-2',
    description: 'Dokumentasi laga panas Temanggung Fight Night Vol. 2 Juli 2024',
    sortOrder: 2,
  },
  {
    id: 'cat_vol3',
    name: 'TFN Volume 3',
    slug: 'volume-3',
    description: 'Dokumentasi laga Temanggung Fight Night Vol. 3',
    sortOrder: 3,
  },
  {
    id: 'cat_weighin',
    name: 'Timbang Badan & Face-Off',
    slug: 'weigh-in',
    description: 'Sesi timbang badan resmi & tatap muka sengit petarung',
    sortOrder: 4,
  },
  {
    id: 'cat_ring',
    name: 'Aksi Ring & Sorak Arena',
    slug: 'ring-action',
    description: 'Momen pertarungan sengit dan atmosfer gemuruh penonton GOR Bambu Runcing',
    sortOrder: 5,
  },
];

// Helper sanitize filename
function sanitizeFilename(originalName) {
  const parsed = path.parse(originalName);
  let base = parsed.name.toLowerCase();
  
  if (base.startsWith('snapshot 29-04-2024')) {
    const timePart = base.replace('snapshot 29-04-2024', '').trim().replace('_', '');
    return `tfn-vol1-snap-20240429-${timePart}.webp`;
  }
  if (base.startsWith('snapshot 02-07-2024')) {
    const timePart = base.replace('snapshot 02-07-2024', '').trim().replace('_', '');
    return `tfn-vol2-snap-20240702-${timePart}.webp`;
  }
  if (base.startsWith('dsc')) {
    return `tfn-ring-${base}.webp`;
  }
  if (base.startsWith('img_')) {
    const cleanImg = base.replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    return `tfn-${cleanImg}.webp`;
  }
  return `tfn-${base.replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')}.webp`;
}

// Title and description mapper based on file characteristics
function getMetadataForFile(filename, idx) {
  const lower = filename.toLowerCase();

  if (lower.startsWith('snapshot 29-04-2024')) {
    return {
      categoryId: 'cat_vol1',
      title: `Sorotan Laga TFN Vol. 1 - Momen #${idx + 1}`,
      description: 'Dokumentasi siaran pertandingan Temanggung Fight Night Volume 1 dari arena GOR Bambu Runcing',
      takenAt: '2024-04-29 19:30:00'
    };
  }

  if (lower.startsWith('snapshot 02-07-2024')) {
    return {
      categoryId: 'cat_vol2',
      title: `Pertarungan Sengit TFN Vol. 2 - Momen #${idx + 1}`,
      description: 'Aksi baku pukul sengit petarung di atas kanvas Temanggung Fight Night Volume 2',
      takenAt: '2024-07-02 20:00:00'
    };
  }

  if (lower.startsWith('dsc')) {
    const dscTitles = [
      'Aksi Jual Beli Serangan di Sudut Ring',
      'Ketegangan Wasit Mengawasi Duel',
      'Sorakan Gemuruh Penonton Arena',
      'Fokus dan Konsentrasi di Atas Kanvas',
      'Pemberian Instruksi Corner Petarung'
    ];
    return {
      categoryId: 'cat_ring',
      title: dscTitles[idx % dscTitles.length] || `Aksi Ring TFN #${idx + 1}`,
      description: 'Dokumentasi fotografi lensa kamera menangkap detik-detik krusial pertarungan di arena TFN',
      takenAt: '2024-07-02 21:15:00'
    };
  }

  if (lower.startsWith('img_')) {
    // 14 IMG files:
    // First 7 into weighin, last 7 into vol3
    const num = parseInt(lower.replace(/[^0-9]/g, ''), 10) || idx;
    if (idx < 7) {
      const weighTitles = [
        'Sesi Timbang Badan Resmi Petarung',
        'Tatap Muka & Face-Off Sengit',
        'Pemeriksaan Medis & Berat Badan',
        'Konfrontasi Mental Pra-Laga',
        'Senyum Percaya Diri Jelang Bertarung',
        'Pemberian Arahan Teknis Matchmaker',
        'Foto Bersama Petarung & Promotor'
      ];
      return {
        categoryId: 'cat_weighin',
        title: weighTitles[idx % weighTitles.length] || `Sesi Face-off #${idx + 1}`,
        description: 'Sesi resmi timbang badan dan tatap muka mempertemukan dua petarung sebelum naik ring',
        takenAt: '2024-07-01 15:00:00'
      };
    } else {
      const vol3Titles = [
        'Kombinasi Pukulan Hook dan Straight',
        'Sorotan Pengadil & Timer Laga',
        'Penyerahan Sabuk & Medali Juara',
        'Pelukan Sportivitas Pasca Pertarungan',
        'Perayaan Kemenangan Bersama Tim Corner',
        'Sorak Antusias Suporter Temanggung',
        'Potret Jawara Malam Pertarungan TFN'
      ];
      return {
        categoryId: 'cat_vol3',
        title: vol3Titles[(idx - 7) % vol3Titles.length] || `Dokumentasi TFN Vol. 3 #${idx + 1}`,
        description: 'Momen heroik dan ketangguhan atlet combat sports bertanding di pentas Temanggung Fight Night',
        takenAt: '2024-07-02 22:30:00'
      };
    }
  }

  return {
    categoryId: 'cat_ring',
    title: `Dokumentasi Pertandingan TFN #${idx + 1}`,
    description: 'Galeri dokumentasi resmi Temanggung Fight Night',
    takenAt: '2024-07-02 20:00:00'
  };
}

async function main() {
  console.log('=== PROCESSING TFN GALLERY IMAGES ===');
  const files = fs.readdirSync(SOURCE_DIR).filter(f => !f.startsWith('.'));
  console.log(`Found ${files.length} images to compress and sync.`);

  let totalOrigBytes = 0;
  let totalCompBytes = 0;

  const galleryItems = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const srcPath = path.join(SOURCE_DIR, file);
    const destFilename = sanitizeFilename(file);
    const destPath = path.join(DEST_DIR, destFilename);

    const origStat = fs.statSync(srcPath);
    totalOrigBytes += origStat.size;

    console.log(`[${i + 1}/${files.length}] Compressing: ${file} -> ${destFilename}...`);

    await sharp(srcPath)
      .resize({
        width: 1600,
        height: 1200,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({
        quality: 82,
        effort: 4,
      })
      .toFile(destPath);

    const compStat = fs.statSync(destPath);
    totalCompBytes += compStat.size;

    const ratio = (((origStat.size - compStat.size) / origStat.size) * 100).toFixed(1);
    console.log(`   -> ${(origStat.size / 1024 / 1024).toFixed(2)} MB to ${(compStat.size / 1024).toFixed(0)} KB (-${ratio}%)`);

    const meta = getMetadataForFile(file, i);
    galleryItems.push({
      id: `item_gal_${String(i + 1).padStart(3, '0')}`,
      title: meta.title,
      description: meta.description,
      imageUrl: `/images/gallery/${destFilename}`,
      categoryId: meta.categoryId,
      sortOrder: i + 1,
      isActive: 1,
      takenAt: meta.takenAt,
    });
  }

  console.log('--------------------------------------------------');
  console.log(`ORIGINAL TOTAL: ${(totalOrigBytes / 1024 / 1024).toFixed(2)} MB`);
  console.log(`WEBP TOTAL:     ${(totalCompBytes / 1024 / 1024).toFixed(2)} MB`);
  console.log(`SAVINGS:        ${(((totalOrigBytes - totalCompBytes) / totalOrigBytes) * 100).toFixed(1)}%`);
  console.log('--------------------------------------------------');

  // Build SQL
  let sql = `-- =============================================================================\n`;
  sql += `-- TFN GALLERY SYNC SCRIPT\n`;
  sql += `-- Generated: ${new Date().toISOString()}\n`;
  sql += `-- =============================================================================\n\n`;

  sql += `-- 1. Pastikan Kategori Galeri Tersedia\n`;
  sql += `INSERT INTO \`gallerycategory\` (\`id\`, \`name\`, \`slug\`, \`description\`, \`sortOrder\`, \`isActive\`, \`createdAt\`, \`updatedAt\`)\nVALUES\n`;
  
  const catLines = CATEGORIES.map((c) => {
    return `  ('${c.id}', '${c.name.replace(/'/g, "''")}', '${c.slug}', '${c.description.replace(/'/g, "''")}', ${c.sortOrder}, 1, NOW(3), NOW(3))`;
  });
  sql += catLines.join(',\n') + '\n';
  sql += `ON DUPLICATE KEY UPDATE\n`;
  sql += `  \`name\` = VALUES(\`name\`),\n`;
  sql += `  \`slug\` = VALUES(\`slug\`),\n`;
  sql += `  \`description\` = VALUES(\`description\`),\n`;
  sql += `  \`sortOrder\` = VALUES(\`sortOrder\`),\n`;
  sql += `  \`isActive\` = VALUES(\`isActive\`),\n`;
  sql += `  \`updatedAt\` = NOW(3);\n\n`;

  sql += `-- 2. Sinkronisasi Seluruh Foto Galeri (42 Foto Terkompresi WebP)\n`;
  sql += `INSERT INTO \`galleryitem\` (\`id\`, \`title\`, \`description\`, \`imageUrl\`, \`categoryId\`, \`sortOrder\`, \`isActive\`, \`takenAt\`, \`createdAt\`, \`updatedAt\`)\nVALUES\n`;

  const itemLines = galleryItems.map((item) => {
    return `  ('${item.id}', '${item.title.replace(/'/g, "''")}', '${item.description.replace(/'/g, "''")}', '${item.imageUrl}', '${item.categoryId}', ${item.sortOrder}, ${item.isActive}, '${item.takenAt}', NOW(3), NOW(3))`;
  });
  sql += itemLines.join(',\n') + '\n';
  sql += `ON DUPLICATE KEY UPDATE\n`;
  sql += `  \`title\` = VALUES(\`title\`),\n`;
  sql += `  \`description\` = VALUES(\`description\`),\n`;
  sql += `  \`imageUrl\` = VALUES(\`imageUrl\`),\n`;
  sql += `  \`categoryId\` = VALUES(\`categoryId\`),\n`;
  sql += `  \`sortOrder\` = VALUES(\`sortOrder\`),\n`;
  sql += `  \`isActive\` = VALUES(\`isActive\`),\n`;
  sql += `  \`takenAt\` = VALUES(\`takenAt\`),\n`;
  sql += `  \`updatedAt\` = NOW(3);\n`;

  fs.writeFileSync(SQL_OUTPUT, sql, 'utf8');
  console.log(`SQL script saved to ${SQL_OUTPUT}`);

  // Execute into local DB
  console.log('Syncing into local MySQL database...');
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3306,
    user: 'boxing',
    password: '5sCSMIiwKWUNgHd8e6LrBX30',
    database: 'boxing',
    multipleStatements: true,
  });

  await conn.query(sql);
  console.log('Local MySQL database successfully updated with 42 gallery items & 5 categories!');
  await conn.end();
}

main().catch(console.error);
