# StudySquare · StudyLab — Motion Ad Production Pack
**BrainInk · Zelios-style · 60s master**

| Spec | Value |
|------|-------|
| Master duration | 60.0s |
| Frame rate | 24 fps |
| Total frames | 1440 |
| Aspect ratios | 16:9 (1920×1080), 9:16 (1080×1920) |
| Safe title area | 10% margin all sides |
| Primary font | Inter / SF Pro Display |
| Accent color | `#007AFF` (BrainInk blue) |
| Gradient stops | `#FFFFFF` → `#E8DEFF` → `#C4B5FD` → `#7C3AED` → `#1E1B4B` |

---

## PART 1 — AFTER EFFECTS SHOT LIST

### Global motion rules
- **Ease:** Easy Ease In/Out on all position/scale; overshoot 8–12% on pill reveals (expression or 120% → 100% scale, 8 frames)
- **Shadow:** Drop shadow `0 24px 48px rgba(30,27,75,0.18)`
- **Card tilt:** Parent null rotated X: 8°, Y: -14° for isometric scenes
- **Cursor:** White fill, 3px `#6366F1` stroke, 12px drop shadow; click = scale 95% for 3 frames
- **Type stagger:** 3 frames per word on headlines

---

### SHOT 01 — Hook void
| Field | Value |
|-------|-------|
| **Comp** | `01_Hook` |
| **Duration** | 4.0s (frames 0–95) |
| **Layer stack** | BG gradient → Concentric rings (3) → Headline → Pill morph |

| Timecode | Frame | Action |
|----------|-------|--------|
| 0:00.00 | 0 | White `#FAFAFA` solid; fade in |
| 0:00.08 | 2 | Ring 1 (lavender `#E9D5FF`) scale 0% → 100%, 18 frames |
| 0:00.25 | 6 | Ring 2 scale in, +6 frame delay |
| 0:00.42 | 10 | Ring 3 scale in |
| 0:00.67 | 16 | Text line 1: "Studying shouldn't feel like" — opacity 0→100, Y +20→0 |
| 0:01.17 | 28 | Pill 1 slides up: `[ information overload ]` — red tint `#FEE2E2` bg |
| 0:02.00 | 48 | Pill 1 scale X squash 100→0 (8 frames) |
| 0:02.33 | 56 | Pill 2 scale X 0→100: `[ actual understanding ]` — green `#D1FAE5` |
| 0:03.17 | 76 | Hold |
| 0:03.67 | 88 | Pre-comp fade to white 8 frames (transition out) |

**Audio:** Whoosh at frame 16; soft bass at frame 48

---

### SHOT 02 — Problem score card
| Field | Value |
|-------|-------|
| **Comp** | `02_ProblemCard` |
| **Duration** | 5.0s (frames 96–215) |

| Timecode | Frame | Action |
|----------|-------|--------|
| 0:04.00 | 96 | Gradient bg pink→purple; card enters Z -800→0, rotate X 12° |
| 0:04.33 | 104 | Left text "Turns" slides from X -120; right text "into" from X +120 |
| 0:04.67 | 112 | Card content visible — see Figma spec `Card_ProblemScore` |
| 0:04.67 | 112 | Score counter 12/100 (red `#EF4444`) |
| 0:05.50 | 132 | Bullet list stagger, 4 frames each |
| 0:06.50 | 156 | Card border pulse red glow 1 cycle |
| 0:07.00 | 168 | Score animates 12→94 (24 frames, ease out) |
| 0:07.50 | 180 | Bullets flip to green checkmarks |
| 0:08.00 | 192 | Border green `#10B981`; subtext crossfade |
| 0:08.67 | 208 | Hold on transformed card |

**Card copy:**
```
Study session score                    12/100 → 94/100
Too much content. No structure. No memory.
• Retention 8% → 78%   • Focus Low → High   • Progress Unknown → Mapped
```

---

### SHOT 03 — Brand reveal
| Field | Value |
|-------|-------|
| **Comp** | `03_Brand` |
| **Duration** | 5.0s (frames 216–335) |

