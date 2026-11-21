import "server-only";
import crypto from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/env";
import { logAudit } from "@/server/services/audit.service";
import {
  appendRegistrationRow,
  formatSheetDate,
  isSheetsConfigured,
  paintStatusRow,
  readRegistrationTabValues,
  SheetsWriteError,
  updateRegistrationStatusRow,
} from "@/server/google/sheets";
import {
  BPJS_LABELS,
  CLASS_LABELS,
  DIVISION_TO_WEIGHT_CLASS,
  FILE_RULES,
  RULES_LABELS,
  STATUS_LABELS,
  type RegistrationInput,
} from "@/lib/validation/registration";
import type { BpjsStatus, FighterRegistration, RegistrationStatus } from "@tfn/db";

/**
 * Pendaftaran fighter: DB = sumber kebenaran, Google Sheets = cermin.
 *
 * Alur simpan:
 *   1. Validasi file (magic bytes, ukuran) -> simpan ke storage/registrations (PRIVATE).
 *   2. Transaksi DB (baris registrasi + audit).
 *   3. Append baris ke Sheets. Kalau gagal: registrasi TETAP tersimpan, error dicatat
 *      di `sheetSyncError` dan bisa diulang admin lewat tombol "Sync ulang".
 */

const RANDOM_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // Crockford base32 (tanpa I/L/O/U)

function randomCode(length = 6): string {
  const bytes = crypto.randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i += 1) out += RANDOM_ALPHABET[(bytes[i] ?? 0) % RANDOM_ALPHABET.length];
  return out;
}

/** Ekstensi & mime yang dideteksi dari isi file (bukan dari nama file kiriman user). */
interface DetectedFile {
  mimeType: string;
  ext: string;
  kind: "IMAGE" | "PDF";
}

function detectFile(buffer: Buffer): DetectedFile | null {
  if (buffer.length < 8) return null;

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mimeType: "image/jpeg", ext: "jpg", kind: "IMAGE" };
  }
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { mimeType: "image/png", ext: "png", kind: "IMAGE" };
  }
  if (
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return { mimeType: "image/webp", ext: "webp", kind: "IMAGE" };
  }
  if (buffer.subarray(4, 8).toString("ascii") === "ftyp") {
    const brand = buffer.subarray(8, 12).toString("ascii");
    if (brand === "avif" || brand === "avis") return { mimeType: "image/avif", ext: "avif", kind: "IMAGE" };
  }
  // %PDF-
  if (buffer.subarray(0, 5).toString("ascii") === "%PDF-") {
    return { mimeType: "application/pdf", ext: "pdf", kind: "PDF" };
  }
  return null;
}

function sanitizeName(name: string, fallbackExt: string): string {
  const cleaned = name
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_{2,}/g, "_")
    .slice(0, 200);
  return cleaned || `berkas.${fallbackExt}`;
}

export class RegistrationFileError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
    this.name = "RegistrationFileError";
  }
}

interface StoredFile {
  relativePath: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
}

/** Simpan file privat di storage/registrations/<kode>/ (TIDAK dilayani route publik). */
async function storePrivateFile(
  file: File,
  kind: "paymentProof" | "idDocument",
  code: string,
): Promise<StoredFile> {
  const rule = FILE_RULES[kind];
  const maxBytes = Math.round(Math.min(rule.maxMb, env().REGISTRATION_MAX_FILE_MB) * 1024 * 1024);

  if (file.size === 0) throw new RegistrationFileError(`${rule.label} kosong`);
  if (file.size > maxBytes) {
    throw new RegistrationFileError(`${rule.label} melebihi batas ${rule.maxMb} MB`, 413);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const detected = detectFile(buffer);
  if (!detected) {
    throw new RegistrationFileError(`Format ${rule.label} tidak didukung (gunakan JPG, PNG, WebP, AVIF${kind === "paymentProof" ? ", atau PDF" : ""})`);
  }
  if (kind === "idDocument" && detected.kind === "PDF") {
    throw new RegistrationFileError("KTP/KK harus berupa gambar (JPG, PNG, WebP, AVIF)");
  }

  const dir = path.resolve(process.cwd(), "storage", "registrations", code);
  const filename = `${kind}-${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${detected.ext}`;
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, filename), buffer);

  return {
    relativePath: path.posix.join("registrations", code, filename),
    originalName: sanitizeName(file.name, detected.ext),
    mimeType: detected.mimeType,
    sizeBytes: buffer.byteLength,
  };
}

