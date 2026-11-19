const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

async function main() {
  const sql = fs.readFileSync(path.join(__dirname, 'sync_sponsors.sql'), 'utf8');
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3306,
    user: 'boxing',
    password: '5sCSMIiwKWUNgHd8e6LrBX30',
    database: 'boxing',
    multipleStatements: true
  });

  console.log('Running sync_sponsors.sql...');
  await conn.query(sql);

  const [rows] = await conn.query(`
    SELECT s.id, s.name, s.tier, s.sortOrder, s.isActive, m.url as logoUrl
    FROM sponsor s
    LEFT JOIN mediaasset m ON s.logoId = m.id
    ORDER BY s.sortOrder ASC
  `);
  console.log('Synced sponsors in DB:');
  console.table(rows);
  await conn.end();
}

main().catch(console.error);
