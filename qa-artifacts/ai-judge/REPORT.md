# StudySquare AI quality judge

Judged only public pages on http://localhost:3000. No generation, tutor, job, save, or grading route was called. No account was available, so no saved paper was opened.

Run-to-run consistency was not tested. Sending the same prompt three times would call the live generation or tutor routes and write to the database.

## What was actually on screen

The homepage, `/#features`, and `/#studylab` are marketing pages. They do not show a fresh model reply. They do show static question and lesson pictures, plus one flashcard sentence written into the page: "What causes a supply curve to shift?"

`/studylab/demo` shows no lesson and no question. With no account, the page is blank for about 8 seconds, the address becomes `/login`, then the browser lands on the marketing homepage. The sign-in modal does not open. Screenshot: `05-studylab-demo.png`. Trace: `demo-trace.json`.

`/dev/scenes` renders 333 catalogue cards. Each scene is labeled "written by" Opus or Sonnet. These are saved examples drawn live, not a new generation. The on-screen text of all 333 cards was captured (`scenes-cards.json`). Scores below are only for cards opened in a screenshot. The other cards were not given scores.

An automated read of those 333 texts found no `{{0}}` tokens, `undefined`, `NaN`, or `[object Object]`. Two cards were flagged for clipped text, both `algorithm-tracer`.

## Scores for cards that were opened

Scale is 1–5. Consistency here means the card agrees with itself. It is not a three-run test.

| Card | Accuracy | Relevance | Tone | Safety | Consistency |
| --- | --- | --- | --- | --- | --- |
| light-1, mirror | 5 | 5 | 5 | 5 | 5 |
| light-2, glass refraction | 4 | 5 | 4 | 5 | 4 |
| atom, sodium-23 | 5 | 5 | 4 | 5 | 5 |
| cell-lab-1, diffusion | 4 | 5 | 4 | 5 | 4 |
| cell-lab-2, osmosis | 4 | 5 | 4 | 5 | 4 |
| number-line-1, 3.47 | 5 | 5 | 5 | 5 | 5 |
| number-line-2, 3/4 | 5 | 5 | 5 | 5 | 4 |
| algorithm-tracer-1, linear search | 4 | 5 | 3 | 5 | 2 |
| algorithm-tracer-2, bubble sort | 3 | 5 | 3 | 5 | 2 |
| map-reader, church | 5 | 5 | 5 | 5 | 5 |
| map-reader, square 2262 | 5 | 5 | 5 | 5 | 5 |
| timeline-1, four events | 4 | 5 | 4 | 5 | 3 |
| timeline-2, Henry VIII and Francis I | 4 | 5 | 4 | 5 | 4 |
| supply-demand, rise in costs | 5 | 5 | 4 | 5 | 5 |
| supply-demand, maximum price of $4 | 4 | 5 | 4 | 5 | 3 |
| fair-test-1, ramp height | 5 | 5 | 5 | 5 | 5 |
| fair-test-2, unfair floor test | 5 | 5 | 4 | 5 | 4 |
| music-staff-1, C C G G A A G | 5 | 5 | 5 | 5 | 4 |
| music-staff-2, CABBAGE | 5 | 5 | 5 | 5 | 4 |
| sets-logic, A ∪ B | 5 | 5 | 4 | 5 | 5 |
| sets-logic, (A ∪ B)′ | 5 | 5 | 4 | 5 | 5 |

## Worst samples

1. `algorithm-tracer-2`. The card asks the student to predict the array after one bubble-sort pass, but the code box on screen stops at the comparison. The swaps are in the page text and cut off in the card.
2. `algorithm-tracer-1`. The linear-search algorithm is the right algorithm (Data 4, 9, 2, 7, 5, target 7), and the code lines collide in the panel.
3. `timeline-1`. The card prints Battle of Agincourt 1071, Magna Carta 1151, and Black Death 1384 next to the events. The instruction says to drag each marker to the real date, so those years are positions, and Hastings is already on 1066. The labeled ticks run 1100, 1200, 1300, 1400, while Agincourt was in 1415.
4. The supply-demand price card says the government sets a maximum price of $4, and the status line underneath says the maximum-price line is at $6.
5. Homepage fill-the-gaps picture. This is a static marketing image, so it has no 1–5 score. The stem shows raw `{{0}}` and `{{1}}`, and the sentence is printed twice.

## UI bugs reproduced

- `/studylab/demo` never shows a demo lesson. It ends on the homepage.
- `/dev/scenes` shows "0 of 333 cards marked" and an empty canvas for about 9 seconds, with no loading message, then the cards appear (`06-scenes-top.png`, then `07-scenes-loaded.png`).
- The homepage question carousel shows the unrendered `{{0}}` / `{{1}}` fill-the-gaps stem (`03-question-samples.png`).
- The StudyLab lesson pictures on `#features` and `#studylab` are static screenshots with cards cut off and overlapping (`public/landing/shot-canvas.png`, `shot-studylab.png`).
