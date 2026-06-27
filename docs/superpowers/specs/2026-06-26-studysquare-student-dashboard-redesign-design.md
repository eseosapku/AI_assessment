# StudySquare Student Dashboard Redesign — Design Spec

**Date:** 2026-06-26
**Status:** Approved (visual foundation locked via companion mockups `home-v1 → v3-cyan`)
**Scope:** Full visual redesign of the authenticated **student** experience — Home, Practice (+ build-quiz modal), Recall, StudyLab hub, Exam prep, and the shared shell/nav. Teacher surfaces are out of scope for this pass.

> This direction intentionally **supersedes the "playful academic studio" product direction in `DESIGN.md`** (scribbles, marker highlights, anti-gradient, classroom-tile look). The user moved away from it. `DESIGN.md` should be updated/replaced after this lands; until then, treat this spec as the source of truth for student product UI.

---

## 1. Direction

A modern, polished learning dashboard — reference fusion of **Coursue** (structure: rounded app panel, gradient hero, content cards, right rail) and **Halo-lab** (restraint: mostly-neutral surfaces, one confident accent, big numbers, soft charts, progress rails). Cool and premium, **not** candy-colored and **not** generic SaaS-blue.

**Locked decisions (from mockups + Q&A):**
- **Layout:** the whole app sits in one large rounded "panel" on a soft tinted canvas; 3-column grid `sidebar | main | right-rail`.
- **Palette:** calm/neutral with a single brand accent = **StudySquare logo cyan** (`#2ACBF2 → #0C86CE`). Secondary color used sparingly and semantically.
- **Sequencing:** **Home is the flagship** — build shared primitives + Home first, validate, then roll the system out to the other screens.
- **Dark mode:** **full parity** — every primitive ships a deliberate light *and* dark recipe.
- **Assets:** real generated spot art (nano-banana) used as **light accents** (hero motif, section/empty-state art), not load-bearing; core UI is CSS/SVG + lucide icons.

---

## 2. Design tokens

### Color
```
Accent (brand cyan)
  --ss-accent        #0E8FD1   (primary: buttons, active nav, links, progress)
  --ss-accent-bright #2ACBF2   (gradient end / highlights)
  --ss-accent-deep   #0C6FAE   (pressed / text-on-light emphasis)
  --ss-accent-soft   #E6F6FD   (tinted chip/pill backgrounds, light mode)
  hero gradient      linear-gradient(115deg,#0C74B4,#0E94D6 52%,#2ACBF2)

Neutrals (light)
  --ss-ink   #16202A   text
  --ss-slate #7E8A96   secondary text
  --ss-line  #EAF0F3   hairline borders
  --ss-chip  #F3F7F9   neutral chip/icon-chip fill
  --ss-panel #FFFFFF   card/panel surface
  --ss-canvas linear-gradient(140deg,#EAF1F4,#E3EDF2)  page bg

Semantic
  --ss-good  #16B67A   up-trend / success
  --ss-bad   #E26773   down-trend / error
  --ss-warn  #F0A93E   caution

Secondary accents (used ONLY as per-area signatures, low chroma)
  recall   #2ACBF2 (cyan-bright)   studylab #16B67A (mint-green)
  exam     #F0A93E (amber)          practice #0E8FD1 (accent)
```

### Dark recipes (parity)
```
--ss-ink   #E8EEF3      --ss-slate #93A1AD
--ss-line  rgba(255,255,255,.07)
--ss-chip  rgba(255,255,255,.05)
--ss-panel #161B21       (cards) / app panel #12161B
--ss-canvas #0C0F13
accent stays cyan; soft tints become accent @ 14–18% alpha over dark.
Gradients keep hue, drop ~10% lightness. Accent used as glow/border + text.
```

### Shape, shadow, type
- **Radius:** app panel `30px`; cards/panels `18–22px`; chips/pills `12–14px`; full pills for primary CTAs.
- **Shadow:** app panel `0 30px 80px -34px rgba(20,60,90,.30)`; cards rest on hairline border + no/!subtle shadow; hover lift `translateY(-2px)` + soft shadow.
- **Type:** adopt **Plus Jakarta Sans** (geometric, matches approved mockups) as the product-UI font via `next/font`, replacing Nunito in the authenticated product. Landing/marketing may keep Bricolage display. Weights: body 500/600, labels 700 (uppercase, `.16em` tracking, 10–11px), numbers/headings 800. Big stat numbers 21–30px.
- **Motion:** 150–250ms ease for hover/press/state only; `prefers-reduced-motion` disables transforms.

---

## 3. Shared primitives (`components/studio/ui/`)

Each is small, single-purpose, themeable (light+dark via tokens). Built once, reused across all screens.

