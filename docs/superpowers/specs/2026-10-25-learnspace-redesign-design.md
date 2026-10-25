# LearnSpace, redesigned: learn by handling things, on a board that remembers

**Status:** Design. The user opted out of questions and asked for everything recommended, built properly, not as an MVP ("better than Brilliant and tailored to us").
**Date:** 2026-10-25
**Builds on:**
- the steerable-lessons control flow (`2026-08-24-learnspace-steerable-lessons-design.md`);
- the pedagogy layer and composable material engine (`2026-09-07-studylab-composable-material-engine-design.md`, `2026-09-14-build-material-tutor-mvp-design.md`);
- the checkpoint design (`2026-06-26-studylab-checkpoint-and-presentation-design.md`).

**Research behind it:** a full walk-through of Brilliant on 2026-10-25, covering the onboarding chat, two complete lessons with Koji, and samples of science, coding, data, logic and AI lessons. Screenshots are in the session scratchpad, `brilliant_shots/`.

## Why

LearnSpace already has three things Brilliant does not:
- **Lessons from anywhere.** Any topic in the learner's own curriculum, their homework photo, or a gap the Gap Map measured.
- **A spatial board.** The lesson builds up into a map you can come back to.
- **Montessori materials.** The tutor can build real hands-on apparatus.

What it lacks is what makes Brilliant feel good to use:
- you *do* something on every screen;
- the tutor watches your work and points at it;
- mistakes are gentle and lead somewhere;
- every interaction has a finished, physical feel.

Montessori lives in a separate mode, so most lessons are still cards to read, then a check. This redesign makes LearnSpace one product:

> **Every step starts with your hands. The tutor names what you just did. The board keeps it.**

### What "better than Brilliant" means here

1. **Tailored, not catalogued.** Brilliant has hand-built courses. We author each step for this learner, this curriculum and this gap, and still verify it before they see it.
2. **Spatial memory.** Brilliant's screens vanish behind you. Our stations stay on the board. At the end you zoom out and see the whole lesson as a map, and can revisit any of it.
3. **Exam-real.** The figure library (363k figures, real past-paper figures, vetted questions) gives checks the look of the learner's own exams.
4. **The same polish.** Two-try checks, a tutor who reads your attempt back to you, answering on the picture, animations that *show* the answer, voice, and a character.

## Principles

1. **Do, then name.** A step opens with something to handle or predict. The explanation comes after and refers to what the learner did. (Brilliant held its first explanation back until three problems in. Our current recipe explains first.)
2. **Correctness before charm.** Anything that teaches is drawn exactly: our material engine, our SVG renderer, or the figure library. Generated images are mood only, never evidence.
3. **The tutor watches and points.** It speaks first on each step about *what changed*, points at the parts it is talking about, asks rather than tells, and goes quiet during checks.
4. **Mistakes lead somewhere.**
   - Learning: amber, never red. A second try with a nudge written for that particular mistake, then help that starts from the attempt. No points lost.
   - Testing: one try, red, the answer shown, "Why?" offered first.
5. **Familiar apparatus, new work.** This is the Montessori canon from the material-engine design: a small, deeply-known set of materials that do new work in each lesson, rather than a new interface every time.
6. **Physical, quick, quiet motion.** Every state change animates in 150–300 ms, never blocks the learner, and switches off under `prefers-reduced-motion`.
7. **Author ahead, converse live.** Each step's content is generated and checked in the background before the learner reaches it, so moving through a lesson feels instant. The live model is used for conversation: help, questions, diagnosis.

## Anti-goals (failure even if it "works")

- A pretty lesson that is wrong. A material that can't be solved or a check whose key is wrong costs more trust than any animation earns.
- An endless parade of novel interfaces, where the learner spends attention on the UI instead of the idea.
- A tutor that hands out answers, or one that never lets the learner ask.
- Motion that slows down a fast learner, or sound that embarrasses one in a classroom (sound and voice are always one tap from off, and remembered).
- Losing what already works: homework help, test-out, the Gap Map, Recall, the Knowledge Wall, the board tools, the code runner.

## The lesson, start to finish

