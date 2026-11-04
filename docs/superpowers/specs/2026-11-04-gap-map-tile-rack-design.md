# Gap Map: the tile rack

Status: direction and layout approved by the owner, 2026-11-04. Nothing is built yet.
Mockup to build from: `.superpowers/brainstorm/43-1793726521/content/flat.html`, shown on `gap-map-flat2.html` (your-subjects page, approved) and `gap-map-flat3.html` (chapter page, redone from the owner's sketch). Screenshots in light, dark and phone are in the same folder. Anything below marked "my call" was decided by the author, not the owner.

## Why

The Gap Map's job is: find the gaps, study them, prove they closed. Today's page gets in the way of that. Measured on the real page with a sample student:

- It opens on the least-covered subject rather than the weakest, because untested chapters count as zero. The sample opened on Chemistry, red at 13%, where the student had no gaps and averaged 74%.
- The header says "0%, 3 gaps". The 3 counts subjects, and the student has 5 gaps. From the code, the 0% stays until a student scores 80% across a whole book.
- Untested topics print "0%" (`asNumberOrNull(null)` returns 0 in `lib/studylab/wall.ts`).
- It shows one subject at a time, so "Fix these first" hides the worst topic if it is in another subject.
- "Study these areas" from a finished quiz never opens the topic it names: `selected` in `GapMap.tsx` is set and never read.
- At phone width the header collapses, the title shrinks to "G M" and two percentages overlap.
- From the code: chapters sort A to Z, and a quiz on a whole chapter colours nothing if the chapter has sections.

The owner also wants it to be a place students enjoy looking at, not a report.

## What it is

Every subject is a row of illustrated square tiles in a tray, one tile per chapter, each sitting in a slot. **A chapter with gaps lifts out of its slot, so you can see the gap.** Fix it and it drops back in. Kana, the StudySquare tutor and mascot, guides the student through it.

The structure is adapted from Brilliant's topics page, and it must not be a copy: the tile, tray, slot, plates, squares and Kana are ours.

### The owner's decisions

- Illustrated tiles in rows, then a path inside each chapter, adapted from Brilliant to fit StudySquare.
- Pictures are **flat and drawn in code**, the way interactions are. No AI-rendered images: "looks ai" was rejected.
- The pictures follow Brilliant's philosophy and level of quality in our own style: "conceptually abstract but relevant". A picture fuses the subject's real structure with something unexpected. It is never a label for the chapter.
- Kana is part of the system.
- No text under a tile except its name: more is "too much to look at and is bound to stack up".
- The chapter page does more than Brilliant's, and uses the space that short chapters leave empty.
- The owner approves pictures by eye, on a review page.
- Scene writing by Kimi was tried and dropped. The pictures still use it. Interactive cards remain the existing ones.

### Your-subjects page

- **Kana speaks first**, at the top, in a speech bubble with one button: "Tiles sticking up have gaps, and you have 5. Let's start with Quadratic equations, it's your lowest." The button is "Let's fix it" and opens that chapter on that section. She also perches on that tile. "Lowest" means the lowest latest score; a tie goes to the most recently tried, then to book order, and an untried section is never a gap (my call). When there are no gaps she celebrates and suggests something new to try.
- **One tray per subject and level**, all reachable at once with no picker. A book's name is read as a subject and a level (`lib/studylab/book-title.ts`: "Cambridge IGCSE Chemistry Coursebook" is Chemistry, Cambridge IGCSE), so two levels of one subject are two trays. Each tray has a chevron on its subject card that closes it to one short row (subject, level, tried count, gap count); the choice is saved per student in `localStorage` (`ss-gap-closed:<userId>`) and a deep link or Kana's button opens the tray it needs. The subject holding the lowest-scoring gap comes first, then those with the most gaps, then the rest. With more than 6 subjects, the rest sit behind "Show all subjects".
- **A subject card starts each tray**: the subject's name big with its level small beneath it, a grid of small squares with one per section coloured by status (the logo's squares), "6 of 16 tried", and "2 gaps" if any.
- **Gaps come first in a tray**: chapters with gaps, lowest score first, then every other chapter in book order, so a student's gaps are never off screen. Kana's perch is always on the first tile of the first tray. The row scrolls sideways when tiles do not fit, with no scrollbar (a mouse gets small chevron buttons at the edges), growing to fill short rows. Each shows only its picture, its name underneath, and one small mark.
- **A tile's state:**