| Timecode | Frame | Action |
|----------|-------|--------|
| 0:09.00 | 216 | Full gradient sweep L→R (purple wash) |
| 0:09.33 | 224 | Sparkle ✦ top-left, scale pop |
| 0:09.67 | 232 | "Unlock your" word stagger |
| 0:10.17 | 244 | Pill highlight: `learning potential` — white text on `#7C3AED` pill |
| 0:10.67 | 256 | "with" small, centered |
| 0:11.00 | 264 | `StudySquare` — 48pt bold, scale 80→100% elastic |
| 0:11.50 | 276 | "by BrainInk" — 14pt, 60% opacity, fade in |
| 0:12.00 | 288 | Brain+grid icon scale in (logo mark) |
| 0:12.67 | 304 | Hold |
| 0:13.67 | 328 | Zoom through logo (scale 100→300%, opacity out) |

---

### SHOT 04 — Notification card
| Field | Value |
|-------|-------|
| **Comp** | `04_Notification` |
| **Duration** | 6.0s (frames 336–479) |

| Timecode | Frame | Action |
|----------|-------|--------|
| 0:14.00 | 336 | White card float in Y +60→0; shadow grows |
| 0:14.33 | 344 | StudySquare logo + "Good morning, Ada." |
| 0:14.83 | 356 | Body: "You have 3 gaps in Mathematics." |
| 0:15.33 | 368 | Nested row: Quadratic Equations · 34% mastery |
| 0:15.67 | 376 | Left label slides in: "From assessment to action" + sparkles |
| 0:16.00 | 384 | `Fix gap` button — purple `#7C3AED` |
| 0:16.50 | 396 | Hand cursor enters from bottom-right |
| 0:17.00 | 408 | Cursor hover on button (scale 102%) |
| 0:17.17 | 412 | Click — ripple circle expand + button press |
| 0:17.50 | 420 | Card flies toward camera Z +400, motion blur |
| 0:18.00 | 432 | Flash white 4 frames → cut to LearnSpace |

---

### SHOT 05 — LearnSpace hero (isometric)
| Field | Value |
|-------|-------|
| **Comp** | `05_LearnSpace_Hero` |
| **Duration** | 8.0s (frames 480–671) |

| Timecode | Frame | Action |
|----------|-------|--------|
| 0:20.00 | 480 | Dark purple bg `#1E1B4B`; dashboard parent null tilt in |
| 0:20.33 | 488 | Left panel: tutor chat chrome |
| 0:20.67 | 496 | Right panel: empty canvas grid |
| 0:21.00 | 504 | Typing in topic field: "The Quadratic Formula" — 1 char / 3 frames |
| 0:22.00 | 528 | Tutor bubble: "Let's start with the basics. Ready?" |
| 0:22.50 | 540 | Card 1 spawn: "What is a quadratic?" — scale 0→100% |
| 0:22.83 | 548 | Card 2: "Standard form" |
| 0:23.17 | 556 | Card 3: "Worked example" |
| 0:23.50 | 564 | Arrow paths draw on (trim paths 0→100%, 12 frames each) |
| 0:24.00 | 576 | Headline overlay: "Introducing StudyLab" / "Spatial AI tutor" |
| 0:25.00 | 600 | Suggestion chips fade in |
| 0:26.00 | 624 | Slow orbit camera Y ±3° |
| 0:27.67 | 664 | Hold; pre-compose for next shot |

**Layout:** 55% canvas right, 35% chat left, 10% gutter

---

### SHOT 06 — Step-by-step
| Field | Value |
|-------|-------|
| **Comp** | `06_StepFlow` |
| **Duration** | 8.0s (frames 672–863) |

| Timecode | Frame | Action |
|----------|-------|--------|
| 0:28.00 | 672 | Zoom into canvas; Step 1 cards highlighted |
| 0:28.50 | 684 | Center type: "One step." (frame 684) "One concept." (696) "One check-in." (708) |
| 0:29.50 | 708 | Chip tap: "I'm ready for the next step" — cursor click |
| 0:30.00 | 720 | Step 1 cards collapse → single pill `Step 1 ✓` |
| 0:30.50 | 732 | Camera zoom out (scale 140→100%, 24 frames) |
| 0:31.00 | 744 | Step 2 cards bloom from center (stagger 6 frames) |
| 0:31.67 | 760 | Connector lines pulse purple |
| 0:32.00 | 768 | Left label: "Making learning" / pill `spatial` |
| 0:33.50 | 804 | Hold full map |
| 0:35.67 | 856 | Transition: blur + slide left |

