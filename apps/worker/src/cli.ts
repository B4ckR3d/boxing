import path from "node:path";
import { config as loadEnv } from "dotenv";

// .env tunggal di root repo — dimuat sebelum modul web (yang memvalidasi env saat diimpor).
loadEnv({ path: path.resolve(import.meta.dirname, "../../../.env") });

const COMMANDS = ["expire-holds"] as const;
type Command = (typeof COMMANDS)[number];

function usage(): string {
  return (
    "Pemakaian: tsx src/cli.ts <command> [--verbose]\n\n" +
    "Command:\n" +
    "  expire-holds   Batalkan pesanan PENDING yang melewati TICKET_HOLD_EXPIRY_HOURS\n\n" +
    "Opsi:\n" +
    "  --verbose      Selalu cetak ringkasan, termasuk saat tidak ada yang kedaluwarsa.\n" +
    "                 Untuk memverifikasi job benar-benar menyentuh database (mis. setelah deploy).\n"
  );
}

async function main(argv: string[]): Promise<number> {
  const verbose = argv.includes("--verbose");
  const command = argv.find((a) => !a.startsWith("-")) as Command | undefined;
  if (!command || !COMMANDS.includes(command)) {
    process.stderr.write(usage());
    return 2;
  }

  // Impor dinamis supaya .env sudah termuat sebelum `@/lib/env` memvalidasi.
  const { runExpireHolds } = await import("./jobs/expire-holds");
  const result = await runExpireHolds();

  // Disiplin keluaran: diam kalau tidak ada yang kedaluwarsa (cron mail yang kosong = baik).
  // `--verbose` menembus aturan itu secara sengaja: dipakai untuk membuktikan job benar-benar
  // berjalan dan menyentuh database, bukan hanya keluar dengan kode 0.
  if (result.noteworthy || verbose) {
    for (const line of result.lines) process.stdout.write(`${line}\n`);
    if (result.noteworthy) {
      process.stdout.write("[expire-holds] reminder: pembeli memegang token lama; /tickets/status kini menampilkan DIBATALKAN.\n");
    }
  }
  return 0;
}

main(process.argv.slice(2))
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    process.stderr.write(`[worker] gagal: ${error instanceof Error ? error.message : String(error)}\n`);
    if (error instanceof Error && error.stack) process.stderr.write(`${error.stack}\n`);
    process.exit(1);
  });
