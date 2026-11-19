# Logged-in practice routes

Signed in as the student via `POST /api/auth/login`. The returned user was stored in `localStorage` key `user` in a headless Chrome profile. Viewport 1440×900. No password change, payment, delete, quiz start, retake, new set, or generate.

None of these routes bounced to `/login` or the marketing homepage. Settled pages had no console errors and no page errors. One anonymous 404 appeared later during a navigation probe and had no URL, so it is not filed.

## Route table

| Route | Final URL | Bounced | Console errors | Layout | Navigation | Screenshot |
| --- | --- | --- | --- | --- | --- | --- |
| `/practice` | `http://localhost:3000/practice` | No | None | First visit stacks two tours. After both are skipped, the hub fits: Build your quiz, Quiz me on anything, Recall, Exam prep, Class assignment. | Open Recall, Open exam prep, Open classes, and sidebar Progress all navigate. Build / Quiz me were not clicked. | `clear-practice.png`, `diag-tours.png` |
| `/exam-prep` | `http://localhost:3000/exam-prep` | No | None | Exam prep banner and Step 1 (Cambridge Checkpoint) fit. No cut-off. | Back to Practice navigates. Start was not clicked. | `clear-exam-prep.png` |
| `/progress` | `http://localhost:3000/progress` | No | None | While loading, the page says "No results yet". After load: 123 tests, 27% average, 48 subjects. Long book titles ellipsize inside chips and rows. | Build report card navigates. Study this opens LearnSpace. Retake and New set were not clicked. | `03-progress.png`, `clear-progress.png`, `clear-progress-bottom.png` |
| `/report-card` | `http://localhost:3000/report-card` | No | None | Settled page shows the generator and 123 selected assessments. The column fits the viewport (scroll width equals the client width). Print and Save as PDF were not clicked. An earlier shot was only the auth spinner while the dev server was still compiling. | Sidebar Practice navigates. | `clear-report-card.png` |
| `/reports` | `http://localhost:3000/reports` | No | None | Student copy is readable: "This page is for teachers." | Sidebar Home navigates to `/dashboard`. Sidebar Progress does not leave the page. | `clear-reports.png` |
| `/recall` | `http://localhost:3000/recall` | No | None | For several seconds the hero says 0 cards and "Take a quiz…", with the deck list still spinning. It then settles to 601 due and 601 cards. | Back to Practice navigates. Review 601 cards was not clicked. | `clear-recall.png`, `retest-recall.png` |
| `/recall/review` | `http://localhost:3000/recall/review` | No | None | A card is on screen, "1 / 30". The subject chip is a raw file slug. Ratings were not clicked. | The Recall back link does not leave the page. | `clear-recall-review.png` |
| `/settings` | `http://localhost:3000/settings` | No | None | Profile, focus, accessibility, and password sections are reachable by scrolling the main column. Nothing was saved and the password was not changed. | Sidebar Practice navigates. "Show me around again" opens `/dashboard`. | `clear-settings.png`, `clear-settings-bottom.png` |

## Bugs

### 1. Major — Two tours open at once on Practice, Progress, and Recall

**Steps.** Fresh browser profile. Sign in. Open `/practice` (also seen on `/progress` and `/recall`).

**Expected.** One tour for the page you are on.

**Actual.** The shell's home tour ("When you get stuck", 1/3) and the page tour (Practice "From your syllabus", Progress "Where you stand", Recall "Today") are both open. The rear card is dimmed and cut off ("one subtopic on its own", "Only what you are about t"). Its Skip control sits under the front tour's overlay, so the first Skip in the page cannot be clicked. Skipping the front tour, then the remaining one, clears both (2 dialogs → 1 → 0).

**Screenshots.** `diag-tours.png`, `01-practice.png`, `03-progress.png`, `06-recall.png`

### 2. Major — Sidebar Progress does nothing on /reports

**Steps.** Signed in. Open `/reports`. Click Progress in the left menu. Then click Home.

**Expected.** Progress opens `/progress`.

**Actual.** The URL stays `http://localhost:3000/reports`. Home on the same menu does open `/dashboard`. Progress from `/practice` does open `/progress`. Repeated on three attempts, including an 8 second wait.

**Screenshot.** `clear-reports.png`

### 3. Major — Recall back link does not leave the review

**Steps.** Signed in. Open `/recall/review` and wait until the card and the "Recall" link are visible. Click Recall. Do not rate the card.

**Expected.** `/recall`.

**Actual.** The link is present (`href="/recall"`, pointer events auto, label "Recall") and the URL stays `http://localhost:3000/recall/review`. Repeated on three attempts.

**Screenshot.** `clear-recall-review.png`

### 4. Medium — Recall tells you the library is empty while it is still loading

**Steps.** Open `/recall` and read the hero before the deck spinner finishes.

**Expected.** A loading state, or the real due count.

**Actual.** The big number is a dash, the line under it says "0 cards in your library", and the pill says "Take a quiz and the ones you miss land here". At that moment the summary API already returned 601 due and 601 cards. A few seconds later the same page shows 601 and "Review 601 cards".

**Screenshots.** `clear-recall.png` (false empty), `retest-recall.png` (settled)

### 5. Medium — Progress says there are no results while they are still loading

**Steps.** Open `/progress` and read the page before the stats fill in.

**Expected.** Loading, or the student's results.

**Actual.** Stat chips stay on dashes and the recent list says "No results yet" with "Start practicing". After the dashboard request finishes the same account shows 123 tests, a 27% average, and recent result cards.

**Screenshots.** `03-progress.png` (false empty), `clear-progress.png` (settled)

### 6. Medium — "Review 601 cards" starts a 30-card session

**Steps.** Wait until `/recall` shows 601 due. Open `/recall/review` without rating a card.

**Expected.** A session whose length matches the due count on the hub.

**Actual.** The hub button says "Review 601 cards". The review page says "1 / 30". The due request returns 30 cards (the API default limit).

**Screenshots.** `retest-recall.png`, `clear-recall-review.png`

### 7. Minor — Recall card subject is a raw file slug

**Steps.** Open `/recall/review`.

**Expected.** A subject name such as Biology.

**Actual.** The chip reads `CAMBRIDGE-IGCSE-BIOLOGY-MARRY-JONES-4TH-ED`. The same style of filename shows up as a subject on Progress cards and the report card list.

**Screenshot.** `clear-recall-review.png`