---

### SHOT 07 — Gap Map
| Field | Value |
|-------|-------|
| **Comp** | `07_GapMap` |
| **Duration** | 8.0s (frames 864–1055) |

| Timecode | Frame | Action |
|----------|-------|--------|
| 0:36.00 | 864 | Gap Map UI fade in |
| 0:36.50 | 876 | Title: "Learning Gap Map" |
| 0:37.00 | 888 | Row 1 Biology — bar fill 62%, pill `Developing` amber |
| 0:37.25 | 894 | Row 2 Chemistry — 31%, pill `Gap` red — highlight ring |
| 0:37.50 | 900 | Row 3 Physics — 81%, pill `Mastered` green |
| 0:38.00 | 912 | Headline: "Your weak spots." / pill `Instantly` / "mapped." |
| 0:38.50 | 924 | Cursor clicks Chemistry row |
| 0:39.00 | 936 | Row expands → "Stoichiometry" subtopic |
| 0:39.50 | 948 | Morph transition to LearnSpace (match cut on card shape) |
| 0:40.00 | 960 | LearnSpace opens with Stoichiometry cards pre-loaded |
| 0:41.67 | 1000 | Hold |
| 0:43.67 | 1048 | Fade |

---

### SHOT 08 — Persona orbit
| Field | Value |
|-------|-------|
| **Comp** | `08_Persona` |
| **Duration** | 6.0s (frames 1056–1199) |

| Timecode | Frame | Action |
|----------|-------|--------|
| 0:44.00 | 1056 | Light gradient bg; center headline "Your learning persona" |
| 0:44.50 | 1068 | Orbit card 1: "4 quizzes this week" — enters orbit radius 280px |
| 0:44.83 | 1076 | Card 2: "2 gaps to fix" |
| 0:45.17 | 1084 | Card 3: "Biology · on track" |
| 0:45.50 | 1092 | Slow rotation 0.5°/frame on orbit null |
| 0:46.00 | 1104 | Glass blur on bg cards (duplicate layer, blur 12, opacity 40%) |
| 0:48.00 | 1152 | Cards drift inward |
| 0:49.67 | 1192 | Pre-compose collapse |

---

### SHOT 09 — Transformation + score
| Field | Value |
|-------|-------|
| **Comp** | `09_Transform` |
| **Duration** | 6.0s (frames 1200–1343) |

| Timecode | Frame | Action |
|----------|-------|--------|
| 0:50.00 | 1200 | Full LearnSpace isometric — 12+ cards, dense map |
| 0:50.50 | 1212 | "Not more content." |
| 0:51.00 | 1224 | Pill: `Connected thinking.` |
| 0:51.50 | 1236 | Score card mini flies in: 94/100 green glow pulse |
| 0:52.50 | 1260 | Camera slow pull back |
| 0:54.67 | 1312 | All elements scale to 0 center (12 frames) |

---

### SHOT 10 — CTA end card
| Field | Value |
|-------|-------|
| **Comp** | `10_CTA` |
| **Duration** | 4.0s (frames 1344–1439) |

| Timecode | Frame | Action |
|----------|-------|--------|
| 0:56.00 | 1344 | Purple gradient bg |
| 0:56.17 | 1348 | StudySquare logo center |
| 0:56.50 | 1356 | "by BrainInk" |
| 0:57.00 | 1368 | Pill CTA `Open StudyLab` — scale pop |
| 0:57.50 | 1380 | Hand cursor click |
| 0:58.00 | 1392 | Sparkle burst on click |
| 0:58.50 | 1404 | `studysquare.app` fade in |
| 0:59.00 | 1416 | Hold |
| 0:59.50 | 1428 | Fade to black 12 frames |

**Audio:** Resolve chord frame 1344; sparkle frame 1392

---

### MASTER COMP STRUCTURE
```
StudySquare_60s_Master
├── 01_Hook          (0:00–0:04)
├── 02_ProblemCard   (0:04–0:09)
├── 03_Brand         (0:09–0:14)
├── 04_Notification  (0:14–0:20)
├── 05_LearnSpace    (0:20–0:28)
├── 06_StepFlow      (0:28–0:36)
├── 07_GapMap        (0:36–0:44)
├── 08_Persona       (0:44–0:50)
├── 09_Transform     (0:50–0:56)
├── 10_CTA           (0:56–1:00)
├── Music            (full length)
└── SFX              (whoosh, click, sparkle markers)
```

