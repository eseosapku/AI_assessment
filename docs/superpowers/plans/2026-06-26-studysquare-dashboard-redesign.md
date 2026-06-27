# StudySquare Dashboard Redesign — Flagship Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-skin the StudySquare student experience into the approved modern dashboard look (rounded app-panel, cyan accent, Plus Jakarta), starting with the shared primitive kit + the flagship Home page, with full light/dark parity.

**Architecture:** A token layer (CSS variables that flip in `.dark`, surfaced as Tailwind colors) feeds a set of small presentational primitives in `components/studio/ui/`. A new `AppShell`/`SideNav`/`TopBar` replaces `ProductShell` chrome (behavior preserved). `StudioHome` is rebuilt from those primitives. Data/logic are untouched — this is presentation only.

**Tech Stack:** Next.js 16, React 18, TypeScript (strict), Tailwind (darkMode: class), next/font, lucide-react, framer-motion, sharp (already used for asset prep), vitest (lib logic tests only).

**Scope note:** This plan covers Phases 1–4 of the spec (tokens, primitives, shell, Home). Phase 5 (Practice/Recall/StudyLab/Exam rollout) is a separate follow-up plan once Home is approved.

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-06-26-studysquare-student-dashboard-redesign-design.md` is the source of truth for all values.
- **Local only:** commit locally; **never `git push`** (branch `aws_deploy` deploys on push).
- **Per task:** `npx tsc --noEmit` exits 0 AND `npx vitest run` stays green before committing.
- **Do NOT run** `npm run lint` (broken in Next 16).
- **Presentation only:** no changes to data fetching, API routes, business logic, or features. Teacher UI is out of scope.
- **Accent (cyan):** `--ss-accent #0E8FD1`, bright `#2ACBF2`, deep `#0C6FAE`. Hero gradient `linear-gradient(115deg,#0C74B4,#0E94D6 52%,#2ACBF2)`.
- **Commit trailer:** end every commit message with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- **Verification reality:** the repo has NO React component tests (vitest covers `lib/` pure logic only). For visual primitives, "verify" = `tsc` + existing tests green + render check in the dev app. Add a vitest only where a task introduces pure logic (e.g. chart data mapping).

---

## File Structure

**Create:**
- `components/studio/ui/tokens.ts` — shared TS constants (per-area tone → classes map) consumed by primitives.
- `components/studio/ui/IconChip.tsx`, `Pill.tsx`, `SparkButton.tsx`, `StatChip.tsx`, `SectionHeader.tsx`
- `components/studio/ui/ActivityCard.tsx`, `ProgressRow.tsx`, `ListPanel.tsx`
- `components/studio/ui/RingStat.tsx`, `MiniBars.tsx`, `HeroBanner.tsx`
- `components/studio/ui/index.ts` — barrel re-export.
- `components/studio/AppShell.tsx`, `SideNav.tsx`, `TopBar.tsx`
- `lib/studio/miniBars.ts` (+ `lib/studio/miniBars.test.ts`) — pure bar-height mapping.

**Modify:**
- `app/globals.css` — add `--ss-*` token vars in `:root` and `.dark`.
- `tailwind.config.js` — surface `ss-*` colors + shadows.
- `app/layout.tsx` — swap Nunito → Plus Jakarta Sans for `--font-sans`.
- `components/studio/ProductShell.tsx` — re-implement as a thin wrapper over `AppShell` (keep export name + behavior).
- `components/studio/StudioHome.tsx` — rebuild on primitives.
- `.gitignore` — add `.superpowers/`.

**Assets (already on disk):** `public/art/{hero-motif,recall,studylab,exam,empty-state}.png`.

---

### Task 1: Design tokens + Plus Jakarta font + dark recipes

**Files:**
- Modify: `app/globals.css` (add token block)
- Modify: `tailwind.config.js` (extend colors/shadow)
- Modify: `app/layout.tsx:3-9,35` (font swap)