| Component | Purpose | Key props |
|---|---|---|
| **AppShell** | The rounded-panel 3-col layout (canvas → panel → `sidebar/main/rail`). Replaces current `ProductShell` chrome. Right rail is optional per page. | `rail?`, `children` |
| **SideNav** | Restyled sidebar: cyan logo mark, MENU group, pill nav items (active = solid cyan), settings/theme footer. | `items`, `active` |
| **TopBar** | Greeting block + search + bell + profile chip. | `name` |
| **HeroBanner** | Gradient banner w/ sparkle motif, kicker, headline, dark pill CTA + optional spot art. The page's headline action. | `tone`, `kicker`, `title`, `cta`, `art?` |
| **StatChip** | Icon-chip + big number + label. `key` variant tints the icon-chip accent. | `icon`, `value`, `label`, `accent?` |
| **SectionHeader** | `h2` + optional "see all" link. | `title`, `action?` |
| **ActivityCard** | The flexible content card: icon-chip + pill + title + progress bar + meta/avatar. Powers class cards, space cards, mode cards. | `icon`, `pill`, `title`, `progress?`, `meta?`, `tone` |
| **ProgressRow** | Label + track + % + trend chip (up/down). Powers "By subject". | `label`, `pct`, `trend` |
| **RingStat** | Conic progress ring around avatar + greeting + sub. | `pct`, `name`, `sub` |
| **MiniBars** / **MiniLine** | Tiny SVG bar/line charts (weekly activity, score-over-time). | `data`, `accent` |
| **ListPanel** | Titled card wrapping a divided list (Focus areas, upcoming, mentors-style lists). | `title`, `icon`, `children` |
| **Pill** | Small status/category pill; neutral or accent-soft. | `tone` |
| **IconChip** | lucide icon in a colored rounded square; one consistent icon treatment app-wide. | `icon`, `tone` |
| **SparkButton** | Accent-soft action button with a spark glyph (the "Study"/task actions). | `label`, `onClick` |

**Per-area color signatures** (applied to that area's hero `tone`, IconChips, pills): Practice→accent cyan, Recall→bright cyan, StudyLab→mint-green, Exam→amber, Home→accent. Everything else stays neutral so the signature reads.

---

## 4. Page application

### 4.1 Home (flagship — matches `home-v3-cyan`)
`AppShell` with rail. Main: `TopBar` → `HeroBanner`(Create assessment, the headline action — assessments stay central) → 4× `StatChip` (Tests done / Avg / Latest grade / Streak) → **From your classes** (`SectionHeader` + 3× `ActivityCard` with open/upcoming + progress + teacher avatar) → **By subject** (`ProgressRow` list). Rail: `RingStat` + `MiniBars` (weekly) → `ListPanel` Focus areas (weak topics + `SparkButton` Study → gap LearnSpace). All sections conditional (new students see hero + stats + "create first assessment").

### 4.2 Practice hub
Header + a grid of **mode `ActivityCard`s**: Build quiz (hero-accent, opens modal), Recall, Exam prep (NG only), Class assignment. Drop the old flat tiles. **Build-quiz modal (`FlowForm`)** re-skinned to the panel system: rounded modal, stepper, cyan accents, IconChips, SparkButton primary.

### 4.3 Recall
Hub: back-to-Practice, `HeroBanner`(tone=recall) showing **due today** big number + Start review CTA; deck list as `ActivityCard`s; "how it works" as a small `ListPanel`. Review screen: the flip card restyled to a panel card (cyan answer side), rating buttons as 4 calm tone cards (already de-badged), progress bar in accent.

### 4.4 StudyLab hub
Apply the system to the existing hub: `HeroBanner`(tone=studylab/mint) for the gap-map CTA; **PersonaPanel re-built** on `ListPanel` + `SparkButton` (replaces the apple-styled one); LearnSpace list as `ActivityCard`s (subject IconChip, step/progress). Keep the canvas itself unchanged (separate surface).

### 4.5 Exam prep
`HeroBanner`(tone=exam/amber) + the WAEC/JAMB step flow re-skinned with `ActivityCard` exam pickers and `Pill` subject chips; back-to-Practice retained.

### 4.6 Shell / nav
`ProductShell` → `AppShell`+`SideNav`+`TopBar`. Mobile: panel goes full-bleed, sidebar collapses to the existing bottom nav (restyled), rail stacks under main.

---

## 5. Dark mode
Every primitive consumes tokens (§2). Validate contrast (WCAG AA for text/icons). Accent cyan on dark uses brighter end for text/borders; soft tints become accent-alpha over `--ss-panel`. Charts/rings keep hue. One QA pass per screen in both modes.

---

## 6. Accessibility & motion
- Focus-visible rings (`--ss-accent` @ 40%) on all interactive elements.
- Color never the sole signal (trend uses arrow + color; status uses label + color).
- Hit targets ≥ 40px. Respect `prefers-reduced-motion`.

---

## 7. Generated assets (nano-banana)
Light accents only. JSON prompts delivered to the user in chat for generation, then dropped into `public/art/`. Set: (a) hero aurora/sparkle motif, (b) section spot art — Recall card-deck, StudyLab lab/garden, Exam target, (c) friendly empty-state illustration. Style locked: soft 3D-ish gradient, cyan-led palette, transparent background, consistent across the set.

---

## 8. Implementation phasing
1. **Tokens + primitives** (`components/studio/ui/`) + Plus Jakarta font wiring + dark recipes.
2. **AppShell/SideNav/TopBar** replace `ProductShell` (behavior preserved: role gating, paywall, profile sidebar, mobile nav).
3. **Home** rebuilt on primitives (flagship) — verify light+dark, real data.
4. Roll out: **Practice (+modal) → Recall → StudyLab hub → Exam prep**, each its own change + verification.
5. Asset integration as prompts come back.
6. Update/replace `DESIGN.md` to document the new system.

Each phase: `tsc` clean + existing tests pass; commit locally (no push).

## Non-goals
Teacher UI, the StudyLab canvas internals, data/logic changes, new features. This is presentation-layer only.