### 15s cutdown frame map
| Segment | Source frames |
|---------|---------------|
| Hook pill | 0–56 |
| Score transform | 156–192 |
| LearnSpace spawn | 528–576 |
| CTA | 1344–1428 |

### 30s cutdown frame map
Shots 01 + 02 + 04 + 05 + 06 + 10 (trim holds)

---

## PART 2 — FIGMA UI MOCKUP SPEC

### File structure
```
📁 StudySquare_Motion_Ad
├── 🎨 Design Tokens
├── 📱 Cards (export @2x PNG)
├── 🖥️ Scenes (full frames)
└── 🧩 Components
```

---

### Design tokens

| Token | Value |
|-------|-------|
| `color/bg/white` | `#FFFFFF` |
| `color/bg/soft` | `#FAFAFA` |
| `color/bg/gradient-start` | `#FDF2F8` |
| `color/bg/gradient-mid` | `#EDE9FE` |
| `color/bg/gradient-end` | `#1E1B4B` |
| `color/brand/primary` | `#007AFF` |
| `color/brand/purple` | `#7C3AED` |
| `color/brand/purple-light` | `#C4B5FD` |
| `color/success` | `#10B981` |
| `color/warning` | `#F59E0B` |
| `color/error` | `#EF4444` |
| `color/text/primary` | `#111827` |
| `color/text/secondary` | `#6B7280` |
| `color/text/inverse` | `#FFFFFF` |
| `radius/card` | 20px |
| `radius/pill` | 999px |
| `radius/button` | 12px |
| `shadow/card` | `0 24px 48px rgba(30,27,75,0.18)` |
| `shadow/float` | `0 8px 24px rgba(0,0,0,0.08)` |
| `font/family` | Inter |
| `font/headline` | 48px / 700 / -0.02em |
| `font/subhead` | 24px / 600 |
| `font/body` | 16px / 400 |
| `font/caption` | 13px / 500 |
| `font/micro` | 11px / 500 / uppercase |

---

### Component library

#### `Logo/StudySquare`
- 32×32 icon: brain silhouette + 4-dot grid, `#007AFF`
- Wordmark: "StudySquare" Inter 18px 700

#### `Logo/BrainInk`
- Wordmark only: "by BrainInk" 14px 500, `#6B7280`

#### `Pill/Highlight`
- Auto width, height 56px, padding 24px horizontal
- Fill `#7C3AED` or white with purple text
- Radius 999px

#### `Button/Primary`
- 120×40, `#7C3AED` fill, white 14px 600
- States: default, hover (+4% brightness), pressed (scale 98%)

#### `Button/CTA-Large`
- 200×52, `#007AFF`, "Open StudyLab"

#### `Cursor/Hand`
- 48×48, white fill, 3px `#6366F1` stroke
- Export as PNG with transparency

#### `Sparkle`
- 24×24 four-point star, `#A78BFA`, 60% opacity

---

### Card mockups (build these first)

#### `Card_ProblemScore` — 480×320
```
┌─────────────────────────────────────────────┐
│ Study session score              12/100  🔴 │
│                                             │
│ Too much content. No structure.             │
│ No memory. No progress.                     │
│                                             │
│ • Retention        8%                       │
│ • Focus            Low                      │
│ • Progress         Unknown                  │
└─────────────────────────────────────────────┘
```
- White fill, 20px radius, shadow/card
- Score: 32px 700 red; transformed state: 94/100 green

#### `Card_Notification` — 520×200
```
┌─────────────────────────────────────────────┐
│ [icon] StudySquare                          │
│                                             │
│ Good morning, Ada.                          │
│ You have 3 gaps in Mathematics.             │
│ ┌─────────────────────────────────────────┐ │
│ │ Quadratic Equations · 34% mastery       │ │
│ │                          [ Fix gap ]    │ │
│ └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

#### `Card_Concept` — 200×120 (×3 variants)
- Title 14px 600
- Optional 2-line body 12px `#6B7280`
- Left border 4px `#007AFF`
- Variants: `concept`, `code`, `diagram`

