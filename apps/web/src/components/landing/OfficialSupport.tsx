"use client";

import Image from "next/image";
import { ArrowUpRight, BadgeCheck, Landmark, Newspaper, ShieldCheck, Ticket } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import {
  GOVERNMENT_SUPPORTERS,
  ORGANIZER,
  PARTNERS,
  type Partner,
  type PartnerTier,
} from "@/lib/site/partners";

const TIER_LABEL: Record<PartnerTier, { id: string; en: string }> = {
  SUPPORTED_BY: { id: "Didukung oleh", en: "Supported by" },
  PRESENTED_BY: { id: "Diselenggarakan bersama", en: "Presented with" },
  OFFICIAL_PARTNER: { id: "Partner resmi", en: "Official partners" },
  MEDIA_PARTNER: { id: "Media partner", en: "Media partners" },
};

function tierLabel(tier: PartnerTier, lang: string) {
  const label = TIER_LABEL[tier];
  return lang === "en" ? label.en : label.id;
}

/**
 * The crest plate: the real emblem inside a gold double frame when a logo is
 * registered, otherwise a monogram seal so the block never shows a fake crest.
 * Government crests are shield-shaped, so the plate follows the artwork rather
 * than forcing it into a circle.
 */
function Seal({ partner, size = "lg" }: { partner: Partner; size?: "sm" | "lg" }) {
  const height = size === "lg" ? "h-24 sm:h-28" : "h-16";

  if (partner.logo) {
    return (
      <div className={`relative ${height} shrink-0`} aria-hidden="true">
        <span className="absolute inset-0 border border-gold/70" />
        <span className="absolute inset-[3px] border border-gold/25" />
        <span className="pointer-events-none absolute inset-[3px] bg-gradient-to-b from-gold-soft/12 via-transparent to-gold/10" />
        <Image
          src={partner.logo}
          alt=""
          width={640}
          height={968}
          className={`relative ${height} w-auto object-contain p-2.5 drop-shadow-[0_2px_8px_rgba(0,0,0,0.35)]`}
        />
      </div>
    );
  }

  return (
    <div className={`relative ${size === "lg" ? "h-24 w-24 sm:h-28 sm:w-28" : "h-16 w-16"} shrink-0`} aria-hidden="true">
      <span className="absolute inset-0 rounded-full border-2 border-gold" />
      <span className="absolute inset-[6px] rounded-full border border-gold/45" />
      <span className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 px-2 text-center">
        <span
          className={`font-display font-black uppercase leading-none tracking-[0.14em] text-gold ${
            size === "lg" ? "text-xs sm:text-sm" : "text-[10px]"
          }`}
        >
          {partner.shortName}
        </span>
        <span className="font-mono-data text-[7px] uppercase tracking-[0.18em] text-ink-subtle">Kab. Temanggung</span>
      </span>
    </div>
  );
}

/** Small square mark for partner tiles. */
function Mark({ partner }: { partner: Partner }) {
  if (partner.logo) {
    return (
      <span className="relative flex h-12 w-12 shrink-0 items-center justify-center">
        <Image
          src={partner.logo}
          alt={partner.name}
          width={200}
          height={80}
          className="h-full w-full object-contain"
        />
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`flex h-12 w-12 shrink-0 items-center justify-center border bg-canvas text-ink-muted ${
        partner.kind === "government" ? "border-gold/60" : "border-border-subtle"
      }`}
    >
      <span className="font-display text-[10px] font-black leading-none tracking-tight">{partner.shortName}</span>
    </span>
  );
}

