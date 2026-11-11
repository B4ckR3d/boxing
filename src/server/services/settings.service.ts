import "server-only";
import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@/generated/prisma/client";
import {
  SETTING_SCHEMAS,
  SETTING_KEYS,
  isSettingKey,
  type SettingKey,
  type SettingValues,
} from "@/lib/settings/schemas";
import { logAudit } from "./audit.service";

export class SettingsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SettingsError";
  }
}

function resolveSetting<K extends SettingKey>(
  key: K,
  row?: { value: unknown }
): SettingValues[K] {
  const parsed = row ? SETTING_SCHEMAS[key].safeParse(row.value) : null;
  return (
    parsed?.success ? parsed.data : SETTING_SCHEMAS[key].parse({})
  ) as unknown as SettingValues[K];
}

/** Loads all settings, falling back to schema defaults for missing/invalid rows. */
export async function getSettings(): Promise<SettingValues> {
  const rows = await prisma.organizationSetting.findMany({
    where: { key: { in: [...SETTING_KEYS] } },
  });

  const result = {} as SettingValues;
  for (const key of SETTING_KEYS) {
    result[key] = resolveSetting(key, rows.find((r) => r.key === key)) as never;
  }
  return result;
}

/** Validates and persists a batch of settings. Unknown keys are rejected. */
export async function updateSettings(
  actorId: string,
  values: Record<string, unknown>
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
        `Invalid value for "${key}"${firstIssue?.path?.length ? ` (${firstIssue.path.join(".")})` : ""}: ${firstIssue?.message ?? "validation failed"}`
      );
    }

    await prisma.organizationSetting.upsert({
      where: { key },
      update: { value: parsed.data as Prisma.InputJsonValue, updatedById: actorId },
      create: { key, value: parsed.data as Prisma.InputJsonValue, updatedById: actorId },
    });
    applied.push(key);
  }

  if (applied.length > 0) {
    await logAudit({
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

export type { SettingKey };
