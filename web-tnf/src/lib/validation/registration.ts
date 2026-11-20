import { z } from "zod";

/**
 * Kontrak pendaftaran fighter — dipakai bersama oleh form publik (client) dan API (server).
 * Nilai label sengaja identik dengan Google Form supaya baris di Sheets konsisten.
 */

export const DIVISIONS = [
  "51 kg – 53 Kg Bantamweight",
  "54 kg – 56 Kg Featherweight",
  "57 kg – 59 Kg Super Featherweight",
  "60 kg – 63 Kg Light Welterweight",
  "64 kg – 66 Kg Welterweight",
  "67 kg – 69 Kg Light Middleweight",
  "70 kg – 74 Kg Middleweight",
  "75 kg – 79 Kg Light Heavyweight",
  "80 kg – 84 Kg Cruiserweight",
  "85+ Kg Heavyweight",
  "91+ Kg Super Heavyweight",
] as const;

export type DivisionLabel = (typeof DIVISIONS)[number];

export const RULES = [
  { value: "BOXING", label: "Boxing" },
  { value: "KICKBOXING", label: "Kickboxing" },
] as const;

export const CLASSES = [
  { value: "ATLET", label: "Atlet" },
  { value: "PEMULA", label: "Pemula" },
  { value: "NON_ATLET", label: "Non Atlet" },
] as const;

export const BPJS_OPTIONS = [
  { value: "AKTIF", label: "Aktif" },
  { value: "TIDAK_AKTIF", label: "Tidak Aktif" },
] as const;

export const STATUS_LABELS: Record<string, string> = {
  PENDING: "Menunggu Konfirmasi",
  CONFIRMED: "Terkonfirmasi",
  REJECTED: "Ditolak",
};

export const RULES_LABELS: Record<string, string> = { BOXING: "Boxing", KICKBOXING: "Kickboxing" };
export const CLASS_LABELS: Record<string, string> = { ATLET: "Atlet", PEMULA: "Pemula", NON_ATLET: "Non Atlet" };
export const BPJS_LABELS: Record<string, string> = { AKTIF: "Aktif", TIDAK_AKTIF: "Tidak Aktif" };

/** Nama WeightClass di DB yang bisa dipetakan dari label divisi form. */
export const DIVISION_TO_WEIGHT_CLASS: Record<string, string> = {
  "51 kg – 53 Kg Bantamweight": "Bantamweight",
  "54 kg – 56 Kg Featherweight": "Featherweight",
  "57 kg – 59 Kg Super Featherweight": "Super Featherweight",
  "60 kg – 63 Kg Light Welterweight": "Light Welterweight",
  "64 kg – 66 Kg Welterweight": "Welterweight",
  "67 kg – 69 Kg Light Middleweight": "Light Middleweight",
  "70 kg – 74 Kg Middleweight": "Middleweight",
  "75 kg – 79 Kg Light Heavyweight": "Light Heavyweight",
  "80 kg – 84 Kg Cruiserweight": "Cruiserweight",
  "85+ Kg Heavyweight": "Heavyweight",
  "91+ Kg Super Heavyweight": "Super Heavyweight",
};

const optionalUrl = z
  .string()
  .trim()
  .max(500)
  .optional()
  .transform((v) => (v && v.length > 0 ? v : undefined))
  .refine((v) => v === undefined || /^https?:\/\/[^\s]+$/i.test(v), {
    message: "Link harus diawali http:// atau https://",
  });

export const registrationInputSchema = z.object({
  fullName: z.string().trim().min(3, "Nama lengkap minimal 3 karakter").max(120),
  ringName: z.string().trim().min(2, "Nama fighter minimal 2 karakter").max(120),
  address: z.string().trim().min(10, "Alamat terlalu pendek").max(1000),
  age: z.coerce
    .number()
    .int("Usia harus bilangan bulat")
    .min(15, "Usia minimal 15 tahun")
    .max(70, "Usia maksimal 70 tahun"),
  divisionLabel: z.enum(DIVISIONS, { message: "Pilih divisi" }),
  rules: z.enum(["BOXING", "KICKBOXING"], { message: "Pilih kategori rules" }),
  competitionClass: z.enum(["ATLET", "PEMULA", "NON_ATLET"], { message: "Pilih kelas" }),
  bpjsStatus: z.enum(["AKTIF", "TIDAK_AKTIF"], { message: "Pilih status BPJS" }),
  socialUrl: optionalUrl,
  instagramUrl: optionalUrl,
  tiktokUrl: optionalUrl,
  facebookUrl: optionalUrl,
  xUrl: optionalUrl,
  /// Persetujuan aturan — wajib true
  consentAccepted: z
    .union([z.boolean(), z.literal("true"), z.literal("on"), z.literal("1")])
    .transform((v) => v === true || v === "true" || v === "on" || v === "1")
    .refine((v) => v === true, { message: "Anda harus menyetujui pernyataan aturan pertandingan" }),
});

export type RegistrationInput = z.infer<typeof registrationInputSchema>;

/** Batas ukuran & tipe file (harus selaras dengan nilai di Google Form). */
export const FILE_RULES = {
  paymentProof: {
    label: "Bukti transfer",
    maxMb: 10,
    accept: "image/jpeg,image/png,image/webp,image/avif,application/pdf",
  },
  idDocument: {
    label: "KTP / Kartu Keluarga",
    maxMb: 10,
    accept: "image/jpeg,image/png,image/webp,image/avif",
  },
} as const;

export function formatIdr(amount: number): string {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(
    amount,
  );
}