function TierGroup({ tier, partners }: { tier: PartnerTier; partners: Partner[] }) {
  const { lang } = useLanguage();
  if (partners.length === 0) return null;

  const Icon = tier === "MEDIA_PARTNER" ? Newspaper : BadgeCheck;

  return (
    <div>
      <p className="flex items-center gap-2 font-mono-data text-[10px] font-bold uppercase tracking-[0.2em] text-ink-subtle">
        <Icon className="h-3.5 w-3.5 text-fight-red" aria-hidden="true" />
        {tierLabel(tier, lang)}
      </p>
      <div className="mt-3 grid gap-px border border-border-subtle bg-border-subtle sm:grid-cols-2">
        {partners.map((partner) => (
          <div key={partner.id} className="flex items-center gap-3 bg-charcoal p-4">
            <Mark partner={partner} />
            <div className="min-w-0">
              <p className="truncate font-display text-sm font-bold uppercase tracking-wide text-ink">{partner.name}</p>
              <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-ink-muted">
                {lang === "en" ? partner.note.en : partner.note.id}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Inverted marquee strip — the "official" claim stated once, loudly, then repeated. Decorative: the H2 carries the claim for screen readers. */
function Ticker({ text }: { text: string }) {
  const cell = (
    <span className="flex shrink-0 items-center gap-4 px-6 font-mono-data text-[10px] font-bold uppercase tracking-[0.22em]">
      <span className="text-canvas">•</span>
      {text}
    </span>
  );

  return (
    <div aria-hidden="true" className="relative overflow-hidden border-b border-fight-red bg-fight-red text-canvas">
      <div className="tfn-ticker py-2">
        <div className="flex items-center">
          {Array.from({ length: 4 }, (_, i) => (
            <span key={`a-${i}`} className="flex items-center">
              {cell}
            </span>
          ))}
        </div>
        <div className="flex items-center">
          {Array.from({ length: 4 }, (_, i) => (
            <span key={`b-${i}`} className="flex items-center">
              {cell}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function TrustCard({
  index,
  icon: Icon,
  title,
  body,
}: {
  index: string;
  icon: typeof ShieldCheck;
  title: string;
  body: string;
}) {
  return (
    <li className="hover-lift group relative border border-border-subtle bg-charcoal p-4">
      <div className="flex items-start justify-between gap-3">
        <Icon className="h-4 w-4 text-fight-red" aria-hidden="true" />
        <span className="font-mono-data text-[9px] font-bold tracking-[0.2em] text-gold">{index}</span>
      </div>
      <p className="mt-3 font-mono-data text-[10px] font-bold uppercase tracking-[0.15em] text-ink">{title}</p>
      <p className="mt-1 text-[11px] leading-snug text-ink-muted">{body}</p>
    </li>
  );
}

/** The supporter itself: crest, name, relationship — dressed as a gold-framed plaque. */
function SupporterPlaque({ partner, lang }: { partner: Partner; lang: string }) {
  return (
    <div className="relative border border-gold/55 bg-charcoal p-5 shadow-brutal-red sm:p-7">
      {/* Inner hairline — turns the border into a certificate double-frame. */}
      <span aria-hidden="true" className="pointer-events-none absolute inset-[5px] border border-gold/20" />
      {/* Gold spine on the left edge. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-6 left-0 w-[3px] bg-gradient-to-b from-gold-soft/80 via-gold/30 to-gold-soft/80"
      />

      <span aria-hidden="true" className="absolute left-1.5 top-1.5 h-4 w-4 border-l-2 border-t-2 border-gold" />
      <span aria-hidden="true" className="absolute right-1.5 top-1.5 h-4 w-4 border-r-2 border-t-2 border-gold" />
      <span aria-hidden="true" className="absolute bottom-1.5 left-1.5 h-4 w-4 border-b-2 border-l-2 border-gold" />
      <span aria-hidden="true" className="absolute bottom-1.5 right-1.5 h-4 w-4 border-b-2 border-r-2 border-gold" />

      <span className="absolute right-3 top-6 -rotate-6 border border-gold bg-canvas px-2 py-0.5 font-mono-data text-[9px] font-bold uppercase tracking-[0.2em] text-gold shadow-[0_1px_0_0_var(--gold)]">
        {lang === "en" ? "Endorsed" : "Resmi"}
      </span>

      <div className="flex items-start gap-4 pr-14">
        <Seal partner={partner} />
        <div className="min-w-0">
          <p className="font-mono-data text-[10px] font-bold uppercase tracking-[0.2em] text-gold/80">
            {tierLabel("SUPPORTED_BY", lang)}
          </p>
          <h3 className="mt-1 font-display text-lg font-black uppercase leading-tight tracking-tight text-ink sm:text-2xl">
            {partner.name}
          </h3>
          <p className="mt-2 text-xs leading-relaxed text-ink-muted">
            {lang === "en" ? partner.note.en : partner.note.id}
          </p>
          {partner.href ? (
            <a
              href={partner.href}
              rel="noopener noreferrer"
              target="_blank"
              className="mt-3 inline-flex items-center gap-1.5 font-mono-data text-[10px] font-bold uppercase tracking-[0.15em] text-ink-muted underline-offset-4 transition-colors hover:text-gold hover:underline"
            >
              {lang === "en" ? "Official site" : "Situs resmi"}
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Mono "ledger" of the facts a buyer needs before paying. */
function Ledger({ rows }: { rows: { label: string; value: string }[] }) {
  return (
    <dl className="divide-y divide-border-subtle border border-t-2 border-border-subtle border-t-gold/60 bg-charcoal">
      {rows.map((row) => (
        <div key={row.label} className="flex items-baseline justify-between gap-4 px-4 py-3">
          <dt className="font-mono-data text-[9px] font-bold uppercase tracking-[0.18em] text-ink-subtle">{row.label}</dt>
          <dd className="text-right font-mono-data text-[10px] font-bold uppercase tracking-[0.12em] text-ink">
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * "Official event" block: who runs TFN and which government body backs it.
 *
 * Renders only what `src/lib/site/partners.ts` declares — no invented endorsements.
 * `variant="home"` adds the marquee strip, watermark, and oversized type for the landing
 * page; the default compact variant sits above the ticket purchase panel.
 */
export function OfficialSupport({ variant = "tickets" }: { variant?: "home" | "tickets" }) {
  const { lang } = useLanguage();
  const isHome = variant === "home";

  const government = GOVERNMENT_SUPPORTERS;
  const presentedBy = PARTNERS.filter((p) => p.tier === "PRESENTED_BY");
  const officialPartners = PARTNERS.filter((p) => p.tier === "OFFICIAL_PARTNER");
  const media = PARTNERS.filter((p) => p.tier === "MEDIA_PARTNER");
  const hasAnyCommercial = presentedBy.length + officialPartners.length + media.length > 0;

  if (government.length === 0 && !hasAnyCommercial) return null;

  const copy = {
    eyebrow: lang === "en" ? "Official event · Government sanctioned" : "Event resmi · Dukungan pemerintah",
    heading:
      lang === "en"
        ? "An official Temanggung event, backed by the regency government"
        : "Event resmi Kabupaten Temanggung, didukung pemerintah daerah",
    intro:
      lang === "en"
        ? `${ORGANIZER.name} is organised by the promoter together with the regional government. Tickets listed here are the official allocation — there are no resale channels.`
        : `${ORGANIZER.name} diselenggarakan oleh penyelenggara bersama pemerintah daerah. Tiket yang dijual di sini adalah alokasi resmi — tidak ada jalur penjualan ulang.`,
    ticker:
      lang === "en"
        ? "Official event · Supported by the Government of Temanggung Regency · Tickets only at this site"
        : "Event resmi · Didukung Pemerintah Kabupaten Temanggung · Tiket resmi hanya di situs ini",
    trust: [
      {
        icon: ShieldCheck,
        title: lang === "en" ? "Official channel" : "Jalur resmi",
        body: lang === "en" ? "Tickets are sold directly by the organiser." : "Tiket dijual langsung oleh penyelenggara.",
      },
      {
        icon: Ticket,
        title: lang === "en" ? "No mark-up" : "Tanpa perantara",
        body: lang === "en" ? "No agents, no scalper pricing." : "Tanpa agen, tanpa harga calo.",
      },
      {
        icon: Landmark,
        title: lang === "en" ? "Local sanction" : "Sanksi daerah",
        body: lang === "en" ? "Held with the regency's knowledge and support." : "Digelar dengan dukungan pemerintah kabupaten.",
      },
    ],
    ledger: [
      { label: lang === "en" ? "Organiser" : "Penyelenggara", value: ORGANIZER.name },
      { label: lang === "en" ? "Backing" : "Dukungan", value: government[0]?.name ?? "—" },
      {
        label: lang === "en" ? "Ticket channel" : "Jalur tiket",
        value: lang === "en" ? "Direct only" : "Penjualan langsung",
      },
      {
        label: lang === "en" ? "Verification" : "Verifikasi",
        value: lang === "en" ? "Manual, by admin" : "Manual oleh admin",
      },
    ],
  };

  return (
    <section
      aria-labelledby="official-support-heading"
      className="relative overflow-hidden border-y border-border-subtle bg-canvas-deep"
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-grid-lines opacity-50" />
      {isHome ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-8 top-1/2 hidden -translate-y-1/2 select-none font-display text-[16vw] font-black uppercase leading-none tracking-tighter text-transparent [-webkit-text-stroke:1px_color-mix(in_srgb,var(--ink)_10%,transparent)] lg:block"
        >
          Temanggung
        </span>
      ) : null}

      <div className="relative">
        {isHome ? <Ticker text={copy.ticker} /> : null}

        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <div
            className={`grid gap-10 lg:items-start lg:gap-14 ${
              isHome ? "lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]" : "lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
            }`}
          >
            <div>
              <p className="inline-flex items-center gap-2 border border-fight-red px-2.5 py-1 font-mono-data text-[10px] font-bold uppercase tracking-[0.2em] text-fight-red">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                {copy.eyebrow}
              </p>
              <h2
                id="official-support-heading"
                className={`mt-4 font-display font-black uppercase leading-[1.02] tracking-tight text-ink ${
                  isHome ? "text-3xl sm:text-5xl" : "text-2xl sm:text-4xl"
                }`}
              >
                {copy.heading}
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-muted">{copy.intro}</p>

              <ul className={`mt-7 grid gap-px border border-border-subtle bg-border-subtle sm:grid-cols-3`}>
                {copy.trust.map((item, i) => (
                  <TrustCard
                    key={item.title}
                    index={`0${i + 1}`}
                    icon={item.icon}
                    title={item.title}
                    body={item.body}
                  />
                ))}
              </ul>
            </div>

            <div className="space-y-5">
              {government.map((partner) => (
                <SupporterPlaque key={partner.id} partner={partner} lang={lang} />
              ))}

              {isHome ? <Ledger rows={copy.ledger} /> : null}

              {presentedBy.length > 0 ? <TierGroup tier="PRESENTED_BY" partners={presentedBy} /> : null}
              {officialPartners.length > 0 ? <TierGroup tier="OFFICIAL_PARTNER" partners={officialPartners} /> : null}
              {media.length > 0 ? <TierGroup tier="MEDIA_PARTNER" partners={media} /> : null}

              {!hasAnyCommercial ? (
                <p className="border border-dashed border-border-subtle p-4 text-[11px] leading-relaxed text-ink-subtle">
                  {lang === "en"
                    ? "Partner and media slots are being finalised. Only confirmed partners appear on this page."
                    : "Slot partner dan media partner masih dalam proses. Hanya mitra yang sudah terkonfirmasi ditampilkan di halaman ini."}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}




