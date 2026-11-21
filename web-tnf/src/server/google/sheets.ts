import "server-only";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { env } from "@/lib/env";

/**
 * Klien Google Sheets minimal (JWT service account + REST v4), tanpa dependency tambahan.
 *
 * Kenapa implementasi sendiri: repo tidak memakai `googleapis`, dan yang dibutuhkan hanya
 * append/update/format satu spreadsheet. Menandatangani JWT RS256 bisa dilakukan `node:crypto`.
 *
 * Sifat integrasi: DB adalah sumber kebenaran. Sheets hanya cermin, jadi setiap kegagalan
 * Google dilempar sebagai `SheetsError` dan ditangkap pemanggil (baris DB tetap tersimpan).
 */

const SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";
const SCOPE_SHEETS = "https://www.googleapis.com/auth/spreadsheets";

/** Header tambahan yang kita kelola sendiri (kolom S..V) — bukan bagian form Google. */
export const EXTRA_HEADERS = [
  "Status (Sistem)",
  "Kode Pendaftaran (Sistem)",
  "Diverifikasi Oleh (Sistem)",
  "Waktu Verifikasi (Sistem)",
] as const;

/**
 * Kolom sistem TIDAK boleh hardcode ke S..V: tab "Form Responses 1" milik TFN x PIMPOM
 * punya blok pertanyaan duplikat sampai kolom AG, jadi status harus diletakkan setelah
 * kolom form terakhir. Nilainya dideteksi sekali lalu di-cache per proses.
 */
let cachedStatusStart: number | null = null;

/** Warna baris sesuai status konfirmasi (dipakai juga oleh badge UI admin). */
const STATUS_COLORS: Record<string, { red: number; green: number; blue: number }> = {
  // amber lembut
  PENDING: { red: 1, green: 0.95, blue: 0.8 },
  // hijau lembut
  CONFIRMED: { red: 0.85, green: 0.96, blue: 0.88 },
  // merah lembut
  REJECTED: { red: 0.99, green: 0.87, blue: 0.86 },
};

export class SheetsWriteError extends Error {
  constructor(
    message: string,
    readonly code: "NOT_CONFIGURED" | "AUTH" | "PERMISSION" | "API" | "NETWORK",
  ) {
    super(message);
    this.name = "SheetsWriteError";
  }
}

interface ServiceAccount {
  client_email: string;
  private_key: string;
  token_uri: string;
}

interface CachedToken {
  accessToken: string;
  expiresAt: number;
}

let cachedToken: CachedToken | null = null;

function loadServiceAccount(): ServiceAccount | null {
  const cfg = env();
  try {
    if (cfg.GOOGLE_SA_JSON && cfg.GOOGLE_SA_JSON.trim().startsWith("{")) {
      return JSON.parse(cfg.GOOGLE_SA_JSON) as ServiceAccount;
    }
  } catch {
    throw new SheetsWriteError("GOOGLE_SA_JSON tidak bisa diparse sebagai JSON", "AUTH");
  }

  const filePath = path.isAbsolute(cfg.GOOGLE_SA_KEY_FILE)
    ? cfg.GOOGLE_SA_KEY_FILE
    : path.resolve(process.cwd(), cfg.GOOGLE_SA_KEY_FILE);

  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw) as ServiceAccount;
  } catch {
    return null;
  }
}

export function isSheetsConfigured(): boolean {
  if (!env().REGISTRATION_SHEET_ID) return false;
  return loadServiceAccount() !== null;
}

