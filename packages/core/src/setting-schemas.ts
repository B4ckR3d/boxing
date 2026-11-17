import { z } from "zod";

/**
 * Registry of CMS-configurable organization settings.
 * Each key's JSON value stored in OrganizationSetting is validated by the
 * matching Zod schema — arbitrary keys are rejected (see settings.service.ts).
 * All fields have defaults so an empty object resolves to valid defaults.
 */
export const SETTING_SCHEMAS = {
  "branding.general": z.object({
    siteName: z.string().min(1).max(80).default("TFN Temanggung Fight Night"),
    abbreviation: z.string().min(1).max(12).default("TFN"),
    suffix: z.string().max(12).default("·X"),
    tagline: z
      .string()
      .max(200)
      .default(
        "Kejuaraan Tinju Profesional Temanggung Fight Night."
      ),
  }),
  "landing.featured": z.object({
    heading: z.string().max(120).default("FEATURED CHAMPIONS"),
    subheading: z.string().max(240).default(""),
    ctaLabel: z.string().max(40).default("VIEW ALL ATHLETES"),
    ctaHref: z.string().max(500).default("/fighters"),
  }),
  "footer.general": z.object({
    copyright: z.string().max(200).default("© 2026 World Boxing Championship. All rights reserved."),
    contactEmail: z
      .string()
      .max(191)
      .regex(/^$|^[^@\s]+@[^@\s]+\.[^@\s]+$/, "Must be a valid email address")
      .default(""),
    certifications: z.string().max(255).default("Certified Sanctioning Authority — Las Vegas · Tokyo · Jakarta"),
  }),
  "system.flags": z.object({
    maintenanceMode: z.boolean().default(false),
    showDemoContent: z.boolean().default(true),
  }),
} as const;

export type SettingKey = keyof typeof SETTING_SCHEMAS;
export type SettingValues = {
  [K in SettingKey]: z.infer<(typeof SETTING_SCHEMAS)[K]>;
};

export const SETTING_KEYS = Object.keys(SETTING_SCHEMAS) as SettingKey[];

export function isSettingKey(value: string): value is SettingKey {
  return Object.prototype.hasOwnProperty.call(SETTING_SCHEMAS, value);
}

/** Human-readable labels for the settings UI */
export const SETTING_LABELS: Record<SettingKey, string> = {
  "branding.general": "Branding",
  "landing.featured": "Landing — Featured Section",
  "footer.general": "Footer",
  "system.flags": "System Flags",
};