export function privateFilePath(relativePath: string): string | null {
  const root = path.resolve(process.cwd(), "storage");
  const resolved = path.resolve(root, relativePath);
  if (!resolved.startsWith(`${root}${path.sep}`)) return null;
  return resolved;
}

/** Petakan label divisi form ke WeightClass (best-effort; boleh null). */
async function resolveWeightClassId(divisionLabel: string): Promise<string | null> {
  const name = DIVISION_TO_WEIGHT_CLASS[divisionLabel];
  if (!name) return null;
  const wc = await prisma.weightClass.findFirst({
    where: { name, isActive: true },
    select: { id: true },
  });
  return wc?.id ?? null;
}

function sheetPayload(reg: FighterRegistration, confirmerName: string) {
  return {
    timestamp: reg.createdAt,
    fullName: reg.fullName,
    ringName: reg.ringName,
    address: reg.address,
    age: reg.age,
    divisionLabel: reg.divisionLabel,
    rulesLabel: RULES_LABELS[reg.rules] ?? reg.rules,
    classLabel: CLASS_LABELS[reg.competitionClass] ?? reg.competitionClass,
    bpjsLabel: BPJS_LABELS[reg.bpjsStatus] ?? reg.bpjsStatus,
    socialUrl: reg.socialUrl ?? "",
    instagramUrl: reg.instagramUrl ?? "",
    tiktokUrl: reg.tiktokUrl ?? "",
    facebookUrl: reg.facebookUrl ?? "",
    xUrl: reg.xUrl ?? "",
    paymentNote: `Transfer Bank — Rp${Number(reg.paymentAmount).toLocaleString("id-ID")}`,
    proofNote: reg.paymentProofPath ? `Terlampir: ${reg.paymentProofName ?? "bukti transfer"} (buka di admin TFN)` : "",
    consentLabel: reg.consentAccepted ? "Ya" : "Tidak",
    idDocumentNote: reg.idDocumentPath
      ? `Terlampir: ${reg.idDocumentName ?? "KTP/KK"} (buka di admin TFN)`
      : reg.bpjsStatus === "AKTIF"
        ? "Tidak perlu (BPJS aktif)"
        : "",
    statusLabel: STATUS_LABELS[reg.status] ?? reg.status,
    code: reg.code,
    confirmedBy: confirmerName,
    confirmedAtLabel: reg.confirmedAt ? formatSheetDate(reg.confirmedAt) : "",
  };
}

/** Kirim/tulis ulang satu baris registrasi ke Sheets. Melempar SheetsWriteError bila gagal. */
export async function syncRegistrationToSheet(id: string): Promise<{ rowNumber: number }> {
  const reg = await prisma.fighterRegistration.findUnique({
    where: { id },
    include: { confirmedBy: { select: { name: true } } },
  });
  if (!reg) throw new Error("Registrasi tidak ditemukan");

  const confirmerName = reg.confirmedBy?.name ?? "";

  try {
    if (reg.sheetRowNumber && reg.sheetRowNumber >= 2) {
      // Baris sudah ada: cukup perbarui kolom status lalu warnai ulang.
      await updateRegistrationStatusRow(reg.sheetRowNumber, {
        statusLabel: STATUS_LABELS[reg.status] ?? reg.status,
        code: reg.code,
        confirmedBy: confirmerName,
        confirmedAtLabel: reg.confirmedAt ? formatSheetDate(reg.confirmedAt) : "",
      });
      await paintStatusRow(reg.sheetRowNumber, reg.status).catch(() => undefined);
      const rowNumber = reg.sheetRowNumber;
      await prisma.fighterRegistration.update({
        where: { id },
        data: { sheetSyncedAt: new Date(), sheetSyncError: null },
      });
      return { rowNumber };
    }

    const { rowNumber } = await appendRegistrationRow(sheetPayload(reg, confirmerName));
    await prisma.fighterRegistration.update({
      where: { id },
      data: { sheetRowNumber: rowNumber, sheetSyncedAt: new Date(), sheetSyncError: null },
    });
    return { rowNumber };
  } catch (err) {
    const message =
      err instanceof SheetsWriteError ? `[${err.code}] ${err.message}` : (err as Error).message ?? "Gagal sinkron";
    await prisma.fighterRegistration.update({
      where: { id },
      data: { sheetSyncError: message.slice(0, 2000) },
    });
    throw err;
  }
}

export interface CreateRegistrationResult {
  registration: FighterRegistration;
  sheetSynced: boolean;
  sheetError: string | null;
}

