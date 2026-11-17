/**
 * Barrel `@tfn/core`.
 *
 * `Db`/`Tx` sengaja hanya diekspor sekali (dari `audit.service`) karena ketiga modul memakai
 * definisi yang identik. Subpath export (`@tfn/core/settings`, dst.) tetap tersedia bila pemanggil
 * ingin impor sempit.
 */
export { logAudit } from "./audit.service.js";
export type { AuditContext, AuditDeps, Db, LogAuditParams, Tx } from "./audit.service.js";

export { SettingsError, getSettings, updateSettings, SETTING_SCHEMAS, SETTING_KEYS, isSettingKey } from "./settings.service.js";
export type { SettingKey, SettingValues, SettingsDeps } from "./settings.service.js";

export { getPublicSponsors } from "./sponsor.service.js";
export type { PublicSponsor } from "./sponsor.service.js";

export { redact, diff } from "./redact.js";
export type { JsonValue } from "./redact.js";

export {
  SPONSOR_TIERS,
  SPONSOR_TIER_KEYS,
  SPONSOR_TIER_ORDER,
  DEFAULT_SPONSOR_TIER,
  normalizeSponsorTier,
  sponsorTierLabel,
  isSafeLogoSource,
} from "./sponsor-tiers.js";
export type { SponsorTierKey } from "./sponsor-tiers.js";
