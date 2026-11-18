# Design System & Token Specification — Cinematic Brutalism

> **Status:** v1.0 — Architecture standard  
> **Source of Truth:** [prd.md](../prd.md)  
> **Aesthetic Direction:** Cinematic Brutalism with Premium Championship Fight Night Palette  

---

## 1. Design Philosophy

The interface merges raw, high-impact athletic brutalism (bold condense typography, high-contrast borders, unapologetic grids, hard shadows) with the luxury drama of a world-title fight night (deep near-black backgrounds, metallic championship gold foil, crimson danger accents, cinematic spotlights).

- **No generic AI/SaaS card templates:** All components use crisp, purposeful geometric framing, subtle industrial grids, and physical weight.
- **Micro-interactions:** Snappy transform lifts (`translate(-2px, -2px)`) with hard offset shadows.
- **Accessibility:** Minimum body font size 12px, high contrast ratios complying with WCAG AA.
- **Performance:** Hardware-accelerated transforms, zero layout shifts, optimized 3D WebGL rendering with automated fallback for non-WebGL/reduced-motion environments.

---

## 2. Color Palette & Tokens

| Token Name | Hex Code | Semantic Role |
|---|---|---|
| `--color-canvas-black` | `#0A0A0A` | Primary background, viewport canvas |
| `--color-surface-charcoal` | `#141414` | Card surfaces, container modules, table backgrounds |
| `--color-surface-elevated` | `#1C1C1F` | Modal sheets, active tabs, floating panels |
| `--color-border-subtle` | `#27272A` | Standard divider and component borders |
| `--color-border-hard` | `#F4F1EA` | High-contrast brutalist borders and frames |
| `--color-gold-primary` | `#D4A017` | Championship gold, primary brand accents, trophy badges |
| `--color-gold-hover` | `#E5B22E` | Gold hover states |
| `--color-gold-metallic` | `linear-gradient(...)` | Metallic foil effect for championship typography and belts |
| `--color-crimson-red` | `#B3121F` | Danger accents, live fight badges, knockout badges, knockout alerts |
| `--color-crimson-hover` | `#D11928` | Crimson hover states |
| `--color-text-bone` | `#F4F1EA` | Primary high-contrast body & heading text |
| `--color-text-muted` | `#A1A1AA` | Secondary body text, timestamps, helper labels |

---

## 3. Typography System

| Role | Font Family | Fallback Stack | Usage |
|---|---|---|---|
| **Display / Headlines** | Anton / Bebas Neue | Impact, "Arial Narrow Bold", sans-serif | Massive fight titles, fighter ring names, bracket seeds, rank numbers |
| **Data / Numbers** | JetBrains Mono | ui-monospace, Consolas, monospace | Records (`28-0-0`), timestamps, weigh-in weights, round counts |
| **Body / UI Interface** | Inter / Geist | system-ui, -apple-system, sans-serif | Long-form bios, article copy, form labels, administrative tables |

---

## 4. Reusable Component Signatures

1. **Brutalist Button (`btn-brutal`):**
   - Solid fill (`#D4A017` or `#F4F1EA` or `#B3121F`)
   - 2px/3px solid black or bone border
   - Hard offset drop shadow: `box-shadow: 4px 4px 0px #B3121F` (or `#D4A017`)
   - Hover state: `transform: translate(-2px, -2px)` with shadow expanding to `6px 6px`

2. **Championship Badge (`badge-champ`):**
   - Gold border, black background, uppercase monospace lettering with `#D4A017` glow.

3. **Fight Card Preview (`card-bout`):**
   - Split corner representation (Red Corner vs. Blue Corner)
   - Monospace telemetry block (Date, Venue, Title on line, Scheduled Rounds)
   - Verified checkmark badge for certified outcomes