| State | Rule | Look |
|---|---|---|
| Gap | Any section in the chapter is a gap | Lifted and tilted, hard flat shadow, empty dashed slot showing, red pill "2 gaps" |
| Closed | No gaps, and a section was once a gap and is now solid | Gold edge, gold ✦ |
| Shaky | No gaps, some shaky | Flat in its slot, amber – |
| Solid | Tried, all tried sections solid | Flat in its slot, green ✓ |
| Not tried | Nothing tried | Picture greyed out and faint |

- Quizzes that cannot be placed on a chapter stay visible, folded into one quiet closed card at the bottom: "Quizzes not on a chapter", "44 quizzes, average 27%". Opened, it lists each subject with its count and average, the unlinked ones last as "Other quizzes" with a line saying why they cannot be on a tile. It starts open when the student has no trays at all, and its state is saved per student. This fixed a real complaint in October, so it must not regress.
- A new student with no quizzes gets Kana inviting them to their first quiz, above their subjects' faint tiles if they have any.

### Chapter page

Opened by tapping a tile. It has its own URL, works with the browser's back button, and returns to the Gap Map. A fixed gap's tile animates down into its slot on return.

**Layout, from the owner's sketch.** Three columns at about 1 : 2 : 1, filling the screen's height so the page itself does not scroll.

- The path scrolls inside the middle column. Plates are big enough that **3 show in full**, and the next one peeks in so it is clear there is more.
- Both sides are wide, at about a quarter of the page each, and their text and pictures grow with them. The minimums are 300 px on the left and 340 px on the right (my call, so laptops still have room for the path).
- Only the shell's `<main>` scrolls a page; the path and the side columns scroll inside themselves with their scrollbars hidden (wheel, touch and keyboard still work). Kana's sheet is pinned at the foot of the middle column, centred and at most 640 px wide, so the buttons never move.
- On opening, the path scrolls only if it must, so that Kana's plate is in full view.
- Under 1320 px wide the practice card moves below the other two columns. On a phone it is one scrolling column, with larger plates and the sheet fixed above the tab bar. On opening, the phone page scrolls so Kana's plate sits clear above the sheet (my call; the phone mockup does not do this yet and starts with her plate hidden behind it).
- LearnSpace cards were designed at about 460 px. Check that a live card is usable at 340 to 394 px; if not, give it room rather than shrinking it until it is hard to read.