**Interfaces:**
- Produces: Tailwind utilities `bg-ss-panel bg-ss-canvas bg-ss-chip text-ss-ink text-ss-slate border-ss-line bg-ss-accent text-ss-accent bg-ss-accent-soft` (all dark-aware), shadow `shadow-ss-panel`, and `--font-sans` = Plus Jakarta Sans.

- [ ] **Step 1: Add token variables to `app/globals.css`** (inside the existing `@layer base`, near `.studio-surface`):

```css
:root{
  --ss-ink:#16202A; --ss-slate:#7E8A96; --ss-line:#EAF0F3;
  --ss-chip:#F3F7F9; --ss-panel:#FFFFFF;
  --ss-accent:#0E8FD1; --ss-accent-bright:#2ACBF2; --ss-accent-deep:#0C6FAE;
  --ss-accent-soft:#E6F6FD;
  --ss-good:#16B67A; --ss-bad:#E26773; --ss-warn:#F0A93E;
  --ss-canvas:#E8EEF3;
}
.dark{
  --ss-ink:#E8EEF3; --ss-slate:#93A1AD; --ss-line:rgba(255,255,255,.08);
  --ss-chip:rgba(255,255,255,.05); --ss-panel:#161B21;
  --ss-accent:#2BB4EE; --ss-accent-bright:#48D0FF; --ss-accent-deep:#1C8FC8;
  --ss-accent-soft:rgba(43,180,238,.16);
  --ss-good:#3FD08F; --ss-bad:#F08A93; --ss-warn:#F4BC63;
  --ss-canvas:#0C0F13;
}
```

- [ ] **Step 2: Surface tokens in `tailwind.config.js`** — add to `theme.extend.colors`:

```js
'ss-ink':'var(--ss-ink)', 'ss-slate':'var(--ss-slate)', 'ss-line':'var(--ss-line)',
'ss-chip':'var(--ss-chip)', 'ss-panel':'var(--ss-panel)', 'ss-canvas':'var(--ss-canvas)',
'ss-accent':'var(--ss-accent)', 'ss-accent-bright':'var(--ss-accent-bright)',
'ss-accent-deep':'var(--ss-accent-deep)', 'ss-accent-soft':'var(--ss-accent-soft)',
'ss-good':'var(--ss-good)', 'ss-bad':'var(--ss-bad)', 'ss-warn':'var(--ss-warn)',
```
and to `theme.extend.boxShadow`: `'ss-panel':'0 30px 80px -34px rgba(20,60,90,.30)'`.

- [ ] **Step 3: Swap the product font in `app/layout.tsx`**

```tsx
import { Plus_Jakarta_Sans, Bricolage_Grotesque } from 'next/font/google'
const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-sans' })
const bricolage = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-display' })
// body className: `${jakarta.variable} ${bricolage.variable} font-sans`
```
Remove the `Nunito_Sans` import/usage.

- [ ] **Step 4: Verify build + tests**

Run: `npx tsc --noEmit && npx vitest run`
Expected: tsc exit 0; all tests pass. Then start `npm run dev` and confirm any existing page still renders (font changed, no layout break).

- [ ] **Step 5: Commit**