const b64url = (input: string | Buffer): string =>
  Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.accessToken;

  const sa = loadServiceAccount();
  if (!sa) throw new SheetsWriteError("Service account Google belum dikonfigurasi", "NOT_CONFIGURED");

  const iat = Math.floor(Date.now() / 1000);
  const unsigned = `${b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: SCOPE_SHEETS,
      aud: sa.token_uri,
      iat,
      exp: iat + 3600,
    }),
  )}`;
  const signature = b64url(crypto.createSign("RSA-SHA256").update(unsigned).sign(sa.private_key));

  let response: Response;
  try {
    response = await fetch(sa.token_uri, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: `${unsigned}.${signature}`,
      }),
      cache: "no-store",
    });
  } catch (err) {
    throw new SheetsWriteError(`Gagal menghubungi Google OAuth: ${(err as Error).message}`, "NETWORK");
  }

  const payload = (await response.json().catch(() => null)) as
    | { access_token?: string; expires_in?: number; error_description?: string }
    | null;

  if (!response.ok || !payload?.access_token) {
    throw new SheetsWriteError(
      `Google OAuth menolak kredensial (${response.status}): ${payload?.error_description ?? "unknown"}`,
      "AUTH",
    );
  }

  cachedToken = {
    accessToken: payload.access_token,
    expiresAt: Date.now() + (payload.expires_in ?? 3600) * 1000,
  };
  return cachedToken.accessToken;
}

async function sheetsFetch(pathname: string, init: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken();
  let response: Response;
  try {
    response = await fetch(`${SHEETS_API}${pathname}`, {
      ...init,
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        ...(init.headers ?? {}),
      },
      cache: "no-store",
    });
  } catch (err) {
    throw new SheetsWriteError(`Gagal menghubungi Google Sheets: ${(err as Error).message}`, "NETWORK");
  }
  return response;
}

async function readErrorBody(response: Response): Promise<string> {
  const body = await response.text().catch(() => "");
  return body.slice(0, 400) || response.statusText;
}

/** Range A1 notation untuk sheet aktif. */
function a1(range: string): string {
  return `'${env().REGISTRATION_SHEET_TAB.replace(/'/g, "''")}'!${range}`;
}

export interface SheetRegistrationInput {
  timestamp: Date;
  fullName: string;
  ringName: string;
  address: string;
  age: number;
  divisionLabel: string;
  rulesLabel: string;
  classLabel: string;
  bpjsLabel: string;
  socialUrl: string;
  instagramUrl: string;
  tiktokUrl: string;
  facebookUrl: string;
  xUrl: string;
  paymentNote: string;
  proofNote: string;
  consentLabel: string;
  idDocumentNote: string;
  statusLabel: string;
  code: string;
  confirmedBy: string;
  confirmedAtLabel: string;
}

const pad = (value: number) => String(value).padStart(2, "0");

