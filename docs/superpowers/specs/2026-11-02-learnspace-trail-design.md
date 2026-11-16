# LearnSpace "Trail": how a session looks and feels

Date: 2026-11-02. Status: design agreed in conversation with the owner; this document is for the builder.
Reference prototypes (throwaway HTML, open in a browser): `.superpowers/brainstorm/4790-1793576242/content/trail-demo-v2.html` (the agreed direction), `trail-demo.html` (same, unbranded), `ink-demo.html` (a rejected paged alternative). Screens of today's session and design research: `.superpowers/recon/` (`04`–`10` JPGs, `research-notes.md`).

## 1. Why

The owner's words: the session feels "messy, clustered and too many words in one place". The spatial board is what makes LearnSpace different and must stay, but it should feel premium and calm, "between what we have now, what I want and Brilliant, but not all the way to Brilliant", and it must look like StudySquare, not generic.

What the recon showed on a real lesson (economics, "Why prices settle where they do"):
- A small card sits inside three nested frames (station frame, card, inner panel) in the middle of an empty canvas.
- There are two competing buttons, a small in-card **Check** and a big **Continue**.
- "Working out a plan" is said three times at once.
- Inky is tiny in a corner, and its bubble is far from the card.
- The chat repeats Inky's bubble and logs "Added to the board" notices.
- The board toolbar (Board tools, zoom, Add block) is always visible and overlaps the station frame.
- A "name it" card is a ~100-word paragraph with bullets.
- The check shows both questions at once, joined by curving connectors, zoomed out to 86% and cut off behind the dock.

## 2. Goals, non-goals, anti-goals

**Goals**
- Keep the board spatial: one pannable, zoomable canvas where everything the learner made stays where it was made.
- Exactly one thing asks for attention at a time. It is big (body text 18–21 px) and in focus; everything else is present but quiet.
- Inky and the chat are big and readable, and say each thing once.
- The opening and the plan are visually striking, and they show the whole journey.
- The learner can always go back to any finished card or station and use it again.
- Extra explanations (detours) never make the learner lose their place.
- Everything is drawn from StudySquare's own brand.

**Non-goals (this project)**
- Redesigning the insides of the 20 scene engines and older activities. That is the parked "interactions" pass (answer style, section 4.8).
- Changing what the tutor teaches, the station recipe (explore, name, practice, check), authoring, prefetch, or marking.
- The lesson hub, Gap Map and other pages.
- Pushing anything. The owner holds all LearnSpace pushes.

**Anti-goals: it fails, even if it works, if…**
- it turns into slides or pages and loses the board (the owner rejected the paged "Ink" prototype for this reason);
- it looks like a generic template, or borrows Brilliant's look. Brilliant's fonts are commercial; take the calm, not the skin;
- it replaces the current view before the owner has confirmed it on real lessons.

## 3. Constraints