### 1. Opening

The plan negotiation from steerable lessons stays, but is shown as a **path**, not a list.

- **The lesson card** shows:
  - an illustration in the lesson's house style (see *Visual identity*);
  - the title, and a time estimate per step ("about 4 min");
  - the three-part path: **You already know** (tested-out and known steps, ticked), **Start here** (Inky, the tutor, sits on it), **Later**.
- **Reshaping chips** stay: Make it shorter, Go deeper, I know the basics.
- **For a lesson built from a measured gap,** the gap's steps are marked "made for you" and stay locked, as the policy already says.

### 2. A station (one plan step)

Each plan step becomes a **station**: a region on the board that fills as the learner works through four stages. The server owns the stage, extending `LessonRun`.

| Stage | What the learner sees | Tutor |
|---|---|---|
| **Explore** | A material or a predict/notice problem in the spotlight. They handle it. | One opening line about what to notice. Points at parts when helping. |
| **Name it** | One or two cards built on their result ("the side lengths you set, x+3 and x+1, are the factors"). | Points at the part of their work the card describes. |
| **Practice** | A near-twin: same idea, one thing changed (new numbers, a new letter, the other handle). The scaffold fades over the station. | Quieter. Helps on request. |
| **Check** | One or two questions in test mode. | Silent until it is answered. |

When the check is passed, a **station-complete scene** plays (about 1.2 s): the station tile stamps with a tick, Inky hops to the next tile, and the station's cards fold into a tidy station node on the board path. The existing `groupStep` behaviour, made visible.

### 3. Ending

- The board zooms out to the whole lesson as a map: stations joined along the path, each openable.
- The lesson-complete scene shows the stations mastered, what was practised, and a count-up of minutes learning.
- Then the streak (see *Motivation*) and the next suggestion from the Gap Map.
- The Recall deck is built from the lesson's checks, as it is today.

## The stage: layout on the spatial board

The board stays an infinite canvas. What changes is that it now has a **focus** and a **frame**.

- **Spotlight.**
  - The camera frames the active item: the material, card or check being worked on. Everything else on the board dims to about 35% and stays readable and clickable.
  - Panning or zooming freely enters *explore mode*. A "Back to lesson" pill re-centres.
  - The spotlight follows the stage: a new item glides in, and the camera eases to it.
- **The action bar** is docked beneath the active item, in screen space, so it never scrolls away:
  - before answering: Check (disabled until there is an answer);
  - after a correct answer: Why? and Continue;
  - after a wrong answer: Try again and Get help;
  - outside a check: Continue.

  It is the single control that moves the lesson forward. Continue no longer sits in the chat panel.
- **Inky and the bubble.**
  - Inky sits at the bottom-left of the board. Its lines appear as speech bubbles beside it.
  - When it points at something, the bubble carries a little arrow toward the target, and the target part glows.
  - Older bubbles fade.
  - Bubbles must never cover the active item: placement checks for overlap. Brilliant got this wrong three times in our runs.
- **The tutor drawer** replaces the permanent right-hand chat. It is collapsed by default and opens on Get help, on `/`, or with the chat button beside Inky. It holds the conversation history and the text box (with voice input). When it opens, the board shifts left, as Brilliant's help pane does.
- **The plan rail** (left) becomes the path, slimmer and collapsible. It keeps the steerable controls: skip, test out, add, reorder, pace.
- **The board tools** (palette, freeform blocks) keep their switch. They stay out of the way until it is turned on.
- **Phones:** the layout must not break, and the drawer becomes a bottom sheet. Phone polish stays deferred, as the user asked on 2026-10-08.

## The tutor

### Behaviour, all enforced in code or in the station's stage prompt, never as soft preferences

- **Speaks first.** Each station and each new item opens with one line about what changed or what to watch for ("Same constant, different middle term."). It never reads the instructions aloud.
- **Steps back.**
  - In the Check stage there are no suggestion chips, and no help until the question is answered.
  - In Practice, help is offered only after a miss.