- **The chapter:** its picture, name, one line on what it covers, subject, "3 of 3 tried", and gaps. The topics table has no description, so the line is built from the section names, such as "Covers diffusion, osmosis and active transport", and left out when there are none (my call).
- **Where you lost marks:** up to 2 questions this student got wrong in this chapter: the question, what they said, and the right answer. Shown only when the data exists. `results.questions_data` and `results.answers` hold this, and `questions_data` carries `subtopic_id` when tagged. Skip questions that will not read well as one line, and hide the card when none are left.
- **The path:** one square plate per section, zigzagging, with its name and score beside it. Plates use the logo's four squares, with how many are lit showing how solid it is. Two bright and two dim, exactly like the logo, is shaky. Kana stands on the next one to fix.
- **Kana's sheet** speaks for the selected section and carries the actions: "Osmosis is on 34%. Want me to teach it, then you retake it?" with **Teach me this** (today's `startStudy`) and **Retake** (today's `takeQuiz`). An untried section offers **Quiz me**. She cheers when a section turns gold.
- **Try it with me first:** a real, playable LearnSpace card for this chapter, trying the selected section's name, then the chapter's other sections, then the chapter's name. `scenesFor` alone gave an enzyme card for "Plant nutrition", so a model judged each name against each example once, and `lib/studylab/practice-cards.json` holds the ones that fit (`scripts/build-practice-cards.ts`, judged by Kimi K3 because Claude on Bedrock was refused that day). A new scene means re-running the script. 735 of the 3,531 chapters (21%) get a card. It sits in the panel scaled to fit, with "Make it bigger" opening it full size. It is practice and changes no scores. A wrong card is worse than none, so with no fit it becomes Kana's "Five quick questions show me where you stand", using today's quiz action at 5 questions (my calls).
- A chapter with no sections (581 of the 2,513 drawings, across several curricula) gets one plate standing for the chapter.

**When whole-chapter and section scores both exist (my call).** They are stored apart: a section's row has `subtopic_id`, a whole chapter's has `topic_id` and `subtopic_id` 0. Section scores win. A whole-chapter score decides the tile only when no section in that chapter has been tried. It then shows on the chapter card, the plates stay untried, and if it is under 50 it counts as one gap: the pill says "Gap", and Kana's sheet offers the whole chapter ("This chapter is on 40%...") with a whole-chapter retake. Today's page drops this evidence entirely, which is one of the problems above.

### Motion

Tapping a chapter tile presses it in and pops it (about 260 ms) while Kana flies in an arc from her bubble or perch to the tile, then the chapter opens (about 420 ms after the tap). Arriving on a chapter, the plates rise one after another, 60 ms apart, and Kana drops onto hers. Tapping a plate dips it, and Kana hops in an arc from her old plate to the new one (FLIP), then the sheet's words change. Tiles stay real links: modified clicks open at once with no animation, a second tap during the flight does nothing, and a timer guarantees the navigation. With reduced motion there is no flight, pop, hop or fold animation.

## Scoring

`topic_mastery` averages every attempt ever: 3 of 10 and then a perfect 10 of 10 is 65%, still shaky. On a page whose whole promise is "fix it and it drops back in", that breaks the promise.

So, as the owner decided, the Gap Map judges a section on its **latest attempt**:

- Add `last_accuracy` and `lowest_accuracy` to `topic_mastery`, written by `upsertMasteryBucket`. `accuracy` stays as it is. Checked: only two other places read a score from this table. Admin metrics (`lib/admin/improvement-metrics.ts`) stay on the average. Lesson locks (`lib/studylab/stepLocks.ts`) move to the latest score, or a student could close a gap here and still find that lesson step locked (my call).
- Bands are unchanged: 80 and up solid, 50 to 79 shaky, under 50 gap.
- **It takes 3 questions to count as an attempt (my call).** A general quiz often asks only 1 or 2 questions on a section, and one lucky answer must not close a gap. Smaller amounts gather across quizzes until they reach 3, then count together as one attempt. Until a section has a counted attempt, it reads from `accuracy`, as today. The Gap Map's own Retake asks 10 questions (`count: 10` in `takeQuiz`), so it always counts.
- Closed means `lowest_accuracy` under 50 and `last_accuracy` 80 or more. The gold mark shows the jump, such as "42 → 88%". It has no time limit, and it leaves gold only if a later attempt falls below 80, when the section takes that attempt's band (my call).
- Existing rows backfill from past `results` where the data allows. Where it does not, both new columns take `accuracy`: the section reads as it does today, and cannot be gold until a new attempt.
- The honest cost: one bad attempt can bring a gap back, even with a good average. The page should show what the student can do now, so that is accepted.
- The migration and backfill are written and tested, then run on the live database only when the owner says so at that moment (my call). The backfill reads real students' results, so this design is not that permission.

## Pictures

2,513 drawings cover the Gap Map's 3,531 chapters, because chapters with the same meaning in the same subject family share one. Exam-prep curricula 3 and 4 are excluded, as they are from the Gap Map today.

- The run and review page live in `.superpowers/gap-art/` (git-excluded) and are in progress: `draw.js`, `server.js` at localhost:3120, `brief.js`, `topics.json` with each drawing's topic ids, `progress.jsonl`, `verdicts.jsonl`, `svg/`.
- Only drawings the owner marked Keep ship. In `verdicts.jsonl` the last line for an `id` is the verdict, as `{id, verdict: "keep" | "redo", of, note, at}`. It counts only if `of` equals the drawing's newest version in `progress.jsonl` (`server.js:25`), and the file is `svg/<id>.v<of>.svg`. "Check carefully" (the `SENSITIVE` pattern in `shared.js`) is only a tab on the review page, so a Keep is that look; nothing else needs recording.
- The run is unfinished, and the build does not wait for it (my call). The page and picture map work from whatever is kept at the time, and every other chapter gets the plain tile below. Uploading pictures to the host, and when the page goes live, are separate decisions the owner makes. A run of mostly plain tiles should not go in front of students.
- A drawing is a small SVG, averaging 4 KB. **They do not go in the app build**, which is near Amplify's 230.7 MB limit: 10 MB would use most of the headroom. Host them where figures are hosted (`NEXT_PUBLIC_FIGURE_BASE_URL`), and ship a small `topic_id` to picture map.
- Show them with `<img>`, not inlined, so they stay simple and safe. `shared.js` holds the shape allowlist and the repair browsers need.
- A chapter with no kept picture shows a plain tile in its subject colour with the logo's squares, never a broken image.
- Tile backgrounds use each subject family's soft colour from `lib/studylab/subjectFamily.ts`, in light and dark.

## Constraints

- Work on `aws_deploy` in the main repo. No worktrees, never `git stash`. Nothing is pushed without asking.
- Next.js here differs from training data: read `node_modules/next/dist/docs/` before writing code.
- Keep the `/studylab/gap-map` route and its links. Deep links from a finished quiz (`?subject=`, `?focus=`, `?assessment=`) must land on the chapter and section they name. `NextStepsPanel`, `PersonaPanel`, `StudioHome` and the lesson screens link here.
- `/api/studylab/persona` reads this API, so add to the response rather than breaking its fields. Today's `summary` numbers stay until nothing reads them.
- The product tour anchors `gapmap-canvas` and `gapmap-legend` must keep working or move with their text (`lib/product-tour.ts` and its test).
- Look: `engine-brief.md` rules 44-49 are the starting point, with the owner's agreed differences: at least 44 px tap targets on a phone, and status colours plus gold alongside the accent. Colours come from `ss-*` tokens. Kana is the real component, `components/studylab/kana/Kana.tsx`, using its poses.
- Accessibility: with no status text under tiles, each tile's accessible name must say the chapter, its state and its gap names. Everything works by keyboard. Colour is never the only signal. Reduced motion means no tilt animation, and the state still shows.
- Sort chapters by `topic_id` and sections by `subtopic_id`, not by name. The topics table has no position column; `topic_id` matched the numbered names in 66 of the 69 books that could be tested.
- Read-only counts of curriculum tables are fine. Sampling real students' data needs the owner's say-so.

## Goals

- A student sees what to fix within seconds, with no tapping, on a phone.
- Fixing a gap visibly changes the page.
- The page stays calm however many topics a student has. Rows scroll, and only the picture, the name and one mark show per tile.
- Every problem under "Why" is gone.

## Not doing

- New interactive scenes. The chapter page uses what exists.
- Pictures for sections. Plates are code.
- Session auth. Every route still trusts a client `user_id`, a known open problem, and "Where you lost marks" exposes no more than results already do. Worth noting when it is fixed.
- Teacher or class views.

## Would make this a failure, even if it worked

- It reads as a Brilliant clone, or stops looking like StudySquare.
- Text piles up under the tiles again.
- A student has to tap to find out which chapters have gaps. Gap tiles lift and name their chapter on the page, and the sections are one tap away.
- A student fixes a gap and nothing changes.
- A wrong or disrespectful picture reaches a student unreviewed.

## Left to the builder

Component structure, how the chapter URL is shaped, how the picture map is generated and stored, the migration and backfill mechanics, how many squares fit before the subject card's grid shrinks, animation details, test approach, and the order of the work. Quality bar: judge it side by side with the mockup and the approved cards, in light, dark and at phone width, with the longest real chapter names.