#### `Card_GapRow` — 560×56
- Subject name 16px 600 left
- Progress bar 200px center (fill by %)
- Status pill right: Gap / Developing / Mastered

#### `Card_PersonaStat` — 160×80
- Frosted glass: white 80% + backdrop blur 12
- One stat line centered

---

### Scene frames (1920×1080)

| Frame name | Size | Contents |
|------------|------|----------|
| `Scene_01_Hook` | 1920×1080 | Rings + headline + pill |
| `Scene_02_Problem` | 1920×1080 | Turns/into + problem card |
| `Scene_03_Brand` | 1920×1080 | Unlock potential + logos |
| `Scene_04_Notify` | 1920×1080 | Notification card + cursor |
| `Scene_05_LearnSpace` | 1920×1080 | Full isometric workspace |
| `Scene_06_Steps` | 1920×1080 | Canvas zoom + step pills |
| `Scene_07_GapMap` | 1920×1080 | Gap map table |
| `Scene_08_Persona` | 1920×1080 | Orbit layout |
| `Scene_09_Full` | 1920×1080 | Dense canvas + score |
| `Scene_10_CTA` | 1920×1080 | Logo + CTA + URL |

---

### LearnSpace workspace layout (Scene_05)

```
┌──────────────────────────────────────────────────────────────┐
│ 1920 × 1080                                    tilt 8° / -14°│
│  ┌─────────────┐  ┌────────────────────────────────────────┐ │
│  │ TUTOR CHAT  │  │ CANVAS                                  │ │
│  │ 360×720     │  │ 1200×720                                │ │
│  │             │  │                                         │ │
│  │ Topic input │  │   [Card1]──→[Card2]                     │ │
│  │ Tutor bubble│  │       └──→[Card3]                       │ │
│  │ Chips       │  │                                         │ │
│  └─────────────┘  └────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

**Tutor chat details:**
- Input: "The Quadratic Formula" with blinking cursor
- Bubble: gray `#F3F4F6` bg, 16px radius top-left 4px
- Chips: `Show me an example` · `I'm ready for the next step`

**Canvas details:**
- Dot grid bg `#F9FAFB`, dots `#E5E7EB` 1px every 24px
- Cards at (x,y): (400,200), (620,180), (520,340)
- Arrows: 2px `#7C3AED`, bezier connectors

---

### Gap Map layout (Scene_07)

| Subject | Bar % | Pill | Color |
|---------|-------|------|-------|
| Biology | 62% | Developing | `#F59E0B` |
| Chemistry | 31% | Gap | `#EF4444` |
| Physics | 81% | Mastered | `#10B981` |

Bar track: `#E5E7EB` 8px height; fill uses pill color.

---

### Export checklist for motion

| Asset | Format | Scale |
|-------|--------|-------|
| All cards | PNG transparent | @2x |
| Full scenes | PNG or PSD layers | @2x |
| Logo | SVG + PNG | 1x, 2x |
| Cursor | PNG | @2x |
| UI chrome (chat, canvas) | Separate layers | @2x |
| Arrows/connectors | SVG | 1x |

**Naming:** `SSQ_Card_ProblemScore_v1.png`, `SSQ_Scene05_LearnSpace_layers.psd`

---

### 9:16 reframing notes
- Center crop 1080 wide on headline + card
- Stack tutor chat above canvas (vertical)
- Orbit cards: reduce radius to 200px
- CTA: logo + button centered bottom third

---

## PART 3 — AI VIDEO PROMPT (per shot)

Use with Runway, Pika, or similar for bg plates; composite UI in AE.

**Shot 05 example:**
> Slow isometric push-in on floating glass UI dashboard, dark purple gradient background, soft studio lighting, premium SaaS aesthetic, no text, empty panels, cinematic 24fps, Zelios motion graphics style

**Shot 08 example:**
> Abstract soft pink purple gradient background, subtle floating white glass cards orbiting center, depth of field blur, minimalist tech ad, 4 seconds seamless loop

---

## PART 4 — LIVE UI REFERENCE FRAMES

Captured from the running app at **1920×1080 @2x** (dev server on `localhost:3000`).

**Folder:** `docs/motion-ad-assets/`  
**Re-capture:** `node scripts/capture-motion-ad-screenshots.js` (requires dev server + DB user)