- **Stack.** Next.js 16 (read `node_modules/next/dist/docs/` before writing code; see AGENTS.md) with vendored React 19. The board is React Flow (`components/studylab/StudyCanvas.tsx`; stage in `components/studylab/stage/`: `LessonStage`, `StationScene`, `LessonTopBar`, `PlanOpening`, `OpeningCard`, `InkyDock`, `ActionDock`, `TutorDrawer`, `LessonCompleteScene`; check flow in `components/studylab/check/`).
- **React Flow CSS** loads after `globals.css`, so scope overrides under `.react-flow`.
- **`ss-*` colour tokens** are CSS variables. Tailwind opacity modifiers on them render nothing, so set alpha inline.
- **A chosen state on top of a base class** (`border-ss-line` vs a chosen border) loses to CSS order. Set chosen styles inline.
- **Light and dark themes** both work, through the existing tokens and the subject families' `dark` values.
- **The data model and server routes stay as they are.** This is a presentation layer over today's run state (stations, stages, bundles, checks, tutor turns).
- **Test on real signed-in lessons** in your own browser tab, never the demo route. Pick "Step by step" on new lessons.
- **Lean on Claude credits** (owner's standing instruction). AWS-billed checks such as live audits and scene evals are fine.

## 4. The design (decided)

### 4.1 Built alongside, behind a switch
- The current session view stays untouched and remains the default.
- The Trail view is a second presentation of the same lesson, chosen per learner by a **"Try the new look"** switch in the session's board menu. Also add a `?look=trail` URL override for testing.
- The choice persists per learner (local storage is enough for the trial).
- Switching mid-lesson keeps the learner's place.
- When the owner confirms it, a later change makes Trail the only view and removes the old one. That is out of scope here.

### 4.2 Brand system
The tokens and assets come from the app, so the builder should not invent any.
- **Fonts.** Bricolage Grotesque (`--font-display`) for headings, station names and the lesson title. Plus Jakarta Sans (`--font-sans`) for everything else. Both are already loaded in `app/layout.tsx`.
- **Colour.**
  - The `ss-*` tokens from `app/globals.css`: ink `#16202A`, slate `#636D76`, line `#EAF0F3`, chip `#F3F7F9`, canvas `#E8EEF3`, accent `#0C6FAE`, bright `#2ACBF2`, deep `#075985`, good `#047857`.
  - The lesson's **subject family** colour from `lib/studylab/subjectFamily.ts` (for example economics is Data, `#C05621` / soft `#FDEDE2`) for the current station and its accents.
  - The **brand gradient** `#2ACBF2 → #0C86CE` (the logo mark's gradient) for the primary action and for Inky.
- **The tile motif.** The StudySquare mark (a squircle holding four tiles, `public/brand/studysquare-mark.svg`) drives the visuals:
  - the board is a faint square grid;
  - the trail is laid as small two-tone tiles;
  - stations are rounded-square plots with a tile badge;
  - the opening dives "through the square".

  Never use the BrainInk brain.
- **The mascot is Kana, the StudySquare owl** (section 4.16). Kana replaces Inky in the Trail view. Wherever this document says "Inky", the Trail view shows Kana. The classic view keeps Inky until it is retired.
- **Pressed buttons.** The primary button has a hard bottom shadow and travels down on press.

### 4.3 The opening
1. **"Through the square"** (about 1.2 s; any key or tap skips it). The mark appears, its four tiles land one by one, and the camera scales through the square onto the board. Under reduced motion it is a 200 ms cross-fade.
2. **The whole board, zoomed to fit:**
   - the lesson title block (mark, "StudySquare LearnSpace", subject pill, title in Bricolage, "N stations · about M minutes");
   - the trail winding across the board, with one plot per station named from the plan;
   - the first plot in the subject colour, the rest as faint dashed outlines.
3. **Inky's question.** Inky stands on the board with a large bubble asking the existing "before we start" question, with big answer chips. A typed answer still works through the chat.
4. **The buttons.** One primary **Start**. "Change the plan" stays available as a secondary button beside it.

This replaces `PlanOpening`'s card list for the Trail view. Drafting states ("Drafting your plan…") are said once, by Inky's bubble, while the trail draws in.

### 4.4 The board
- **The world.** Station plots are laid along one trail: a smooth path through the plots, with no plot, label or title overlapping another. The plan has 4–8 stations, and the layout must hold for all of those counts; the builder chooses the algorithm (section 5).
- **Plot states.**

  | State | Look | Contents |
  |---|---|---|
  | Future | Small square, dashed | Name only |
  | Current | Opens up into a large plot | Its finished cards on one side, the focus card in the middle |
  | Done | Green tint, ✓ tile badge | Its cards filed as small thumbnails |

- **The trail.** It is drawn as tiles. The part already travelled turns green when a station completes.
- **Panning and zooming are always available.** Drag, wheel or pinch to move; arrow keys pan when the board itself has focus. If the learner moves away from their focus card, a small **"Back to my card"** pill appears.

### 4.5 One card in focus
- **The focus card.** It is about 640 px wide at full scale, with 18–21 px text. The camera centres it, at a scale that fits the card and Inky's bubble on screen (cap 1.0).
- **When a card is finished, it shrinks** (to about 0.42) beside the new focus card, inside the current plot. A quiet dashed line joins it to the card that came from it.
- **When the station is done, its cards file** into the plot as a neat row of small thumbnails (about 0.27).
- **Camera moves** take about 1.1 s with an ease-out. Under reduced motion they are instant.
- **No nested frames.** A card is a single white rounded surface; the station is the plot, not a frame around the card.

### 4.6 Inky and the chat are one voice
- **Inky's place.** Inky stands on the board next to the focus card, with one large bubble (about 21 px, at most about 25 words) holding the tutor's latest line.
- **One voice.** The bubble *is* the latest chat message. Open the chat and the bubble's lines are in it, and the bubble on the board hides while the chat is open.
- **The chat.** It opens from an **"Ask Kana"** pill as a full-height panel about 460 px wide, with 18 px messages. It stays on the **left**, where the owner previously asked for it; the demo put it on the right, and that was not a request. The board re-centres to the remaining space.
- **"Added to the board" notices go.** The camera flying to the new card is the notice.
- **Reply chips** ("Makes sense" / "Not really") appear under the bubble on the board, not at the bottom of the chat.

### 4.7 One action
- There is one primary button, bottom centre, in the brand gradient. Its label follows the moment: Start, Check, Continue, Got it, Finish station, Go to station N.
- Cards in the Trail view do not show their own Check or Continue buttons; the dock's button acts for the focus card.
- Where an activity or scene owns its own check today, route that action through the dock in this view without changing the activity's marking.

### 4.8 Answer style (where this project touches it)
For the check cards (`components/studylab/check/*`) and the station's own text cards:
- **One question at a time.** A thin step bar shows how many parts there are; the next part appears once the current one is right.
- **Choices.** Three or four big full-width choices (at least 52 px tall, 18 px text), never long lists.
- **Answers on the picture.** Where a question has a place on a picture, the answer box sits there.
- **No explanatory captions under figures.** Screen readers still get them.
- **Feedback comes through Inky's bubble and the card's state.** A right answer gets a green tick tile; a wrong one gets a gentle nudge in the bubble, not red text blocks.

The "name it" card is one large statement, an optional small figure, and a link to go deeper. Longer text is folded behind "Tell me more".

Scene engines and older activities keep their insides for now (non-goal). They must still render cleanly at the focus card's size.

### 4.9 Detours: when a question needs more than a reply
**When.** A learner's question (typed, or "Why…?" links on cards) that the tutor answers with new cards rather than a chat line.

**What it looks like.**
- A branch of tiles in the subject colour grows off the trail at the current station to a **detour plot**, and the camera flies there.
- An **orange ribbon** hangs from the top: "You were on: <station> · Back".
- The top bar's label reads "Detour".
- **One deep.** No detour starts from inside a detour; any follow-up stays in the same detour.

**Each detour card ends with "Did that clear it up?"** and three answers:
- **Back to <my card>**
- **Still not sure.** Inky adds another card to the *same* detour with a different approach (a picture if it was words, an everyday example if it was abstract, small steps if it was a leap).
- **I have another question**

After about three tries without "back", Inky **parks** it ("Let's park this and keep going; it often clicks after the next part"). The question is saved as a **"still unsure"** note shown on the station's plot, and Inky raises it again at the end of the station.

**Coming back** puts everything as it was (sliders, plotted points, typed answers), and Inky gives a one-line reminder of where the learner was.

**Afterwards** the detour's cards stay at the end of their branch, filed small, and can be reopened (4.10).

### 4.10 Looking back
- **Any finished card can be reopened.** Tap any finished or filed card, including detour cards, and it opens at full size over the current plot. Everything else dims.
- **It is interactive again.** The learner can re-slide, re-try or re-read it, but nothing they do there changes their progress, marks or the run's record.
- **A blue ribbon** reads "Looking back: <card title> · Back". **Back** (or Esc) returns the card to its place and the camera to the focus card.
- **Station plots are tappable.** The camera flies to that station; its filed cards can then be opened one by one.
- **The station name in the top bar** opens a list of stations; choosing one flies there.
- **The board menu** has "See the whole board".
- Previous lessons stay where they are today, on the hub.

### 4.11 Screen furniture
- **Top bar.** It floats, made of three pills:
  - **×** to leave;
  - progress: one short pill per station (done green, current subject colour, rest grey) plus the station name, which opens the station list;
  - **⋯ Board**, a menu with: See the whole board, Back to my card, Zoom in, Zoom out, Add a block, Sound on/off, Try the new look / Back to the classic look.
- **Bottom.** The action button sits at bottom centre, and the **Ask Kana** pill bottom-left.
- **Nothing else is permanently on screen.** The Board tools, zoom and Add block toolbar move into the menu.

### 4.12 Station and lesson end
- **Station complete:**
  - Inky celebrates;
  - the trail turns green up to the next plot;
  - the station's cards file;
  - the camera pulls back to show the journey for a moment;
  - the button becomes "Go to station N".
- **Lesson complete:** the whole board with every plot green, the trail fully green, and Inky celebrating. This is a Trail-styled version of `LessonCompleteScene`; the builder keeps its content.

### 4.13 Accessibility and motion
- Every control is reachable by keyboard. Focus order: focus card → action button → Ask Kana → top bar.
- **Esc** closes the chat, then the ribbon. The ribbon and Inky's new lines are announced politely to screen readers.
- Body text is at least 16 px everywhere and 18 px on the focus card. Text has 4.5:1 contrast, and parts that carry meaning have 3:1.
- **Under reduced motion:**
  - no camera flights (cuts instead);
  - no intro dive;
  - no tile pop-ins;
  - no bobbing Inky.
- Dark theme uses the dark `ss-*` tokens and the subject families' dark colours. The tile grid and trail stay visible at 3:1.

### 4.14 Narrow screens (phones)
It must work at 390 px wide.
- The camera fits the focus card to the width.
- The trail shows only as the top progress pills.
- The chat is a full-screen sheet.
- Detours and looking back use the same ribbon.
- "See the whole board" still shows the board, zoomed out.

Polishing phone further is out of scope.

### 4.15 Decisions made after the builder review
These were the lead's calls, made without the owner. The owner was told them and may overturn any of them.

1. **One focus card from a burst.** When a tutor turn builds several cards, the Trail view keeps a client-side **focus queue** over them. One card is in focus, and the rest wait unplaced until reached. A read-only card's button ("Got it") steps through the queue on the client, with no tutor call. When the queue is empty, the button falls back to today's `ContinueTarget` (advance, finish, focus, hand in) with its usual label.
2. **Detours need no server change.**
   - A detour is inferred on the client: a learner `ask` whose reply created cards.
   - If the reply is only a chat line, there is no detour; the line shows in Inky's bubble.
   - "Still not sure" sends an ordinary `ask` whose text the client composes ("Explain <the question> a different way: with a picture" / "an everyday example" / "in small steps"). Parking and the end-of-station reminder are client-side.
   - Detour membership and "still unsure" notes live in local storage keyed by run, for the trial. Losing them on another device is acceptable.
3. **Trail positions are derived, never saved.** The Trail layout is a pure function of the run state, so node `position`s and the classic view are untouched.
   - In Trail, cards cannot be dragged; the board pans and zooms.
   - "Add a block" creates an ordinary node through today's code, with its classic position saved as now, and the Trail view shows it in the current station's plot.
   - "Stays where it was made" means within its station's plot.
4. **The bubble shows the latest tutor line.**
   - A line over about 40 words shows its first sentence with **More**, which opens the chat at that line. The tutor's prompts are not changed.
   - Check feedback (today's `InkyLine`) shows in the bubble and as a display-only line in the chat panel. It is not written into the chat history the tutor sees.
5. **Opening chips.**
   - If the plan's question is yes/no-shaped ("Have you…", "Do you…", "Can you…", "Is…"), show **Yes, a bit** / **Not yet**, plus a small "Type an answer" that opens the chat.
   - Otherwise show free text only.
   - Several questions are asked one at a time. With none, go straight to Start.
6. **Which runs.** Trail supports station runs (`recipe: 'station'`, step by step), with plans of 3–10 stations. For every other run the switch is hidden and the classic view is used: homework spaces, runs without a recipe, run-ahead and Montessori mode.
7. **Answer style where the data exists.**
   - Big choices apply to every option list, however many options the question was written with.
   - The check's two questions come one at a time.
   - Answers go on the picture only where the question already carries positions (tap and label figures). Otherwise the standard layout is used, enlarged.
   - Activities and scenes keep their own controls, except that those already using `useDock` (`ActivityFrame`, `PracticeNode`, `QuizNode`) route their action through the dock's button.

### 4.16 Kana, the mascot
The owner supplied the rig and approved a premium redraw (2026-11-02).
- **Rig:** `.superpowers/mascot/kana-owl/`. Read its README and `src/Owl.tsx`: named parts, and the props `eyes`, `wing`, `wingT`, `beak`, `flap`, `talking`, `t`, `bob`, `tilt`, `look`, `blush`.
- **Approved look:** `kana-premium.html`, in the brainstorm content folder.
- **Never the `badge` outfit.** It has the brain on the belly. Kana always wears the suit.

**The approved redraw.** Port it into a React component in the app (for example `components/studylab/kana/Kana.tsx`), keeping the rig's prop API so poses stay simple to call.
- **Silhouette:** a rounded owl body, soft ear tufts, and a heart-shaped white face disc with a faint shadow under it.
- **Eyes:** open eyes have a blue iris (`#0B7CC4`), an ink pupil (`#0F3A5C`) and two white catch-lights.
- **Light:** the body in the brand gradient (`#2ACBF2 → #14A9EA → #0E92D6`) with a soft highlight on the head.
- **Suit:** a gradient jacket, lapels in the body blue, a knotted ink tie, and the StudySquare four-tile mark as the lapel pin.
- **Wings and feet:** feathered wings, raised and at rest; rounded toes.
- **Edge:** a white sticker edge around the silhouette and raised wings, and a soft ground shadow, not on the owl.
- **Colour:** only the brand blues, ink and white.

**Poses.** The rig's set (happy, open, wink, think, talking, surprised, sleepy, wave) plus four new ones:

| Pose | Used when | How it looks |
|---|---|---|
| **point** | Directing attention to the focus card | Right wing out, eyes on the card |
| **fly** | Moving | Both wings beating, body leaning into the motion |
| **celebrate** | A right answer, the end of a station | Both wings up, happy eyes, blush |
| **concerned** | A wrong answer | Brows up, head tilted |

**On the board.**
- **Kana flies** when the focus moves to another card, station or detour: a short arc of about 1.5 s with wings beating and a trail of small StudySquare tiles. Kana lands beside the card with a small squash.
- **Talking:** the beak moves while a new line appears in the bubble.
- **A right answer:** a hop and a short burst of tiles.
- **A wrong answer:** the concerned pose.
- **Idle:** a gentle bob and a blink every few seconds.
- **Under reduced motion,** Kana appears in place and changes pose, with no flight, trail, hop or confetti.

**Sizes.** On the board Kana stands about 130–170 px tall. In small places (the Ask Kana pill, chat avatars) use the happy pose with no extra detail, as the rig's README advises for small sizes.

## 5. Left to the builder
- **The trail and plot layout algorithm** for 4–8 stations. Its constraints: no overlaps among plots, labels, title or detour plots; a readable zoomed-out view; detours branch away from the next station's plot.
- Component structure, and how the Trail view shares state with the classic view: same run state, a different stage component.
- How reopened cards are isolated from grading and saving.
- Where "still unsure" notes are stored: run state is fine for the trial.
- Exact sizes, timings and easing within the ranges above; dark-mode tile and plot colours.
- How tutor turns that produce several cards are mapped into detour cards (4.9).

## 6. How we will know it works
- The owner tries it on real lessons through the switch and confirms. That is the gate for replacing the classic view.
- **Checks on a real economics lesson and a real maths lesson, in light and dark, at 1440×900 and 390×844:**
  - no overlaps;
  - one primary action at any moment;
  - nothing said twice;
  - every finished card reopens without changing marks;
  - a detour returns the learner to exactly where they were.
- **Unit tests:**
  - the layout has no overlaps for 4–8 stations, with and without detours;
  - looking back never changes progress or marks;
  - the action button's label matches the stage.
- Existing tests still pass, and the classic view is unchanged.
