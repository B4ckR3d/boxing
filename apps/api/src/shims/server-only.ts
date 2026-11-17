/**
 * Shim paket `server-only` untuk `apps/api`.
 *
 * Paket aslinya melempar error kecuali di-resolve dengan kondisi `react-server` (itu penanda
 * bundler Next, bukan penjaga runtime). Di API tidak ada Client Component, jadi shim kosong ini
 * setara — dan menghindari keharusan menjalankan seluruh layanan dengan `--conditions=react-server`.
 */
export {};