### Screenshot → AE shot mapping

| File | Maps to shot | Use in motion ad |
|------|--------------|------------------|
| `01-dashboard-studylab-cta.png` | Shot 04 (notification alt) / CTA context | **"Open StudyLab"** card — spatial AI tutor entry point; crop the white CTA card for Shot 04 notification-style beat |
| `02-studylab-hub.png` | Shot 04 + Shot 08 | **Persona panel** ("Your Week", gaps/developing/mastered), Gap Map CTA, empty LearnSpace state — use for notification + persona orbit scenes |
| `03-gap-map.png` | Shot 07 | **Learning Gap Map** canvas — branched node UI, mastery legend (Mastered / Developing / Gap), 0% mastery badge — replace Figma mock with this |
| `04-exam-prep.png` | Optional B-roll (Nigeria) | **Exam Prep** WAEC/JAMB hub — separate product surface; use only if ad mentions exam prep |
| `05-learnspace-workspace.png` | Shot 05 + Shot 06 + Shot 09 | **Hero frame** — sidebar steps, concept/code cards, AI chat, connected canvas. Primary reference for isometric composite |
| `06-learnspace-topic-input.png` | Shot 05 (typing beat) | Same workspace with topic typed in chat input — use for character-by-character typing animation (f504) |

### What to trace from each frame

**`05-learnspace-workspace.png` (primary hero)**
- Left sidebar: step groups (`Step 1: Displaying Text ✓`, `Step 2 — in progress`), card count, progress bar
- Canvas: green step header pill, 3 linked cards (Variables · Variable Example · Explanation), code block styling
- Right chat: AI Study Assistant bubbles, suggestion flow, input bar
- **AE treatment:** Isolate layers — sidebar / canvas / chat. Parent null tilt X:8° Y:-14°. Replace dot grid bg with purple gradient in final comp

**`02-studylab-hub.png` (persona + entry)**
- Persona stats: 4 GAPS · 0 DEVELOPING · 0 MASTERED
- Gradient Gap Map banner
- Copy: *"interactive, zoomable canvas of cards, diagrams and examples"*
- **AE treatment:** Orbit the three stat pills from persona row; animate Gap Map banner as Shot 04 notification

**`03-gap-map.png` (gap beat)**
- Subject node with red **Learning Gap** border
- Legend pills top-right
- Minimap bottom-right
- **AE treatment:** Click Chemistry/English gap row → expand → morph to LearnSpace (match card corner radius)

### Brand elements visible in captures

| Element | Location | Notes |
|---------|----------|-------|
| Product name in UI | StudyLab (not StudySquare in app yet) | Motion ad uses **StudySquare** as platform brand; UI still says StudyLab for feature |
| Company | Brain Ink logo on dashboard | Use **BrainInk** in ad CTA |
| Primary blue | `#007AFF` apple-blue on buttons, icons | Matches design tokens |
| Chat label | "AI Study Assistant" / "BrainInk AI" | Use in tutor panel mock |
| Step grouping | Green header bars on canvas | Unique visual — emphasize in ad |

### After Effects import workflow

1. Import PNGs at **50% scale** (they are @2x) → 1920×1080 comp size
2. **Roto / mask** chat panel, sidebar, individual cards if animating separately
3. **Content-Aware Fill** or purple gradient behind UI for Zelios floating look
4. **Puppet pin** optional on cards for subtle float (Y ±4px, 1.5s loop)
5. Keep **real UI text** where possible — authentic beats stylized Figma mocks

### File manifest

```
docs/motion-ad-assets/
├── 01-dashboard-studylab-cta.png   504 KB
├── 02-studylab-hub.png             306 KB
├── 03-gap-map.png                  107 KB
├── 04-exam-prep.png                (Nigeria exam prep)
├── 05-learnspace-workspace.png     576 KB  ← hero
├── 06-learnspace-topic-input.png   577 KB
└── README.md
```

### Optional captures to add later

- [ ] LearnSpace after AI generates new step (cards animating in)
- [ ] Persona with weak areas populated (needs topic-mapped quiz data)
- [ ] Gap Map with multiple subject branches
- [ ] Dark mode variants

---

*BrainInk · StudySquare · StudyLab — internal production doc*
