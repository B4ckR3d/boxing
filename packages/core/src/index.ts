/**
 * Barrel `@tfn/core`.
 *
 * `Db`/`Tx` sengaja hanya diekspor sekali (dari `audit.service`) karena ketiga modul memakai
 * definisi yang identik. Subpath export (`@tfn/core/settings`, dst.) tetap tersedia bila pemanggil
 * ingin impor sempit.
 */
export { logAudit } from "./audit.service";
export type { AuditContext, AuditDeps, Db, LogAuditParams, Tx } from "./audit.service";

export { SettingsError, getSettings, updateSettings, SETTING_SCHEMAS, SETTING_KEYS, isSettingKey } from "./settings.service";
export type { SettingKey, SettingValues, SettingsDeps } from "./settings.service";

export { getPublicSponsors } from "./sponsor.service";
export type { PublicSponsor } from "./sponsor.service";

export { redact, diff } from "./redact";
export type { JsonValue } from "./redact";

export {
  SPONSOR_TIERS,
  SPONSOR_TIER_KEYS,
  SPONSOR_TIER_ORDER,
  DEFAULT_SPONSOR_TIER,
  normalizeSponsorTier,
  sponsorTierLabel,
  isSafeLogoSource,
} from "./sponsor-tiers";
export type { SponsorTierKey } from "./sponsor-tiers";
