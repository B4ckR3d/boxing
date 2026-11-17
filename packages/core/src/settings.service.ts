/**
 * Organization settings (CMS) — otoritas validasi & persistensi.
 *
 * Pindah dari `apps/web`. Yang dijaga persis seperti versi lama:
 *   - key tak dikenal **ditolak** (bukan diabaikan) → `SettingsError`.
 *   - nilai divalidasi `SETTING_SCHEMAS[key]`; baris kosong/tidak valid jatuh ke default skema,
 *     jadi organisasi baru tanpa setting tetap menghasilkan objek valid.
 *   - batch update menulis satu audit `SETTINGS_UPDATE` berisi daftar key.
 *
 * `db` dan `logAudit` diinjeksi: settings bisa diubah dari route API (audit mencatat IP petugas)
 * maupun dari server action Next (audit mencatat IP browser).
 */
import { Prisma } from "@tfn/db/client";
import type { PrismaClient } from "@tfn/db/client";
import {
  SETTING_SCHEMAS,
  SETTING_KEYS,
  isSettingKey,
  type SettingKey,
  type SettingValues,
} from "./setting-schemas.js";

export class SettingsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SettingsError";
  }
}

export type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];
export type Db = PrismaClient | Tx;

export type SettingsDeps = {
  db: Db;
  /** Audit writer milik app pemanggil. Wajib, karena perubahan setting harus terekam. */
  logAudit: (params: {
    actorId?: string | null;
    action: string;
    entityType: string;
    entityId?: string | null;
    summary: string;
    metadata?: Record<string, unknown> | null;
    db?: Db;
  }) => Promise<void>;
};

function resolveSetting<K extends SettingKey>(key: K, row?: { value: unknown }): SettingValues[K] {
  const parsed = row ? SETTING_SCHEMAS[key].safeParse(row.value) : null;
  return (parsed?.success ? parsed.data : SETTING_SCHEMAS[key].parse({})) as unknown as SettingValues[K];
}

/** Memuat semua setting; baris hilang/tidak valid memakai default skema. */
export async function getSettings(deps: SettingsDeps): Promise<SettingValues> {
  const rows = await deps.db.organizationSetting.findMany({
    where: { key: { in: [...SETTING_KEYS] } },
  });

  const result = {} as SettingValues;
  for (const key of SETTING_KEYS) {
    result[key] = resolveSetting(key, rows.find((r) => r.key === key)) as never;
  }
  return result;
}

/** Validasi & simpan batch setting. Key tak dikenal ditolak. Mengembalikan key yang tersimpan. */
export async function updateSettings(
  deps: SettingsDeps,
  actorId: string,
  values: Record<string, unknown>,
): Promise<string[]> {
  const applied: string[] = [];

  for (const [key, rawValue] of Object.entries(values)) {
    if (!isSettingKey(key)) {
      throw new SettingsError(`Unknown setting key: ${key}`);
    }
    const parsed = SETTING_SCHEMAS[key].safeParse(rawValue);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      throw new SettingsError(
        `Invalid value for "${key}"${firstIssue?.path?.length ? ` (${firstIssue.path.join(".")})` : ""}: ${firstIssue?.message ?? "validation failed"}`,
      );
    }

    await deps.db.organizationSetting.upsert({
      where: { key },
      update: { value: parsed.data as Prisma.InputJsonValue, updatedById: actorId },
      create: { key, value: parsed.data as Prisma.InputJsonValue, updatedById: actorId },
    });
    applied.push(key);
  }

  if (applied.length > 0) {
    await deps.logAudit({
      actorId,
      action: "SETTINGS_UPDATE",
      entityType: "ORGANIZATION_SETTING",
      entityId: applied.join(","),
      summary: `Updated organization settings: ${applied.join(", ")}`,
      metadata: { keys: applied },
    });
  }

  return applied;
}

export type { SettingKey, SettingValues };
export { SETTING_SCHEMAS, SETTING_KEYS, isSettingKey };