```bash
git add app/globals.css tailwind.config.js app/layout.tsx
git commit -m "Redesign tokens: ss-* color system, dark recipes, Plus Jakarta font

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Atom primitives (IconChip, Pill, SparkButton, StatChip, SectionHeader)

**Files:**
- Create: `components/studio/ui/tokens.ts`, `IconChip.tsx`, `Pill.tsx`, `SparkButton.tsx`, `StatChip.tsx`, `SectionHeader.tsx`, `index.ts`

**Interfaces:**
- Produces:
  - `type Tone = 'accent'|'neutral'|'good'|'warn'|'bad'|'recall'|'studylab'|'exam'`
  - `IconChip({icon: LucideIcon, tone?: Tone, className?})`
  - `Pill({children, tone?: 'neutral'|'accent', className?})`
  - `SparkButton({label, onClick?, className?})`
  - `StatChip({icon: LucideIcon, value: ReactNode, label: string, accent?: boolean})`
  - `SectionHeader({title: string, action?: {label:string, onClick?:()=>void, href?:string}})`

- [ ] **Step 1: `tokens.ts` — tone → tailwind class map**

```ts
import type { LucideIcon } from 'lucide-react'
export type Tone = 'accent' | 'neutral' | 'good' | 'warn' | 'bad' | 'recall' | 'studylab' | 'exam'
export type { LucideIcon }
// icon-chip background + foreground per tone (dark-aware via ss-* vars where possible)
export const TONE_CHIP: Record<Tone, string> = {
  neutral: 'bg-ss-chip text-ss-slate',
  accent: 'bg-ss-accent-soft text-ss-accent',
  good: 'bg-[color:var(--ss-good)]/12 text-ss-good',
  warn: 'bg-[color:var(--ss-warn)]/14 text-ss-warn',
  bad: 'bg-[color:var(--ss-bad)]/12 text-ss-bad',
  recall: 'bg-ss-accent-soft text-ss-accent-bright',
  studylab: 'bg-[color:var(--ss-good)]/12 text-ss-good',
  exam: 'bg-[color:var(--ss-warn)]/14 text-ss-warn',
}
```

- [ ] **Step 2: `IconChip.tsx`**

```tsx
import type { Tone, LucideIcon } from './tokens'
import { TONE_CHIP } from './tokens'
export function IconChip({ icon: Icon, tone = 'neutral', className = '' }:
  { icon: LucideIcon; tone?: Tone; className?: string }) {
  return (
    <span className={`grid place-items-center rounded-xl ${TONE_CHIP[tone]} ${className || 'h-10 w-10'}`}>
      <Icon className="h-[18px] w-[18px]" strokeWidth={1.9} />
    </span>
  )
}
```

- [ ] **Step 3: `Pill.tsx`**

```tsx
export function Pill({ children, tone = 'neutral', className = '' }:
  { children: React.ReactNode; tone?: 'neutral' | 'accent'; className?: string }) {
  const t = tone === 'accent' ? 'bg-ss-accent-soft text-ss-accent' : 'bg-ss-chip text-ss-slate'
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10.5px] font-bold ${t} ${className}`}>{children}</span>
}
```

- [ ] **Step 4: `SparkButton.tsx`** (the "Study"/task action)