export async function createFighterRegistration(params: {
  input: RegistrationInput;
  paymentProof: File | null;
  idDocument: File | null;
  ipAddress: string | null;
  userAgent: string | null;
}): Promise<CreateRegistrationResult> {
  const { input } = params;

  if (!params.paymentProof) {
    throw new RegistrationFileError("Bukti transfer wajib diunggah");
  }
  if (input.bpjsStatus === "TIDAK_AKTIF" && !params.idDocument) {
    throw new RegistrationFileError("KTP/Kartu Keluarga wajib diunggah karena BPJS belum aktif");
  }

  // Kode unik dengan retry (sangat jarang bentrok).
  let code = `TFN-R-${randomCode()}`;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const exists = await prisma.fighterRegistration.findUnique({ where: { code }, select: { id: true } });
    if (!exists) break;
    code = `TFN-R-${randomCode(attempt + 7)}`;
  }

  const paymentProof = await storePrivateFile(params.paymentProof, "paymentProof", code);
  const idDocument = params.idDocument ? await storePrivateFile(params.idDocument, "idDocument", code) : null;
  const weightClassId = await resolveWeightClassId(input.divisionLabel);

  const registration = await prisma.fighterRegistration.create({
    data: {
      code,
      fullName: input.fullName,
      ringName: input.ringName,
      address: input.address,
      age: input.age,
      divisionLabel: input.divisionLabel,
      weightClassId,
      rules: input.rules,
      competitionClass: input.competitionClass,
      bpjsStatus: input.bpjsStatus as BpjsStatus,
      socialUrl: input.socialUrl ?? null,
      instagramUrl: input.instagramUrl ?? null,
      tiktokUrl: input.tiktokUrl ?? null,
      facebookUrl: input.facebookUrl ?? null,
      xUrl: input.xUrl ?? null,
      paymentAmount: env().REGISTRATION_FEE_IDR,
      paymentProofPath: paymentProof.relativePath,
      paymentProofName: paymentProof.originalName,
      paymentProofMime: paymentProof.mimeType,
      paymentProofBytes: paymentProof.sizeBytes,
      idDocumentPath: idDocument?.relativePath ?? null,
      idDocumentName: idDocument?.originalName ?? null,
      idDocumentMime: idDocument?.mimeType ?? null,
      idDocumentBytes: idDocument?.sizeBytes ?? null,
      consentAccepted: true,
      consentAcceptedAt: new Date(),
      status: "PENDING",
      ipAddress: params.ipAddress,
      userAgent: params.userAgent?.slice(0, 255) ?? null,
    },
  });

  await logAudit({
    action: "registration.create",
    entityType: "FighterRegistration",
    entityId: registration.id,
    summary: `Pendaftaran baru ${registration.code} — ${registration.ringName} (${registration.divisionLabel})`,
    metadata: {
      code: registration.code,
      rules: registration.rules,
      competitionClass: registration.competitionClass,
      bpjsStatus: registration.bpjsStatus,
      divisionLabel: registration.divisionLabel,
    },
  });

  // Sinkron Sheets tidak boleh menggagalkan pendaftaran.
  let sheetSynced = false;
  let sheetError: string | null = null;
  try {
    await syncRegistrationToSheet(registration.id);
    sheetSynced = true;
  } catch (err) {
    sheetError = (err as Error).message;
    console.error("[registration] sheet sync gagal:", err);
  }

  const fresh = await prisma.fighterRegistration.findUniqueOrThrow({ where: { id: registration.id } });
  return { registration: fresh, sheetSynced, sheetError };
}

export interface RegistrationActor {
  id: string;
  name: string;
}

export async function confirmFighterRegistration(
  id: string,
  actor: RegistrationActor,
  notes?: string | null,
): Promise<FighterRegistration> {
  const existing = await prisma.fighterRegistration.findUnique({ where: { id } });
  if (!existing) throw new Error("Registrasi tidak ditemukan");
  if (existing.status === "CONFIRMED") return existing;

  const updated = await prisma.fighterRegistration.update({
    where: { id },
    data: {
      status: "CONFIRMED",
      confirmedById: actor.id,
      confirmedAt: new Date(),
      rejectionReason: null,
      reviewNotes: notes?.slice(0, 2000) ?? existing.reviewNotes,
    },
  });

  await logAudit({
    action: "registration.confirm",
    entityType: "FighterRegistration",
    entityId: id,
    summary: `Konfirmasi ${updated.code} — ${updated.ringName} oleh ${actor.name}`,
    metadata: { code: updated.code, previousStatus: existing.status },
  });

  await syncRegistrationToSheet(id).catch((err) => console.error("[registration] sheet update gagal:", err));
  return prisma.fighterRegistration.findUniqueOrThrow({ where: { id } });
}