- **Two tries, then help.**
  - First miss (learning): amber, plus the feedback written for *that* option (authored with the question).
  - Second miss: "Get help" leads, and the answer can be revealed.
  - Get help opens the drawer with "Why was my answer wrong?" sent for the learner, together with their attempt (the selected option, their typed text, or the material's current state). The tutor reads the attempt back and asks *one* question that narrows the gap ("Your sides are x+2 and x+1. What does that expand to?").
- **Points at parts.** A new `point` action addresses a part of a node: a table cell, a list item, an equation term, a worked step, a material piece or slot, or a figure region. The part glows and the bubble's arrow aims at it. The tutor uses it whenever it refers to the learner's work.
- **Asks, then diagnoses.**
  - Explanations end with a two-chip check: "Makes sense" / "Not really".
  - "Not really" gets a diagnosing question with two or three chips ("the tiles, or how they make 7x?") *before* any re-explanation.
- **Near-twin after a miss.** After a missed check or practice item, the next item is a minimal variation of the same thing (4 + 7 after missing 4 + 8), never a harder one.
- **Stays on topic.** One light line, then back to the open question ("I'm a maths tutor, not a football pundit! Back to the tiles…").
- **Never hands over the answer.** This keeps the existing homework rule. In ordinary lessons the answer is revealed only through the reveal button after two misses.

### One tutor, not two modes: merging Montessori

- **One recipe.** The classic/montessori split ends. Every new lesson uses the station recipe. `learnspaces.mode` stays as a column, for old lessons and analytics, and no longer changes the prompt.
- **Explore is material-first.** The default Explore item is a **material**: one of the nine canon patterns via `createActivity`, or a composed `build_material` from the vocabulary.
  - The pedagogy layer stays exactly as built: `TeachingIntent`, the closed `DIMENSIONS`, `refuseUnjustifiedActivities` and `refuseUnjustifiedMaterials`, `validateMaterial`, and the solvability prover.
  - Where no material honestly fits (a history source, a poem, a definition-led idea), Explore is a **predict/notice** item instead. It can be a figure from the library or a source with a question ("Look at this map. Which river do you think the city grew along?"), a quick prediction, or a sort or sequence of real examples.
  - A station never opens with a reading card.
- **Fixing Phase 1's open items while here:**
  - the balance layout's two-item cap: labels move onto the beam, raising the limit to four;
  - irrelevant art: a gate refuses a catalogue asset whose hint shares no term with the step's topic, unless the intent names it;
  - invented `vary` formulas: the authoring pass must cite the relationship, and the verifier checks it against the step;
  - the blunt `normalise()` in artMatch: replaced with an exact-or-known-plural match;
  - a unit test pinning `createActivity` and `build_material` in the unified system prompt.
- **Art.** Material pieces get **skins**: CC0 sprite sets, sourced (see *Assets*), so a sort can be robots, fruit, vehicles or planets, chosen to suit the topic.

## Generation: author ahead, in several passes

Amplify caps a request at 30 s, so authoring is a chain of short jobs, each under about 20 s, run through the existing `ai_jobs` pattern with a new job family. Station *N+1* is authored while the learner works on station *N*, and the first station is authored while they read the plan.

| Pass | Model (default; env-overridable like `JOB_MODELS`) | Output |
|---|---|---|
| Plan | Claude Sonnet 4.5 | Steps; for each step, the Explore idea, the misconception it probes, and a time estimate |
| Art direction | Claude Haiku 4.5 | The lesson's palette accent, a motif and image prompts, in the house style |
| Station: Explore | Claude Sonnet 4.5 | `TeachingIntent` + material spec (or predict/notice item) + opening line + outcome-specific hints |
| Station: Name it | Claude Sonnet 4.5 | 1–2 cards **for each likely outcome** of the explore (right first time, right after help), with `point` targets |
| Station: Practice + Check | Claude Sonnet 4.5 | A near-twin practice item and 1–2 check questions, **each wrong option carrying its own feedback** |
| Verify | Claude Haiku 4.5 + code | Engine prover (solvable), key checks (MCQ answer index, tiles fill the blanks), and an LLM judge on facts and on whether each feedback line fits its option. A failure re-runs that one pass once, then falls back to today's live beat |
| Live conversation | Claude Haiku 4.5 | Get help, diagnose, questions, asides. Short answers, `point` actions |
| Voice | Amazon Polly neural (eu-west-1) | An MP3 per tutor line, cached by hash on S3 and CloudFront |
| Mood art | Stability Stable Image Core (us-west-2) | The lesson hero and station headers, cached per topic |

**Cost per lesson, estimated** (a 5-station lesson, Sonnet for authoring, Haiku live):
- about $0.40–0.70 in text;
- about $0.03 in voice;
- art is $0 when the topic is cached, about $0.25 the first time.

Curriculum topics get their art pre-generated in a batch (about 2,600 topics × 4 images ≈ $100–200 at Core quality), *after* the house style is approved on a sample of 12 topics. Every call is recorded through the existing `ai-usage` recorder, so per-lesson cost shows on the admin dashboard.

All four checked models and services answered from the app's own credentials on 2026-10-25:
- Claude Sonnet, Haiku and Opus 4.5, through `eu.` inference profiles;
- Stable Image Core in us-west-2;
- Polly neural voices in eu-west-1. The generative engine is not offered in eu-west-1.

Nova Canvas has reached end of life.

## Visual identity

- **Tokens.** The `ss-*` tokens stay as the base. Each lesson root sets `--subject` and `--subject-soft` from a subject family table. Ticks, path tiles and the hero tint use it. The chrome stays ss-neutral, so lessons feel related.

  | Family | Hue | Subjects |
  |---|---|---|
  | Number | blue | mathematics, statistics |
  | Matter | gold | physics, chemistry |
  | Life | teal-green | biology, science |
  | World | green | geography, environmental management |
  | Code | purple | computing, ICT |
  | Data | orange | data, economics, business |
  | Words | rose | languages, literature |
  | Time | indigo | history, social studies |
  | Craft | slate | vocational, art |

  Each pair is tuned for contrast in light and dark, and stays readable without colour (WCAG 1.4.1).
- **Inky, the tutor.** An ink-drop character, from the Brain Ink brand, drawn as layered SVG in our own house style. It has states: idle with a blink, looking, talking, thinking, happy, concerned, celebrating. It is animated with framer-motion and is never a GIF. It replaces the brain icon and the "AI Study Assistant" header. *The name and design are my call; easy to change.*
- **Pressable controls.** Buttons have a bottom-edge depth, press down 2 px, and give a haptic-style scale. Big tap targets, of at least 44 px.
- **House-style illustration.** One prompt template, flat vector, soft grain, palette-locked to the subject family, so generated art reads as ours.
- **Typography.** The site fonts stay. Lesson text sits in one column of about 60–70 characters, and the board cards take the same treatment.

## Motion and sound

**Motion primitives** live in one module (`lib/studylab/motion` extended), so every component moves the same way:
- `pop` (badge or tick in), `rise` (new item in), `settle` (tile stamps);
- `stagger` (success bounce across items), `countUp` (numbers);
- `glow` (point target), `dim` (spotlight);
- `shake-soft` (wrong, a 6 px sway; never violent);
- `fly` (a progress chip flies into the header).

All are 150–300 ms, except the scenes (≤1.5 s, skippable by clicking). Every one has a reduced-motion variant: fade, or nothing.

**Animations that show the answer** are built into the materials and runners:
- the balance tips;
- the sequence slides into order with each rule line ticking;
- sorted bins close;
- the code runner steps through the lines with a ▶ marker and highlights the output;
- vary-model graphs redraw.

Correctness is shown *by the thing itself*, then confirmed by text.

**Sound.** A small set of CC0 UI sounds: correct chime, wrong soft tone, station complete, lesson complete, tile drop. One mute control covers sound and voice together, is remembered per learner, and defaults to on at home and off when the learner is in a class session.

## Voice

- **Voice out.** The tutor's lines are read in a Polly neural voice (en-GB Amy by default; en-US Ruth offered), cached on S3 by a hash of text and voice.
  - The bubble text is the caption.
  - It never reads question text or instructions, only the tutor's lines, as Brilliant does.
  - Falls back to the browser's speechSynthesis if the route fails.
- **Voice in.** Press `v` or the mic button to speak to the tutor, using the Web Speech API where the browser has it. The button is hidden where it doesn't.

## Checks and interactions

### One feedback system: `CheckBar` + `useCheckFlow`

Every answerable thing uses it: checkpoint questions, practice cards, activities, materials, and the new formats.

- **States:** idle → ready → checking → correct, or wrong-retry → wrong-final / revealed.
- **Two modes:**
  - **learn:** two tries, amber, per-option feedback, Get help;
  - **test:** one try, red "Incorrect", answer revealed with a grey tick, Why? as the primary button; once read, Continue becomes primary.
- **Badges:** ✓ / ✕ pinned to the corner of the chosen item. The chosen item stays solid while the others fade.
- **Constraint answers** (sequence rules, balance, logic-style clues) tick each condition individually.
- **Marking stays where it is today:**
  - MCQ and match are server-marked through `run.openCheck.questions`;
  - short and code answers go through the grade route, unchanged. `app/api/studylab/grade/route.ts` remains frozen.

  Two tries means calling it up to twice.

### New question formats (on `CheckpointQuestion` and practice)

- **`fill`:** a sentence with blanks and a tile bank. Tiles fly into the blanks and leave gaps in the bank.
- **`order`:** drag items into numbered slots, with an optional list of clues that tick one by one.
- **`tap`:** tap the right region(s) of a figure. Library figures with region data come later (see Non-goals). For now it covers tutor-built SVG figures and our own diagrams, whose regions we know.

All three can also be done with the keyboard: tap-to-select then tap-to-place, with arrow keys and Enter.

### Glossary popovers

Key terms in card bodies are marked with a `[[term|definition]]` markup from authoring. They render with a dotted underline and open a definition card on tap or focus.

## Motivation

- A **daily streak**, with one **streak saver** earned by completing a station (hold at most two). It shows on the hub and at lesson end, with week dots.
- **No leagues, no XP leaderboards.** Our learners include primary pupils, and competition belongs to the teacher's choice in class, not to the default.
- Progress is counted in stations mastered and minutes learned, not points.

## Assets

- **Inky:** our own SVG, drawn for this.
- **Material skins:** Kenney.nl CC0 sprite packs (characters, vehicles, food, animals, tools, space), vendored into `public/art/skins/<pack>/` with each pack's licence file. Only the needed sprites are kept, converted to WebP and SVG where possible.
- **UI sounds:** Kenney "Interface Sounds" (CC0), trimmed and normalised to `public/sounds/`.
- **House-style art:** Stability Stable Image Core, generated by us and stored on S3/CloudFront under `learnspace-art/`.
- **The existing Montessori catalogue** (`public/art/montessori`, about 100 WebP) stays and is extended.
- **Provenance:** every vendored pack records its source URL and licence in `public/art/skins/LICENSES.md`.

## Data and routes (additive only)

- **`LessonRun`:** adds `stage` on the current station (`explore | name | practice | check`), `stationOrigin` ('authored' | 'live'), and `streak` hooks. Old runs read as `stage: undefined` and keep today's live-beat behaviour.
- **New table `learnspace_station_bundles`:**
  - `(space_id, step_id, version, status, bundle jsonb, error, created_at, updated_at)`;
  - the authored station: explore item, outcome cards, practice, check, tutor lines and point targets;
  - status: `queued | authoring | verifying | ready | failed`.
- **New table `learnspace_art`:** `(topic_key, style_version, assets jsonb, created_at)`, shared across learners.
- **New table `learner_streaks`:** `(user_id, current, best, savers, last_day)`.
- **Routes:**
  - `POST /api/studylab/[id]/stations/[step]/author` starts or advances an authoring chain; `GET` returns its status;
  - `POST /api/studylab/voice` gives text → cached MP3 URL;
  - `POST /api/studylab/art` starts art generation for a topic key;
  - the tutor route gains `point`, the stage-aware turns, and the help turn that carries the attempt.

## Accessibility (kept from the WCAG waves)

- Every interaction works with the keyboard and announces its state change (`aria-live` for check results and tutor lines).
- Focus moves to the new active item, and the spotlight never traps focus.
- Reduced motion is honoured everywhere. Sound is never the only signal.
- Voice has its caption (the bubble).
- Colour is never the only carrier of right or wrong: a badge icon and text accompany it.

## Kept and retired

**Kept:**
- steerable control flow: plan negotiation, test-out, gates, pace;
- homework help;
- Gap Map, Knowledge Wall, Recall decks;
- the board tools palette;
- code runner and web sandbox;
- pedagogy layer and composable engine;
- figure library integration;
- the demo lesson, rewritten for the new flow;
- ownership and rate-limit guards.

**Retired:**
- the classic/montessori prompt split;
- the permanent right-hand chat, which becomes a drawer;
- Continue inside the chat;
- the one-shot multiple-choice card;
- the "AI Study Assistant" header, which becomes Inky.

## Non-goals (this design)

- Tap questions on *library* figures. That needs region data stored for figures (positions are known at draw time but not published). It is a figure-library follow-up.
- Leagues and social features.
- Phone-specific polish beyond "not broken".
- Changing the grade, snap or textbook-vision routes, which are frozen until the user says otherwise.

## Phases (each ships on its own, behind no flag once verified)

1. **Foundations:**
   - subject families and tokens;
   - Inky with states;
   - motion and sound modules;
   - `CheckBar` / `useCheckFlow` on every answerable node, with learn/test modes, per-option feedback and badges;
   - glossary popovers;
   - CC0 sounds vendored.
2. **The stage:**
   - spotlight camera and dimming, explore mode and Back to lesson;
   - docked action bar;
   - Inky dock and bubbles with overlap avoidance;
   - tutor drawer;
   - plan path rail;
   - station-complete and lesson-complete scenes, and the end-of-lesson map;
   - the demo lesson rebuilt on it.
3. **One tutor and author-ahead:**
   - the unified system prompt and station recipe (stages enforced by the server);
   - the authoring passes, verifier and bundles table, prefetch, and fallback to live beats;
   - speaks-first lines; steps back in checks;
   - comprehension chips and diagnosis;
   - Get help carrying the attempt;
   - the `point` action with addressable parts;
   - near-twin retries;
   - the Montessori Phase 1 open items.
4. **Interactions and showing:**
   - `fill`, `order` and `tap` formats;
   - result animations in materials and the runner;
   - per-condition ticks;
   - Kenney skins for material pieces.
5. **Tailored visuals, voice, streak:**
   - art direction pass and house style, with a 12-topic sample for the user to see, then the batch;
   - Polly voice and cache;
   - voice input;
   - streaks.
6. **Proof across subjects:**
   - drive real lessons in a browser on at least six subjects (maths, physics, biology, geography, computing, history) and one homework photo;
   - fix what the board and the verifier miss;
   - one whole-branch review;
   - deploy.

## Verification

- **Unit tests (Vitest)** for every pure module: `useCheckFlow` states, the stage transitions on `LessonRun`, bundle validation, the verifier's key checks, point-target resolution, streak arithmetic, and the art and voice cache keys.
- **Browser runs (Playwright) on the real path,** not isolated components, as the Phase 1 note insists. Use the mouse path, not just the keyboard. Take screenshots at each stage and look at them.
- **A live authoring audit:** author 20 stations across subjects and count verifier refusals, solvable materials, and checks with correct keys. The bar is 100% correct keys and ≥90% stations authored without falling back.
- **The full Vitest suite and `tsc` pass before every commit.** Lint is broken project-wide; not a gate.

## Calls I made (the user handed these over)

- Inky as the character and its name.
- Haiku for live conversation and Sonnet for authoring.
- Polly's Amy as the default voice.
- A streak with savers, and no XP leagues.
- Sound on by default at home and off in class sessions.
- Kenney CC0 packs for skins and sounds.
- Stability Stable Image Core for mood art, with the batch only after the user sees the 12-topic sample.
- Phone polish stays deferred.
- The grade route stays frozen.