/** Tanggal/jam WIB (Asia/Jakarta) dalam format yang enak dibaca di Sheets. */
export function formatSheetDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${pad(Number(get("month")))}-${pad(Number(get("day")))} ${get("hour")}:${get(
    "minute",
  )}:${get("second")}`;
}

/** Huruf kolom A1-style dari index 0-based (0=A, 25=Z, 26=AA, ...). */
function columnLetter(index0: number): string {
  let n = index0 + 1;
  let out = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

/**
 * Cari kolom awal blok sistem: kolom pertama yang header-nya "Status (Sistem)",
 * atau (bila belum ada) tepat setelah kolom header terakhir yang terisi.
 */
async function resolveStatusColumnStart(): Promise<number> {
  if (cachedStatusStart !== null) return cachedStatusStart;

  const response = await sheetsFetch(
    `/${env().REGISTRATION_SHEET_ID}/values/${encodeURIComponent(a1("A1:BZ1"))}`,
  );
  if (!response.ok) {
    throw new SheetsWriteError(`Baca header spreadsheet gagal (${response.status})`, "API");
  }
  const payload = (await response.json()) as { values?: string[][] };
  const header = payload.values?.[0] ?? [];

  const existing = header.findIndex((cell) => (cell ?? "").trim() === EXTRA_HEADERS[0]);
  if (existing >= 0) {
    cachedStatusStart = existing;
    return existing;
  }

  let lastFilled = -1;
  header.forEach((cell, index) => {
    if ((cell ?? "").trim().length > 0) lastFilled = index;
  });
  const start = Math.max(lastFilled + 1, 18); // minimal setelah 18 kolom form asli

  const range = `${columnLetter(start)}1:${columnLetter(start + EXTRA_HEADERS.length - 1)}1`;
  await sheetsFetch(
    `/${env().REGISTRATION_SHEET_ID}/values/${encodeURIComponent(a1(range))}?valueInputOption=RAW`,
    { method: "PUT", body: JSON.stringify({ values: [[...EXTRA_HEADERS]] }) },
  ).catch(() => undefined);

  cachedStatusStart = start;
  return start;
}

/**
 * Susun satu baris: 18 kolom form (A..R) + padding sampai blok sistem, lalu 4 kolom sistem.
 * Padding penting supaya nilai status tidak pernah menimpa kolom pertanyaan duplikat.
 */
function rowValues(input: SheetRegistrationInput, statusStart: number): (string | number)[][] {
  const base: (string | number)[] = [
    formatSheetDate(input.timestamp), // A Timestamp
    input.fullName,
    input.ringName,
    input.address,
    input.age,
    input.divisionLabel,
    input.rulesLabel,
    input.classLabel,
    input.bpjsLabel,
    input.socialUrl,
    input.instagramUrl,
    input.tiktokUrl,
    input.facebookUrl,
    input.xUrl,
    input.paymentNote,
    input.proofNote,
    input.consentLabel,
    input.idDocumentNote,
  ];

  const total = statusStart + EXTRA_HEADERS.length;
  const row: (string | number)[] = new Array(total).fill("");
  base.forEach((value, index) => {
    if (index < total) row[index] = value;
  });
  row[statusStart] = input.statusLabel;
  row[statusStart + 1] = input.code;
  row[statusStart + 2] = input.confirmedBy ?? "";
  row[statusStart + 3] = input.confirmedAtLabel ?? "";

  return [row];
}

/**
 * Pastikan header blok sistem ada (dipakai juga oleh halaman admin untuk diagnosa).
 * Idempoten: kolom dideteksi dari header, bukan dari posisi tetap.
 */
export async function ensureExtraHeaders(): Promise<void> {
  if (!isSheetsConfigured()) return;
  await resolveStatusColumnStart().catch(() => undefined);
}

/** Ambil sheetId numerik (dibutuhkan batchUpdate untuk pewarnaan baris). */
async function getSheetId(): Promise<number> {
  const response = await sheetsFetch(
    `/${env().REGISTRATION_SHEET_ID}?fields=sheets.properties(sheetId,title)`,
  );
  if (!response.ok) {
    throw new SheetsWriteError(`Baca metadata spreadsheet gagal (${response.status})`, "API");
  }
  const payload = (await response.json()) as {
    sheets?: { properties?: { sheetId?: number; title?: string } }[];
  };
  const found = payload.sheets?.find((s) => s.properties?.title === env().REGISTRATION_SHEET_TAB);
  if (!found?.properties?.sheetId && found?.properties?.sheetId !== 0) {
    throw new SheetsWriteError(`Tab "${env().REGISTRATION_SHEET_TAB}" tidak ditemukan di spreadsheet`, "API");
  }
  return found.properties.sheetId as number;
}

/** Warnai satu baris sesuai status (A..akhir blok sistem). Tidak fatal: error diabaikan pemanggil. */
export async function paintStatusRow(rowNumber: number, status: string): Promise<void> {
  if (!isSheetsConfigured() || rowNumber < 2) return;
  const color = STATUS_COLORS[status];
  if (!color) return;

  const statusStart = await resolveStatusColumnStart();
  const sheetId = await getSheetId();
  const response = await sheetsFetch(`/${env().REGISTRATION_SHEET_ID}:batchUpdate`, {
    method: "POST",
    body: JSON.stringify({
      requests: [
        {
          repeatCell: {
            range: {
              sheetId,
              startRowIndex: rowNumber - 1,
              endRowIndex: rowNumber,
              startColumnIndex: 0,
              endColumnIndex: statusStart + EXTRA_HEADERS.length,
            },
            cell: { userEnteredFormat: { backgroundColor: color } },
            fields: "userEnteredFormat.backgroundColor",
          },
        },
      ],
    }),
  });
  if (!response.ok) {
    throw new SheetsWriteError(`Pewarnaan baris gagal (${response.status}): ${await readErrorBody(response)}`, "API");
  }
}

/**
 * Tambah satu baris pendaftaran. Mengembalikan nomor baris (1-based) supaya bisa dipakai
 * untuk update status & pewarnaan berikutnya.
 */
export async function appendRegistrationRow(
  input: SheetRegistrationInput,
): Promise<{ rowNumber: number }> {
  if (!isSheetsConfigured()) {
    throw new SheetsWriteError("Google Sheets belum dikonfigurasi (service account / sheet id kosong)", "NOT_CONFIGURED");
  }

  const statusStart = await resolveStatusColumnStart();

  const response = await sheetsFetch(
    `/${env().REGISTRATION_SHEET_ID}/values/${encodeURIComponent(
      a1("A1:R1"),
    )}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    { method: "POST", body: JSON.stringify({ values: rowValues(input, statusStart) }) },
  );

  if (!response.ok) {
    const body = await readErrorBody(response);
    const kind = response.status === 403 ? "PERMISSION" : "API";
    throw new SheetsWriteError(
      response.status === 403
        ? `Akses tulis ditolak (403). Pastikan sheet di-share sebagai Editor ke service account. Detail: ${body}`
        : `Append baris gagal (${response.status}): ${body}`,
      kind,
    );
  }

  const payload = (await response.json()) as { updates?: { updatedRange?: string } };
  const updatedRange = payload.updates?.updatedRange ?? "";
  const match = /!\S*?(\d+):/i.exec(updatedRange) ?? /(\d+)/.exec(updatedRange.replace(/.*!/, ""));
  const rowNumber = match ? Number(match[1]) : 0;

  if (!rowNumber) {
    throw new SheetsWriteError(`Append berhasil tapi nomor baris tidak terbaca (${updatedRange})`, "API");
  }

  // Pewarnaan adalah "nice to have": kegagalan di sini tidak boleh membatalkan sinkronisasi data.
  await paintStatusRow(rowNumber, "PENDING").catch(() => undefined);

  return { rowNumber };
}