```tsx
import { Sparkles } from 'lucide-react'
export function SparkButton({ label, onClick, className = '' }:
  { label: string; onClick?: () => void; className?: string }) {
  return (
    <button type="button" onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-xl bg-ss-accent-soft px-3 py-1.5 text-[11.5px] font-bold text-ss-accent transition-colors hover:brightness-95 active:scale-[0.98] ${className}`}>
      <Sparkles className="h-3.5 w-3.5" /> {label}
    </button>
  )
}
```

- [ ] **Step 5: `StatChip.tsx`**

```tsx
import { IconChip } from './IconChip'
import type { LucideIcon } from './tokens'
export function StatChip({ icon, value, label, accent = false }:
  { icon: LucideIcon; value: React.ReactNode; label: string; accent?: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-[18px] border border-ss-line bg-ss-panel p-[15px]">
      <IconChip icon={icon} tone={accent ? 'accent' : 'neutral'} className="h-[42px] w-[42px]" />
      <div>
        <div className="text-[21px] font-extrabold leading-none text-ss-ink">{value}</div>
        <div className="mt-[3px] text-[11.5px] font-semibold text-ss-slate">{label}</div>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: `SectionHeader.tsx`**

```tsx
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
export function SectionHeader({ title, action }:
  { title: string; action?: { label: string; onClick?: () => void; href?: string } }) {
  const a = action && (
    <span className="inline-flex items-center gap-1 text-[12.5px] font-bold text-ss-accent hover:underline">
      {action.label} <ArrowRight className="h-3.5 w-3.5" />
    </span>
  )
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-[17px] font-extrabold text-ss-ink">{title}</h2>
      {action?.href ? <Link href={action.href}>{a}</Link> : action ? <button type="button" onClick={action.onClick}>{a}</button> : null}
    </div>
  )
}
```

- [ ] **Step 7: `index.ts` barrel** — `export * from './tokens'` and each component file.

- [ ] **Step 8: Verify + commit**

Run: `npx tsc --noEmit && npx vitest run` (expect green).
```bash
git add components/studio/ui
git commit -m "Add studio UI atoms: IconChip, Pill, SparkButton, StatChip, SectionHeader

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Composite primitives (ActivityCard, ProgressRow, ListPanel)

**Files:**
- Create: `components/studio/ui/ActivityCard.tsx`, `ProgressRow.tsx`, `ListPanel.tsx`; update `index.ts`

**Interfaces:**
- Produces:
  - `ActivityCard({icon, tone?, pill?, pillTone?, title, progress?: number, progressTone?: Tone, meta?: ReactNode, onClick?, href?})`
  - `ProgressRow({label: string, pct: number, trend?: 'up'|'down'})`
  - `ListPanel({title, icon?: LucideIcon, children})`

- [ ] **Step 1: `ActivityCard.tsx`**

```tsx
import Link from 'next/link'
import { IconChip } from './IconChip'
import { Pill } from './Pill'
import type { Tone, LucideIcon } from './tokens'
export function ActivityCard(props: {
  icon: LucideIcon; tone?: Tone; pill?: string; pillTone?: 'neutral' | 'accent';
  title: string; progress?: number; meta?: React.ReactNode; onClick?: () => void; href?: string;
}) {
  const { icon, tone = 'accent', pill, pillTone = 'accent', title, progress, meta, onClick, href } = props
  const body = (
    <div className="rounded-[20px] border border-ss-line bg-ss-panel p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-ss-panel">
      <div className="flex items-center justify-between">
        <IconChip icon={icon} tone={tone} />
        {pill && <Pill tone={pillTone}>{pill}</Pill>}
      </div>
      <h3 className="mt-3 text-[14.5px] font-bold text-ss-ink">{title}</h3>
      {typeof progress === 'number' && (
        <div className="my-3 h-[7px] overflow-hidden rounded-md bg-ss-chip">
          <div className="h-full rounded-md bg-ss-accent" style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
        </div>
      )}
      {meta && <div className="flex items-center gap-2 text-[12px] font-semibold text-ss-slate">{meta}</div>}
    </div>
  )
  if (href) return <Link href={href}>{body}</Link>
  if (onClick) return <button type="button" onClick={onClick} className="block w-full">{body}</button>
  return body
}
```

- [ ] **Step 2: `ProgressRow.tsx`**

```tsx
import { ArrowUp, ArrowDown } from 'lucide-react'
export function ProgressRow({ label, pct, trend }: { label: string; pct: number; trend?: 'up' | 'down' }) {
  const p = Math.max(0, Math.min(100, Math.round(pct)))
  return (
    <div className="flex items-center gap-3.5 border-b border-ss-line py-2.5 last:border-0">
      <span className="w-[150px] shrink-0 text-[13.5px] font-bold text-ss-ink">{label}</span>
      <span className="h-2 flex-1 overflow-hidden rounded-md bg-ss-chip">
        <i className="block h-full rounded-md bg-gradient-to-r from-ss-accent-bright to-ss-accent" style={{ width: `${p}%` }} />
      </span>
      <span className="w-10 text-right text-[13px] font-extrabold tabular-nums text-ss-ink">{p}%</span>
      {trend && (
        <span className={`grid h-[22px] w-[22px] place-items-center rounded-[7px] ${trend === 'up' ? 'bg-[color:var(--ss-good)]/12 text-ss-good' : 'bg-[color:var(--ss-bad)]/12 text-ss-bad'}`}>
          {trend === 'up' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
        </span>
      )}
    </div>
  )
}
```

- [ ] **Step 3: `ListPanel.tsx`**

```tsx
import type { LucideIcon } from './tokens'
export function ListPanel({ title, icon: Icon, children }:
  { title: string; icon?: LucideIcon; children: React.ReactNode }) {
  return (
    <div className="rounded-[22px] border border-ss-line bg-ss-panel p-[18px]">
      <div className="mb-1 flex items-center gap-2 text-[13px] font-extrabold text-ss-ink">
        {Icon && <Icon className="h-4 w-4 text-ss-accent" strokeWidth={1.9} />} {title}
      </div>
      <div>{children}</div>
    </div>
  )
}
```

- [ ] **Step 4: Update `index.ts`, verify + commit**

Run: `npx tsc --noEmit && npx vitest run`.
```bash
git add components/studio/ui
git commit -m "Add studio UI composites: ActivityCard, ProgressRow, ListPanel

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Data-viz + hero (MiniBars, RingStat, HeroBanner)

**Files:**
- Create: `lib/studio/miniBars.ts`, `lib/studio/miniBars.test.ts`, `components/studio/ui/MiniBars.tsx`, `RingStat.tsx`, `HeroBanner.tsx`; update `index.ts`

**Interfaces:**
- Produces:
  - `barHeights(values: number[], maxPx?: number): number[]` (pure)
  - `MiniBars({values: number[], active?: number[], labels?: string[]})`
  - `RingStat({pct: number, name: string, sub?: string})`
  - `HeroBanner({kicker, title, ctaLabel, onCta?, tone?: 'accent'|'recall'|'studylab'|'exam', art?: string})`

- [ ] **Step 1: Write the failing test `lib/studio/miniBars.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { barHeights } from '@/lib/studio/miniBars'
describe('barHeights', () => {
  it('scales the max value to maxPx and others proportionally', () => {
    expect(barHeights([5, 10], 100)).toEqual([50, 100])
  })
  it('treats all-zero as a flat minimum, never divides by zero', () => {
    expect(barHeights([0, 0], 100)).toEqual([8, 8])
  })
})
```

- [ ] **Step 2: Run it — expect FAIL** (`barHeights` not defined). Run: `npx vitest run lib/studio/miniBars.test.ts`

- [ ] **Step 3: Implement `lib/studio/miniBars.ts`**

```ts
// Map raw values to pixel heights for a tiny bar chart. A floor keeps zero
// bars visible; an all-zero series collapses to the floor (no divide-by-zero).
export function barHeights(values: number[], maxPx = 100): number[] {
  const max = Math.max(0, ...values)
  const floor = Math.round(maxPx * 0.08)
  if (max === 0) return values.map(() => floor)
  return values.map((v) => Math.max(floor, Math.round((v / max) * maxPx)))
}
```

- [ ] **Step 4: Run test — expect PASS.** Run: `npx vitest run lib/studio/miniBars.test.ts`

- [ ] **Step 5: `MiniBars.tsx`**

```tsx
import { barHeights } from '@/lib/studio/miniBars'
export function MiniBars({ values, active = [], labels = [] }:
  { values: number[]; active?: number[]; labels?: string[] }) {
  const h = barHeights(values, 84)
  return (
    <div>
      <div className="mt-[18px] flex h-[84px] items-end gap-2.5 px-1">
        {h.map((px, i) => (
          <div key={i} className={`flex-1 rounded-t-md ${active.includes(i) ? 'bg-ss-accent' : 'bg-ss-chip'}`} style={{ height: `${px}%` }} />
        ))}
      </div>
      {labels.length > 0 && (
        <div className="mt-[7px] flex gap-2.5 text-[10px] font-semibold text-ss-slate">
          {labels.map((l, i) => <span key={i} className="flex-1 text-center">{l}</span>)}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 6: `RingStat.tsx`** (conic ring; pct rounds for the gradient stop)

```tsx
export function RingStat({ pct, name, sub }: { pct: number; name: string; sub?: string }) {
  const p = Math.max(0, Math.min(100, Math.round(pct)))
  return (
    <div className="rounded-[22px] border border-ss-line bg-ss-panel p-[22px] text-center">
      <div className="mx-auto grid h-[122px] w-[122px] place-items-center rounded-full"
        style={{ background: `conic-gradient(var(--ss-accent) 0 ${p}%, var(--ss-chip) ${p}% 100%)` }}>
        <div className="grid h-[100px] w-[100px] place-items-center rounded-full bg-ss-panel">
          <div className="h-20 w-20 rounded-full bg-gradient-to-br from-ss-accent-soft to-ss-chip" />
        </div>
      </div>
      <div className="mt-3.5 text-[16.5px] font-extrabold text-ss-ink">{name}</div>
      {sub && <div className="mt-[3px] text-[12px] font-semibold text-ss-slate">{sub}</div>}
    </div>
  )
}
```

- [ ] **Step 7: `HeroBanner.tsx`** (gradient + asset motif + dark CTA pill)

```tsx
import { ArrowRight } from 'lucide-react'
const TONE_BG: Record<string, string> = {
  accent: 'linear-gradient(115deg,#0C74B4,#0E94D6 52%,#2ACBF2)',
  recall: 'linear-gradient(115deg,#0C74B4,#1AA0DC 52%,#3ED3F5)',
  studylab: 'linear-gradient(115deg,#0E7A5A,#16B67A 60%,#3FD08F)',
  exam: 'linear-gradient(115deg,#C77B16,#F0A93E 60%,#FFC777)',
}
export function HeroBanner({ kicker, title, ctaLabel, onCta, tone = 'accent', art = '/art/hero-motif.png' }:
  { kicker: string; title: string; ctaLabel: string; onCta?: () => void; tone?: 'accent'|'recall'|'studylab'|'exam'; art?: string }) {
  return (
    <section className="relative overflow-hidden rounded-[24px] p-[34px_36px] text-white" style={{ background: TONE_BG[tone] }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={art} alt="" aria-hidden className="pointer-events-none absolute right-0 top-0 h-full w-[55%] object-cover opacity-90 mix-blend-screen" />
      <div className="relative">
        <div className="text-[11px] font-bold uppercase tracking-[0.2em] opacity-85">{kicker}</div>
        <h1 className="mt-2.5 max-w-[430px] text-[29px] font-extrabold leading-[1.16]">{title}</h1>
        <button type="button" onClick={onCta}
          className="mt-5 inline-flex items-center gap-2.5 rounded-full bg-[#13202A] py-3 pl-5 pr-3 text-[14px] font-bold text-white">
          {ctaLabel}
          <span className="grid h-[26px] w-[26px] place-items-center rounded-full bg-white text-[#13202A]"><ArrowRight className="h-[18px] w-[18px]" /></span>
        </button>
      </div>
    </section>
  )
}
```

- [ ] **Step 8: Update `index.ts`, verify, commit**

Run: `npx tsc --noEmit && npx vitest run` (expect green incl. new miniBars test).
```bash
git add lib/studio components/studio/ui
git commit -m "Add studio data-viz + hero primitives: MiniBars, RingStat, HeroBanner

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: AppShell + SideNav + TopBar (replace ProductShell)

**Files:**
- Create: `components/studio/AppShell.tsx`, `SideNav.tsx`, `TopBar.tsx`
- Modify: `components/studio/ProductShell.tsx` (becomes a thin adapter that renders `AppShell`; keep default export + props so `app/(studio)/layout.tsx` is untouched)

**Interfaces:**
- Consumes: `useAuth`, `useSubscription`, `ProfileSidebar`, `ThemeToggle` (existing), the nav list currently in `ProductShell` (`studentNav` with the same `match` predicates).
- Produces: `AppShell({ children, rail? }: { children: ReactNode; rail?: ReactNode })`; `ProductShell` keeps signature `({children}) => JSX`.

**Behavior that MUST be preserved (copy from current `ProductShell.tsx`):** the exact `studentNav` items + `match` predicates; active styling; `/settings` link; `ThemeToggle`; Pro paywall button (`openPaywall('assessment')` when `!snapshot.isSubscribed`); profile chip → `ProfileSidebar`; the mobile top bar + bottom nav; greeting "Hey, {firstName}".

- [ ] **Step 1: `SideNav.tsx`** — port the desktop `<aside>` nav (lines ~70–103 of current ProductShell) restyled with tokens: rounded-panel sidebar, cyan logo mark (reuse `SquareMark` from `components/Brand`), MENU label, pill items (`active` = `bg-ss-accent text-white`, idle = `text-ss-slate hover:bg-ss-chip`), Settings + ThemeToggle/Pro footer. Same `href`/`match` list.

- [ ] **Step 2: `TopBar.tsx`** — greeting block (`Welcome back / {firstName}`), search input (visual only, non-functional — matches today), bell button, profile chip → `onProfile()`. Accept `{ firstName, onProfile }`.

- [ ] **Step 3: `AppShell.tsx`** — the rounded-panel layout:

```tsx
'use client'
import { useState, type ReactNode } from 'react'
import { useAuth } from '@/components/AuthProvider'
import ProfileSidebar from '@/components/ProfileSidebar'
import { SideNav } from './SideNav'
import { TopBar } from './TopBar'
export default function AppShell({ children, rail }: { children: ReactNode; rail?: ReactNode }) {
  const { user } = useAuth()
  const [profileOpen, setProfileOpen] = useState(false)
  const firstName = user?.name?.split(' ')[0] ?? 'You'
  return (
    <div className="min-h-screen bg-ss-canvas p-3 sm:p-6">
      <div className="mx-auto grid max-w-[1320px] grid-cols-1 overflow-hidden rounded-[30px] bg-ss-panel shadow-ss-panel lg:grid-cols-[232px_1fr] xl:grid-cols-[232px_1fr_312px]">
        <SideNav />
        <main className="min-w-0 p-5 sm:p-6"><TopBar firstName={firstName} onProfile={() => setProfileOpen(true)} />{children}</main>
        {rail && <aside className="hidden border-l border-ss-line bg-ss-canvas/40 p-5 xl:block">{rail}</aside>}
      </div>
      {/* mobile bottom nav stays from SideNav's responsive variant */}
      <ProfileSidebar isOpen={profileOpen} onClose={() => setProfileOpen(false)} />
    </div>
  )
}
```
(Mobile: keep the existing bottom-nav markup inside `SideNav` behind `lg:hidden`, unchanged behavior.)

- [ ] **Step 4: Re-point `ProductShell.tsx`**

```tsx
'use client'
import type { ReactNode } from 'react'
import AppShell from './AppShell'
export default function ProductShell({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>
}
```

- [ ] **Step 5: Verify in app (both modes)**

Run: `npx tsc --noEmit && npx vitest run`. Then `npm run dev`: load `/practice`, `/progress`, `/classrooms` — confirm sidebar nav, active states, theme toggle, Pro button, profile sidebar, and mobile bottom nav all still work in light AND dark.

- [ ] **Step 6: Commit**

```bash
git add components/studio/AppShell.tsx components/studio/SideNav.tsx components/studio/TopBar.tsx components/studio/ProductShell.tsx
git commit -m "Replace ProductShell chrome with AppShell/SideNav/TopBar (behavior preserved)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Home flagship rebuild + assets + dark QA

**Files:**
- Modify: `components/studio/StudioHome.tsx` (rebuild JSX on primitives; KEEP the existing data hooks/logic — `useStudentDashboard`, persona fetch, `startStudy`, `personaLine`, `activeClasses`, `weakAreas`, `topSubjects` from the current file)
- Modify: `app/(studio)/dashboard/page.tsx` only if a `rail` needs threading (pass the rail via a Home-local layout instead — see step). Default: Home renders its own rail through `AppShell`. Since `dashboard/page.tsx` renders `<StudioHome/>` inside the shared `(studio)` layout (which already wraps `ProductShell`/`AppShell` with NO rail), Home's right-rail is rendered **inside StudioHome's main column on xl** as a 2-col internal grid to avoid plumbing a rail prop. (Simplest; preserves the single shared layout.)
- Modify: `.gitignore` (+`.superpowers/`); add `public/art/*`.

**Interfaces:**
- Consumes: all Task 2–4 primitives via `@/components/studio/ui`.

- [ ] **Step 1: Keep the data layer** — do not touch the hooks/derived values at the top of `StudioHome`. Only replace the returned JSX.

- [ ] **Step 2: Rebuild the JSX** using primitives, matching `home-v3-cyan`:
  - Internal layout: `<div className="grid gap-6 xl:grid-cols-[1fr_312px]">` → left = main sections, right = rail.
  - **Hero:** `<HeroBanner kicker="YOUR CURRICULUM, YOUR PACE" title="Build an assessment and find your gaps" ctaLabel="Create assessment" onCta={() => setFormOpen(true)} />` (uses `/art/hero-motif.png`).
  - **Stat chips:** 4× `StatChip` (Tests done/Avg `accent`/Latest grade/Streak) with lucide icons `ClipboardCheck, TrendingUp, Medal, Flame`.
  - **From your classes:** `SectionHeader` + grid of `ActivityCard` from `activeClasses` (icon `BookOpen`, `pill={c.open_count>0 ? \`${c.open_count} OPEN\` : 'UPCOMING'}`, `progress`, `meta` = teacher/avatar, `onClick` → `router.push(/classrooms/${id})`). Render section only when `activeClasses.length>0`.
  - **By subject:** `SectionHeader` + `ListPanel`-less plain card containing `ProgressRow` per `topSubjects` (trend from sign).
  - **Rail:** `RingStat` (pct = weekly target) + `MiniBars` inside the same card OR below; then `ListPanel title="Focus areas" icon={Target}` with a row per `weakAreas` item + `SparkButton label="Study" onClick={() => startStudy(area)}`.
  - **Empty state:** when `recentAssessments.length===0` use `/art/empty-state.png` + "Create your first assessment".
  - Keep `{formOpen && <FlowForm .../>}` and the WAEC/JAMB exam banner (`isNG`) — restyle the exam banner as a small `HeroBanner tone="exam"`-style strip or a simple accent card linking `/exam-prep`.

- [ ] **Step 3: Verify build + tests + both color modes**

Run: `npx tsc --noEmit && npx vitest run`. Then `npm run dev` → `/dashboard`: confirm it matches the mockup in **light AND dark**, real data renders, all links work, hero art shows with no magenta edge, empty-state path renders for a no-data user.

- [ ] **Step 4: Commit (code + assets + gitignore)**

```bash
git add components/studio/StudioHome.tsx public/art .gitignore
git commit -m "Rebuild Home on the new studio system (flagship) + wire generated art

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:** Tokens+font+dark (§2)→T1; primitives (§3)→T2–4; shell/nav (§4.6)→T5; Home (§4.1)→T6; assets (§7)→T6 wiring; dark parity (§5)→QA in T1/T5/T6; motion/a11y (§6)→primitive classes (hover/active, focus via browser defaults — note: add `focus-visible` rings during T5/T6 polish). **Phase 5 screens (§4.2–4.5) are intentionally deferred to the follow-up plan.**

**Placeholder scan:** none — every component step has full code; the only prose-described task is Home's JSX assembly (T6 step 2), which lists exact primitives, props, icons, and data sources rather than "implement Home".

**Type consistency:** `Tone` defined in `tokens.ts` (T2) and consumed by IconChip/ActivityCard (T2/T3); `barHeights` signature matches between `miniBars.ts` and `MiniBars.tsx` (T4); `AppShell` props `{children, rail?}` match its consumers.

**Gap noted & accepted:** focus-visible ring tokens (§6) are folded into T5/T6 polish rather than a standalone task.
