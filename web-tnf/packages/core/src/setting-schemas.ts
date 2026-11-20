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
  "popup.event": z.object({
    isEnabled: z.boolean().default(true),
    badge: z.string().max(60).default("LAGA MENDATANG · TIKET RESMI"),
    title: z.string().max(120).default("TEMANGGUNG FIGHT NIGHT VOL. 6"),
    subtitle: z.string().max(160).default("SABTU, 16 JANUARI 2027 · GOR BAMBU RUNCING"),
    description: z
      .string()
      .max(350)
      .default("Perebutan sabuk emas kelas berat & welter. Dapatkan tiket Anda sebelum kehabisan!"),
    imageUrl: z.string().max(500).default("/images/hero/boxing-ring-arena.jpg"),
    buttonLabel: z.string().max(60).default("BELI TIKET SEKARANG"),
    buttonUrl: z.string().max(500).default("https://tiket.pimpom.id"),
  }),
  "exhibition.vol6": z.object({
    isEnabled: z.boolean().default(true),
    badge: z.string().max(60).default("VOL. 6 EXHIBITION"),
    title: z.string().max(120).default("SETIAP RONDE PUNYA CERITA."),
    rulesText: z
      .string()
      .max(250)
      .default("Rules: Boxing & Kickboxing (Low Contact) · Terbuka untuk 11 Kelas Timbangan"),
    whatsappNumber: z.string().max(30).default("6285848000639"),
    ctaLabel: z.string().max(60).default("DAFTAR PARTAI VIA WA"),
    closedDivisions: z
      .string()
      .max(200)
      .default(""),
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
  "popup.event": "Pop-up Event Promosi",
  "exhibition.vol6": "Partai & Regulasi Vol. 6",
};