/** Update kolom status/kode/verifikasi di blok sistem pada baris yang sudah ada. */
export async function updateRegistrationStatusRow(
  rowNumber: number,
  values: { statusLabel: string; code: string; confirmedBy: string; confirmedAtLabel: string },
): Promise<void> {
  if (!isSheetsConfigured()) {
    throw new SheetsWriteError("Google Sheets belum dikonfigurasi", "NOT_CONFIGURED");
  }
  if (rowNumber < 2) throw new SheetsWriteError("Nomor baris tidak valid", "API");

  const statusStart = await resolveStatusColumnStart();
  const range = `${columnLetter(statusStart)}${rowNumber}:${columnLetter(statusStart + 3)}${rowNumber}`;

  const response = await sheetsFetch(
    `/${env().REGISTRATION_SHEET_ID}/values/${encodeURIComponent(a1(range))}?valueInputOption=USER_ENTERED`,
    {
      method: "PUT",
      body: JSON.stringify({
        values: [[values.statusLabel, values.code, values.confirmedBy, values.confirmedAtLabel]],
      }),
    },
  );
  if (!response.ok) {
    throw new SheetsWriteError(`Update status baris gagal (${response.status}): ${await readErrorBody(response)}`, "API");
  }
}

/** Baca baris spreadsheet (untuk diagnosa admin dan tarik data / pull sync). */
export async function readRegistrationTabValues(): Promise<string[][]> {
  const response = await sheetsFetch(
    `/${env().REGISTRATION_SHEET_ID}/values/${encodeURIComponent(a1("A1:BZ2000"))}`,
  );
  if (!response.ok) {
    throw new SheetsWriteError(`Baca sheet gagal (${response.status}): ${await readErrorBody(response)}`, "API");
  }
  const payload = (await response.json()) as { values?: string[][] };
  return payload.values ?? [];
}