export async function rejectFighterRegistration(
  id: string,
  actor: RegistrationActor,
  reason: string,
): Promise<FighterRegistration> {
  const existing = await prisma.fighterRegistration.findUnique({ where: { id } });
  if (!existing) throw new Error("Registrasi tidak ditemukan");

  const updated = await prisma.fighterRegistration.update({
    where: { id },
    data: {
      status: "REJECTED",
      confirmedById: actor.id,
      confirmedAt: new Date(),
      rejectionReason: reason.trim().slice(0, 500),
    },
  });

  await logAudit({
    action: "registration.reject",
    entityType: "FighterRegistration",
    entityId: id,
    summary: `Tolak ${updated.code} — ${updated.ringName} oleh ${actor.name}`,
    metadata: { code: updated.code, reason: updated.rejectionReason },
  });

  await syncRegistrationToSheet(id).catch((err) => console.error("[registration] sheet update gagal:", err));
  return prisma.fighterRegistration.findUniqueOrThrow({ where: { id } });
}

export interface ListParams {
  status?: RegistrationStatus | "ALL";
  query?: string;
  take?: number;
}

export async function listFighterRegistrations(params: ListParams = {}) {
  const take = Math.min(params.take ?? 100, 200);
  const q = params.query?.trim();
  return prisma.fighterRegistration.findMany({
    where: {
      ...(params.status && params.status !== "ALL" ? { status: params.status } : {}),
      ...(q
        ? {
            OR: [
              { fullName: { contains: q } },
              { ringName: { contains: q } },
              { code: { contains: q } },
              { divisionLabel: { contains: q } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take,
    include: { confirmedBy: { select: { name: true } }, weightClass: { select: { name: true } } },
  });
}

export async function getFighterRegistration(id: string) {
  return prisma.fighterRegistration.findUnique({
    where: { id },
    include: { confirmedBy: { select: { name: true } }, weightClass: { select: { name: true } } },
  });
}

/** Ringkasan untuk badge dashboard admin. */
export async function getRegistrationStats() {
  const [pending, confirmed, rejected, total] = await Promise.all([
    prisma.fighterRegistration.count({ where: { status: "PENDING" } }),
    prisma.fighterRegistration.count({ where: { status: "CONFIRMED" } }),
    prisma.fighterRegistration.count({ where: { status: "REJECTED" } }),
    prisma.fighterRegistration.count(),
  ]);
  return { pending, confirmed, rejected, total };
}

export function sheetsConfigured(): boolean {
  return isSheetsConfigured();
}

/**
 * Tarik data pendaftaran dari Google Sheets ke database lokal TFN.
 * Untuk lampiran gambar (bukti transfer & KTP): diset string "yes" jika ada link/isi, "no" / null jika kosong.
 */
export async function pullRegistrationsFromSheet(): Promise<{
  totalRows: number;
  imported: number;
  updated: number;
  errors: string[];
}> {
  if (!isSheetsConfigured()) {
    throw new Error("Google Sheets belum dikonfigurasi (service account atau REGISTRATION_SHEET_ID kosong)");
  }

  const rawValues = await readRegistrationTabValues();
  if (rawValues.length < 2) {
    return { totalRows: 0, imported: 0, updated: 0, errors: [] };
  }

  // Baris pertama (index 0) adalah header
  const header = rawValues[0]?.map((h) => (h ?? "").trim().toLowerCase()) ?? [];

  // Cari kolom sistem jika ada
  const statusCol = header.findIndex((h) => h.includes("status (sistem)") || h === "status");
  const codeCol = header.findIndex(
    (h) => h.includes("kode (sistem)") || h.includes("kode referensi") || h === "kode" || h.includes("code")
  );

  let imported = 0;
  let updated = 0;
  const errors: string[] = [];

  for (let i = 1; i < rawValues.length; i++) {
    const row = rawValues[i];
    const rowNumber = i + 1; // 1-based index di Google Sheets

    if (!row || row.every((c) => !c || c.trim() === "")) continue;

    try {
      const fullName = (row[1] ?? "").trim();
      if (!fullName) continue;

      const ringName = (row[2] ?? "").trim() || fullName;
      const address = (row[3] ?? "").trim() || "Temanggung";
      const ageNum = parseInt((row[4] ?? "").trim(), 10);
      const age = Number.isNaN(ageNum) || ageNum <= 0 ? 20 : ageNum;
      const divisionLabel = (row[5] ?? "").trim() || "Bebas";

      const rulesRaw = (row[6] ?? "").trim().toUpperCase();
      const rules = rulesRaw.includes("KICK") ? "KICKBOXING" : "BOXING";

      const classRaw = (row[7] ?? "").trim().toUpperCase();
      const competitionClass = classRaw.includes("PEMULA")
        ? "PEMULA"
        : classRaw.includes("NON")
          ? "NON_ATLET"
          : "ATLET";

      const bpjsRaw = (row[8] ?? "").trim().toUpperCase();
      const bpjsStatus = bpjsRaw.includes("TIDAK") || bpjsRaw.includes("NON")
        ? "TIDAK_AKTIF"
        : "AKTIF";

      const socialUrl = (row[9] ?? "").trim() || null;
      const instagramUrl = (row[10] ?? "").trim() || null;
      const tiktokUrl = (row[11] ?? "").trim() || null;
      const facebookUrl = (row[12] ?? "").trim() || null;
      const xUrl = (row[13] ?? "").trim() || null;

      // Lampiran gambar: jika ada isi diset string "yes", jika kosong diset "no" / null
      const proofRaw = (row[15] ?? "").trim();
      const hasProof =
        proofRaw.length > 0 &&
        !["-", "tidak", "tidak ada", "no", "false"].includes(proofRaw.toLowerCase());
      const paymentProofPath = hasProof ? (proofRaw.startsWith("http") ? proofRaw : "yes") : null;
      const paymentProofName = hasProof ? "yes" : "no";

      const idDocRaw = (row[17] ?? "").trim();
      const hasIdDoc =
        idDocRaw.length > 0 &&
        !["-", "tidak", "tidak ada", "no", "false"].includes(idDocRaw.toLowerCase());
      const idDocumentPath = hasIdDoc ? (idDocRaw.startsWith("http") ? idDocRaw : "yes") : null;
      const idDocumentName = hasIdDoc ? "yes" : "no";

      // Kode pendaftaran
      let code = "";
      if (codeCol >= 0 && row[codeCol]?.trim()) {
        code = row[codeCol]!.trim();
      } else {
        const found = row.find((c) => c && c.trim().startsWith("TFN-R-"));
        if (found) code = found.trim();
      }
      if (!code) {
        code = `TFN-R-${randomCode(6)}`;
      }

      // Status
      let status: "PENDING" | "CONFIRMED" | "REJECTED" = "PENDING";
      if (statusCol >= 0 && row[statusCol]?.trim()) {
        const sRaw = row[statusCol]!.trim().toUpperCase();
        if (sRaw.includes("CONFIRM") || sRaw.includes("KONFIRMASI")) status = "CONFIRMED";
        else if (sRaw.includes("REJECT") || sRaw.includes("TOLAK")) status = "REJECTED";
      }

      // Timestamp
      let createdAt = new Date();
      if (row[0]?.trim()) {
        const d = new Date(row[0].trim());
        if (!Number.isNaN(d.getTime())) createdAt = d;
      }

      const weightClassId = await resolveWeightClassId(divisionLabel);

      const existing = await prisma.fighterRegistration.findFirst({
        where: {
          OR: [
            { code },
            { fullName, ringName, divisionLabel },
          ],
        },
      });

      if (existing) {
        await prisma.fighterRegistration.update({
          where: { id: existing.id },
          data: {
            sheetRowNumber: rowNumber,
            sheetSyncedAt: new Date(),
            sheetSyncError: null,
            ...(paymentProofPath && !existing.paymentProofPath ? { paymentProofPath, paymentProofName } : {}),
            ...(idDocumentPath && !existing.idDocumentPath ? { idDocumentPath, idDocumentName } : {}),
          },
        });
        updated += 1;
      } else {
        await prisma.fighterRegistration.create({
          data: {
            code,
            fullName,
            ringName,
            address,
            age,
            divisionLabel,
            weightClassId,
            rules: rules as any,
            competitionClass: competitionClass as any,
            bpjsStatus: bpjsStatus as any,
            socialUrl,
            instagramUrl,
            tiktokUrl,
            facebookUrl,
            xUrl,
            paymentAmount: 200000,
            paymentProofPath,
            paymentProofName,
            idDocumentPath,
            idDocumentName,
            consentAccepted: true,
            consentAcceptedAt: createdAt,
            status,
            sheetRowNumber: rowNumber,
            sheetSyncedAt: new Date(),
            createdAt,
          },
        });
        imported += 1;
      }
    } catch (rowErr) {
      errors.push(`Baris ${rowNumber}: ${(rowErr as Error).message}`);
    }
  }

  return {
    totalRows: rawValues.length - 1,
    imported,
    updated,
    errors,
  };
}
