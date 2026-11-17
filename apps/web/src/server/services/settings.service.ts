/**
 * Binding `apps/web` → `@tfn/core` (settings).
 *
 * Call site lama (`@/server/services/settings.service`) tetap valid. Yang diurung di sini hanya
 * dependensi web: `prisma` dan `logAudit` (yang menambahkan IP/User-Agent dari `headers()`).
 */
import { prisma } from "@/lib/db/prisma";
import {
  SettingsError,
  getSettings as getSettingsDomain,
  updateSettings as updateSettingsDomain,
  SETTING_SCHEMAS,
  SETTING_KEYS,
  isSettingKey,
  type SettingKey,
  type SettingValues,
} from "@tfn/core/settings";
import { logAudit } from "./audit.service";

export { SettingsError, SETTING_SCHEMAS, SETTING_KEYS, isSettingKey };
export type { SettingKey, SettingValues };

export async function getSettings(): Promise<SettingValues> {
  return getSettingsDomain({ db: prisma, logAudit });
}

export async function updateSettings(actorId: string, values: Record<string, unknown>): Promise<string[]> {
  return updateSettingsDomain({ db: prisma, logAudit }, actorId, values);
}
