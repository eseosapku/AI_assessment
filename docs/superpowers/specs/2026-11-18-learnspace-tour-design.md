# LearnSpace: an in-lesson tour and Kana's tool tips

Date: 2026-11-18. The owner asked for it directly and chose to skip the questions ("just dive in"). Scope: things within a LearnSpace lesson.

## Why

The owner: "make a really good demo for the learnspace, the one there is bad, laggy and doesn't work... replace/change it to something else that really helps the learners know how to navigate it. Also I want that sometime at the beginning Kana gives suggestions for tools they might not know about still, that would help their workflow."

The current demo (`/studylab/demo`, `components/studylab/DemoWorkspace.tsx` with `lib/studylab/demoLesson.ts`) runs a whole second LearnSpace (canvas, chat, lesson engine) with a scripted tutor. It is heavy, laggy, and it teaches by watching rather than by using the learner's own screen.

## What we build

**1. The tour, on the learner's first lesson.**
- When a learner opens a LearnSpace lesson and has not yet seen the introduction (`hasSeenDemo()` false), Kana offers a tour in a small card: "First time here? Let me show you around. It takes a minute." with **Show me around** and **I'll explore**.
- Either choice marks it seen (`markDemoSeen()`).
- The tour dims the screen and cuts a soft rounded hole around one real control at a time, with Kana and one or two plain sentences beside it. **Back** / **Next** sit at the bottom of the card, and step dots, **Skip tour** and Esc also work.
- Steps run in this order, and any step whose control is not on screen is skipped:
  1. `lesson-board`: the trail. Each stop is a station, and the card in front is where you are now.
  2. `lesson-plan`: the plan. Happy with it? Start. Want it different? Tell Kana here.
  3. `lesson-next`: the main button. It never moves, and it says what comes next: Start, Next step, Check.
  4. `lesson-ask`: Ask Kana. Ask anything about this lesson, or tap Kana.
  5. `lesson-stations`: Stations. Jump to any station, or see the whole board.
  6. `lesson-board-menu`: the Board menu. See the whole board or get back to your card, zoom in and out, add your own notes, and turn the sound effects on or off.
  7. `lesson-leave`: Leave any time. Your place is saved.
  8. Close: "That's it. Press Start when you're ready."
- **Movement:** the cut-out glides between controls (about 220 ms, ease-out); with reduced motion it jumps.
- **Clicks:** the dimmed area blocks clicks. The highlighted control is not clickable during the tour; Next advances.
- **Replay:** the Board menu (TrailTopBar) gains **Show me around**, which replays the tour at any time.

**2. Kana's tool tips.** These are small and in context, with no dimming.
- **What a tip looks like:** a gentle ring pulses around a control, and a small Kana card beside it says one sentence, with **Got it**. Using the control also dismisses the tip.
- **The tips.** Each shows only once, and only if the learner has not used that tool:
  - `lesson-finished` (Finished cards): "Finished cards collect here. Tap one to look back at it." Shows when the list first has a card.
  - `lesson-unsure` (Still unsure): "Not clear yet? Tap Still unsure and I'll explain it another way." Shows when the detour footer first shows.
  - `lesson-attach` (the picture button in the chat box, desktop only): "Stuck on paper? Tap the picture button to send me a photo of your working." Shows the first time the chat opens, as a slim strip directly above the input (not a floating card), so it never covers the conversation. Attaching an image marks it used.
  - `lesson-back-to-card` (the floating Back to my card button, the first time it appears): "Wandered off? This brings you straight back to your card."
  - `lesson-go-deeper` (the Go deeper link on the card in front, at the start of a lesson): "Curious? Go deeper takes a short side trip, then brings you back."
  - `lesson-detour-back` (the detour ribbon's Back, on the first detour): "You're on a side trip. Tap here to go back to where you were."
  - `lesson-look-back` (the looking-back ribbon's Back, the first time a finished card is reopened): "You're looking back at a finished card. Tap here to return to now."
  - `lesson-prove-it` (the Prove it button when the lesson is finished): "Ready? Prove it builds a short quiz, and doing well updates your Gap Map."
  - `lesson-stations`: "Lost your place? Stations shows the whole trail." Shows once the lesson has three or more stations.
  - `lesson-board-menu`: "You can add your own notes to the board from the Board menu." Shows only if adding blocks is available.
- **At the beginning of a lesson** (after the introduction is done, about 6 seconds after the first card settles, with the chat closed), Kana offers one tip about a tool that is on screen and not yet used. That makes one tip per lesson start at most.
- **Pacing:** never during the tour, never while the chat is open, and at most one tip per minute.
- **Tracking:** the learner's use of each tool is recorded in `localStorage`, read and written in try/catch, as a set of tool ids. The shown tips are recorded too. Each tool's real control marks it used: opening a finished card, Still unsure, sending from the chat, opening the Stations menu, adding a block.

**3. The old demo goes.**
- Delete `app/studylab/demo/`, `components/studylab/DemoWorkspace.tsx`, `components/studylab/DemoOffer.tsx`, `lib/studylab/demoLesson.ts` and their tests.
- The Workspace no longer renders `DemoOffer`.
- The hub's links to `/studylab/demo` in `HubAsk.tsx` and `HubLessons.tsx` go. In their place, a short line says Kana shows you around in your first lesson.
- **Keep** `lib/studylab/demoGate.ts` and its API (`hasSeenDemo`, `markDemoSeen`, `resetDemoSeen`) as the introduction gate. `StudyLabHub.tsx` and the collaborator's `tests/learnspace/browser-handoff.test.ts` use it.

## Constraints

- **Light:**
  - one fixed overlay;
  - control positions from `getBoundingClientRect`, recomputed on resize and scroll and while the camera moves (`requestAnimationFrame` while a step is shown, stopped otherwise);
  - no extra React re-renders of the board.
- **Look:**
  - the house style (ss-* tokens, Plus Jakarta Sans), with Kana from the existing components;
  - plain words, buttons that do not move, readable in light and dark;
  - on a phone, the card sits above or below the control and never covers it.
- **Accessible:**
  - the tour card is a dialog with focus kept inside it while open, and the step announced to screen readers;
  - Esc skips;
  - tips are polite live regions, not dialogs.
- **Anchors** are `data-tour` attributes on the real controls. `lesson-board` and `lesson-composer` already exist; add the rest.
- **No regressions:** the existing LearnSpace tests (`tests/learnspace`, `components/studylab`) still pass.

## How it is checked

- **Unit tests:** which steps run given which anchors exist; which tip comes next given visible tools, used tools, shown tips and time; and that using a tool marks it.
- **In the real lesson page:** replay the owner's recorded lesson (`.superpowers/trail-motion/replay.cjs` with the recording in `.superpowers/trail-motion/recordings/sonder`), with no AI and no database. Take screenshots of every tour step and of each tip, in light and dark, at desktop and phone width.
