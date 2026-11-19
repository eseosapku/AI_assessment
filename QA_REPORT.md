# QA report — StudySquare local

Date: 2026-11-19. Target: http://localhost:3000 only. No production host. No application code was changed. No signup, password reset, payment, or quiz generation was submitted, because those write to the database or send email.

Personas: [first-time](4cbc8616-af80-488e-85fb-90d752afbc0b), [power user](5fa52dbb-c544-4ba4-a5e9-d15dbcf308e0), [impatient](efbec34b-c79d-4618-b20a-b6eb3797e646), [adversarial](ee2770e0-14d7-447f-8556-66d0cd6bad8c), [non-English](9b4860fe-b708-4249-b226-e31e281c44aa), [mobile](1e3daaa6-ee63-4dc8-99be-c58cceda7fa8), [AI judge](9afb9d76-b4d3-45b4-bd20-b3860f34f518).

## Summary

| Severity | Count |
| --- | --- |
| Critical | 0 |
| Major | 13 |
| Minor | 24 |

No test accounts were provided, so signed-in product flows were not exercised. Live model output was not generated, because `POST /api/generate-assessment` inserts an assessment row.

## Issues

### 1. Rwanda signup skips Grades 2–5

- Severity: major
- Persona: mobile, confirmed in the browser
- Steps: Open http://localhost:3000/ on a 390px-wide viewport. Choose Get started. Leave Country as Rwanda and Studying at as School. Open Class / Grade.
- Expected: A primary student can choose Grades 2, 3, 4, and 5.
- Actual: The options are Grade 1, then Grade 6 through Grade 12, then college years. Grades 2–5 are absent. The same list is hardcoded for `RW` in `lib/countries.ts` (`classOptionsForCountry`). The signed-in settings page shows the same gap: Class / section is Grade 1, then Grade 6 through Grade 12, and this account is saved as Grade 1.
- Screenshot: `qa-artifacts/lead/qa-signup-mobile.png`
- Database: not written. The form was not submitted.

### 2. "Exam prep" in the header opens Features

- Severity: minor
- Persona: first-time
- Steps: On http://localhost:3000/, read the header links Features and Exam prep.
- Expected: Exam prep moves to the exam-prep section.
- Actual: Both links are `href="#features"`. LearnSpace is `#studylab` and Pricing is `#pricing`.
- Screenshot: `qa-artifacts/lead/qa-home-desktop.png`

### 3. A phone has no visible Sign in

- Severity: major
- Persona: mobile
- Steps: Open http://localhost:3000/ at 390×844. Tap Get started. Scroll the create-account dialog to the bottom.
- Expected: A returning student can see Sign in.
- Actual: The header hides Features, LearnSpace, Exam prep, Pricing, and Sign in. There is no menu button. Get started opens Create account, and the bottom of that dialog is the Create Student Account button. No Sign in label is on screen. A Sign in control is in the dialog markup, but it was not visible after scrolling. On `/signup`, "Already have an account? Sign in" is below the first screen. `/forgot-password` does show Back to Login on the first screen.
- Screenshots: `qa-artifacts/mobile/screenshots/home-390x844.png`, `qa-artifacts/mobile/screenshots/home-390x844-modal-sign-in-bottom.png`

### 4. A fresh section link stays on the hero

- Severity: major
- Persona: mobile, also first-time
- Steps: Open http://localhost:3000/#features, `/#how`, `/#pricing`, and `/#studylab`. Wait until the hero heading is visible. Then, on a homepage that has already loaded, click those same labels.
- Expected: Each address opens that section.
- Actual: On a fresh open the hash stays in the address bar and the scroll position stays 0. Pricing is about 8807px down at 390px. Clicking Features, LearnSpace, Exam prep, Pricing, or See how it works after the homepage has loaded does scroll.
- Screenshots: `qa-artifacts/mobile/screenshots/pricing-390x844.png`, `qa-artifacts/first-time/02-features.png`, `qa-artifacts/first-time/04-pricing.png`

### 5. Show-password has no accessible name

- Severity: minor
- Persona: first-time
- Steps: Open Sign in. Inspect the eye button beside Password. The same control is on Create account, beside Password and Confirm password.
- Expected: Each button has an accessible name such as "Show password".
- Actual: Those buttons have no text, no `aria-label`, and no `title`. On the signup form the eye control is 16×16. The dialog close control is 31×31, and the theme toggle is 38×38. The fields themselves are labelled. The theme toggle does have the name "Toggle theme".
- Screenshot: `qa-artifacts/lead/qa-signin-modal.png`. Signup dump: `qa-artifacts/non-english/extract-signup-forgot.txt`

### 6. Celebration art is missing

- Severity: minor
- Persona: impatient (console), confirmed with a HEAD request
- Steps: Request `HEAD http://localhost:3000/art/celebration.png`.
- Expected: 200, and the graphic on the final call to action.
- Actual: 404. The homepage image uses `onError` to hide itself, so the user sees a blank corner rather than a broken-image icon. The impatient pass also recorded one console line: "Failed to load resource: the server responded with a status of 404".
- Screenshot: none of the broken icon, because it is hidden. Evidence is the 404 and `components/LandingPage.tsx` (`/art/celebration.png`).

### 7. A non-JSON login body returns 500

- Severity: minor
- Persona: adversarial
- Steps: `POST http://localhost:3000/api/auth/login` with `Content-Type: text/plain` and body `this is plain text`.
- Expected: 400, because the body is not JSON.
- Actual: 500 and `{"error":"Login failed"}`. The server log is `SyntaxError: Unexpected token 'h', "this is plain text" is not valid JSON`. The response body has no stack trace and no secret.
- Screenshot: not a page. Notes: `qa-artifacts/adversarial/report.md`

### 8. The signup story hides the Improve step

- Severity: minor
- Persona: impatient
- Steps: Open http://localhost:3000/signup at 1440px width and wait until the account form has drawn. Look at the left panel.
- Expected: Assess, Study, and Improve can all be read.
- Actual: The Classroom ready card covers the Improve card. Only its check mark still shows. The account form on the right is fully drawn.
- Screenshot: `qa-artifacts/impatient/signup-story-crop.png`

### 9. A homepage sample still shows {{0}} and {{1}}

- Severity: minor
- Persona: AI judge
- Steps: Open http://localhost:3000/#features and look at the fill-the-gaps sample.
- Expected: The sample uses blanks, as the card underneath it does.
- Actual: The picture says "remain {{0}}. This relationship is described by {{1}}'s Law." The card below it uses real blanks and a word bank.
- Screenshot: `qa-artifacts/ai-judge/03-question-samples.png`

### 10. The Rwanda option shows "rw" instead of a flag

- Severity: minor
- Persona: non-English
- Steps: Open http://localhost:3000/signup. Leave Country on Rwanda.
- Expected: The closed control shows a flag or the word Rwanda.
- Actual: It shows a globe icon and "rw Rwanda". The option text in the page is the flag emoji, which this Windows browser draws as the letters "rw".
- Screenshot: `qa-artifacts/non-english/signup-1440x900.png`. Closer crop: `qa-artifacts/first-time/21-country-crop.png`

### 11. At 768px the header is crushed against the logo

- Severity: minor
- Persona: mobile
- Steps: Open http://localhost:3000/ at 768×1024.
- Expected: The logo, nav, theme toggle, Sign in, and Get started have space between them and stay on one line.
- Actual: Features starts at the logo's right edge. Exam prep, Sign in, and Get started wrap onto two lines. Sign in is visible. The page does not scroll sideways.
- Screenshot: `qa-artifacts/mobile/screenshots/home-768x1024.png`

### 12. Sign-in links land on the homepage with no form

- Severity: major
- Persona: first-time
- Steps: Open http://localhost:3000/login. Also use the Sign in link on `/signup` and Back to Login on `/forgot-password`. Both point at `/login`.
- Expected: A sign-in form.
- Actual: `/login` redirects to `/` and shows the marketing homepage. The sign-in dialog does not open. The header Sign in button on that homepage does open the form.
- Screenshots: `qa-artifacts/first-time/08-login.png`, `qa-artifacts/first-time/18-sign-in-modal.png`

### 13. LearnSpace and StudyLab are two names for one tool

- Severity: minor
- Persona: first-time
- Steps: On the loaded homepage, click LearnSpace.
- Expected: One name for the lesson tool.
- Actual: The nav says LearnSpace. The section says "StudyLab isn't a chatbot in a box" and the button says "Try StudyLab free."
- Screenshot: `qa-artifacts/first-time/13-click-studylab.png`

### 14. Finished quizzes are titled with the textbook file name

- Severity: minor
- Persona: logged-in student
- Steps: Sign in as the student and read the recent quizzes on `/dashboard`, or `GET /api/dashboard/student` for that account.
- Expected: A quiz title a student can read, such as the subject and the paper style.
- Actual: The six newest results use the source file as the title. Examples: `Cambridge International AS _ A Level Economics Fourth edition Coursebook`, `Cambridge-IGCSE-Biology-MARRY-JONES-4th-Ed`, and a chemistry title with a trailing space. All six are grade D. Scores are 0, 6, 17, 25, 0, and 0. The account has 123 quizzes and an average of 27. Two classes come back: Grade 5 Science (9 finished) and Grade 6 Science (2 to do, 9 finished).
- Screenshot: the dashboard list. Data was read from the student dashboard API. Nothing was written.

### 15. The profile says Grade 1 while the classes are Grade 5 and Grade 6

- Severity: minor
- Persona: logged-in account menu
- Steps: Sign in and open the Sumba profile menu.
- Expected: The grade matches the classes the student is in.
- Actual: The menu says Grade1 and student ID STD-2024-3169. The class list is Grade 5 Science and Grade 6 Science. The subscription line says active.
- Screenshot: the profile panel text captured during the account-menu pass. Nothing was saved.

### 16. A student with 123 quizzes is told to start their first practice

- Severity: minor
- Persona: logged-in account menu
- Steps: Sign in and open Notifications.
- Expected: The notice matches a student who already has quizzes.
- Actual: The only unread notice says "Start your first practice. Keep your streak alive." The same account has 123 quizzes.
- Screenshot: notifications panel from the account-menu pass. Nothing was marked read by this check.

### 17. Notifications sit on top of the profile menu

- Severity: minor
- Persona: logged-in account menu
- Steps: On the dashboard, open Notifications. Tab to the Sumba button and press Space.
- Expected: The notifications panel closes when the profile sheet opens.
- Actual: Both stay open. The notifications card covers a 198×130 area of the profile sheet, including the profile photo. A mouse click on Sumba while the list is open hits the backdrop and only closes Notifications. Settings is the only page in that menu. It opens and shows Profile & security, with no paywall. Profile, subscription, and report card are not separate links.
- Screenshot: `qa-artifacts/logged-in-account/07-menus-overlapping.png`

### 18. Close profile cannot be clicked while the tour layer is up

- Severity: minor
- Persona: logged-in dashboard
- Steps: Sign in so the quiz tour is on screen. Open the profile sheet, then click Close profile.
- Expected: The profile sheet closes.
- Actual: The Close profile button is visible, but a full-screen layer (`fixed inset-0`, z-index 80) takes every click for at least 30 seconds. The button never receives the click. Skip the tour and Got it themselves do work, and on a phone they sit above the bottom bar.
- Evidence: the dashboard retry log. The page itself did not crash.

### 19. Two tours open at once

- Severity: minor
- Persona: logged-in StudyLab and practice
- Steps: Sign in on a fresh profile. Open `/studylab`, `/studylab/gap-map`, `/practice`, `/progress`, `/recall`, `/report-card`, and `/classrooms`.
- Expected: One coach mark for the page you are on.
- Actual: A Home card titled "Ask for a lesson, not an answer" opens on these pages and highlights LearnSpace in the sidebar. On Practice, Recall, Progress, and LearnSpace, that page's own tour is open behind it. Skipping the front tour, then the one left behind, clears them.
- Screenshots: `qa-artifacts/logged-in-studylab/01-studylab.png`, `qa-artifacts/logged-in-practice/diag-tours.png`, `qa-artifacts/logged-in-student/final-studylab.png`

### 20. The lesson board cuts off the lower card

- Severity: major
- Persona: logged-in StudyLab
- Steps: On `/studylab`, open the first lesson, Continue on Mastering 1.1 Photosynthesis. Do not send a new prompt.
- Expected: The whole activity card is visible, or the board scrolls to it.
- Actual: The board is 1440×900 with overflow hidden. The lower card extends to y=1026 and its bottom is cut off. Scrolling does not bring it into view. The center check card is fully visible.
- Screenshot: `qa-artifacts/logged-in-studylab/02-lesson.png`

### 21. The demo lesson URL is an error

- Severity: major
- Persona: logged-in StudyLab
- Steps: While signed in, open `/studylab/demo`.
- Expected: A demo lesson.
- Actual: The page stays on `/studylab/demo` and shows "Invalid LearnSpace id" with Back to StudyLab. The lesson request returns 400. No new lesson was created.
- Screenshot: `qa-artifacts/logged-in-studylab/04-demo.png`

### 22. On a phone, the Practice Recall card sits under the bottom bar

- Severity: minor
- Persona: logged-in mobile
- Steps: Sign in and open `/practice` at 390×844.
- Expected: The Recall card's title and Open Recall button sit above the bottom navigation.
- Actual: The bottom bar starts at y=755. The Recall title starts at y=767 and Open Recall is at y=857, so both are covered until the page is scrolled. Exam prep and Class assignment are further down and can be scrolled clear. Settings fields, including the password show buttons, can all be reached by scrolling.
- Screenshot: `qa-artifacts/logged-in-mobile/practice-fold.png`

### 23. Phone nav labels run together

- Severity: minor
- Persona: logged-in mobile
- Steps: Sign in at 390×844 and look at the bottom bar on Home, Practice, LearnSpace, Classes, Progress, or Settings.
- Expected: LearnSpace and Gap Maps read as two names.
- Actual: They sit about 1px apart and read as "LearnSpaceGap Maps".
- Screenshot: `qa-artifacts/logged-in-mobile/settings.png`

### 24. Refreshing classrooms shows no classes

- Severity: major
- Persona: logged-in impatient
- Steps: Sign in, open `/classrooms`, and refresh once.
- Expected: Grade 5 Science and Grade 6 Science are listed. The page does not return a 500.
- Actual: The page stays on `/classrooms` as Sumba and returns HTTP 200. The classrooms API also returns those two classes. The screen says "No classes yet." A later signed-in open of the same page, without a refresh, showed the same empty sentence.
- Screenshots: `qa-artifacts/logged-in-impatient/screenshots/classrooms-refresh-failed.png`, `qa-artifacts/logged-in-student/final-classrooms.png`

### 25. Subject names are cut off on the dashboard

- Severity: minor
- Persona: logged-in dashboard
- Steps: Sign in and look at "How each subject is going" after the stats have loaded.
- Expected: Each subject name can be read.
- Actual: Four names are wider than their 140px boxes: Cambridge Primary Science 5 (193px), Completing the square (150px), Literary Devices in Literature (186px), and Explain Albert Camus' Absurdity (210px). The heading "Build an assessment and find your gaps" is not cut off. The next-step label is also jammed together as "DO THIS NEXTCheck that it stuck".
- Evidence: the settled dashboard measurement. The same cut-off names are in `qa-artifacts/logged-in-classes/15-dashboard-subjects.png`.

### 26. Unfinished classwork is listed as finished

- Severity: major
- Persona: logged-in classes
- Steps: Sign in, open Classes, then Grade 6 Science. Look at Finished.
- Expected: Finished means the student completed the work. The count of 9 matches completed items. Names are readable.
- Actual: The list says 2 open and 9 done. Finished includes `oklsdn` / `klJSDCOSD` and three Deadline passed cards that still say attempts are left. Those were not completed. Open and finished names are raw book files, such as `General Edu-Kiswahili-S3-SB`, repeated as the title and the line under it.
- Screenshot: `qa-artifacts/logged-in-classes/26-grade6-oklsdn.png`

### 27. One result shows 19% and 50%

- Severity: major
- Persona: logged-in classes
- Steps: On Grade 6 Science, open View feedback on the finished card titled `test`.
- Expected: One score, and the title is the assignment that was opened.
- Actual: The header is 19% (5/7 multiple choice, 0/19 written marks, grade D). Lower down, What to work on next says math, 50%, and 5 of 10 correct. The review title is `Assessment`, not `test`.
- Screenshot: `qa-artifacts/logged-in-classes/23-assignment-score-panel.png`

### 28. A written answer is marked as no answer

- Severity: minor
- Persona: logged-in classes
- Steps: On that same `test` review, open Question 4 (long form, 6 marks).
- Expected: The written answer is what gets marked.
- Actual: The answer shown is the letter `n`. The mark is 0/6 and every criterion is N. The feedback says the student did not provide a response.
- Screenshot: `qa-artifacts/logged-in-classes/25-assignment-q4.png`

### 29. A marked answer disagrees with its explanation

- Severity: major
- Persona: logged-in classes
- Steps: On that same review, read Question 2.
- Expected: The option marked correct matches the explanation.
- Actual: The question asks which option is not an elementary row operation. `Row multiplication` is marked correct. The explanation says row scaling is valid and that "Row multiplication" is only the wrong name for it. Row scaling is also one of the choices.
- Screenshot: `qa-artifacts/logged-in-classes/24-assignment-q2.png`

### 30. A blank biology paper is shown as every question wrong

- Severity: minor
- Persona: logged-in classes
- Steps: Open the review titled `Cambridge-IGCSE-Biology-MARRY-JONES-4th-Ed`. Read the summary, Question 9, and Question 10.
- Expected: Unanswered questions say they were not answered. Explanations name the choices on the screen.
- Actual: Every question has a red X and no "not answered" line. The summary says every question was left blank, and What you did well treats that blank paper as a strength. Question 9's choices are not lettered, but the explanation talks about options A, C, and D. Question 10's explanation begins "10 is correct" while the marked answer is Substrate.
- Screenshots: `qa-artifacts/logged-in-classes/21-quiz-result-top.png`, `qa-artifacts/logged-in-classes/22-question-9.png`, `qa-artifacts/logged-in-classes/22-question-10.png`

### 31. Totals flash as zero while the lists are loading

- Severity: minor
- Persona: logged-in classes
- Steps: Open Home, then Grade 6 Science, and look before the lists fill in.
- Expected: A loading state, then the real totals.
- Actual: Home first says Nothing to review yet, No quizzes yet, and Take your first quiz. The class summary first reads 0 upcoming, 0 open, and 0 finished while the lists are still spinning. Both then fill in.
- Screenshot: `qa-artifacts/logged-in-classes/debug-dash.png`. The same empty copy also appears beside "1 quiz this week · 0% avg" in `qa-artifacts/logged-in-dashboard/11-dashboard-desktop-00.png`. After the list loads, the page shows 27% across 123 quizzes.

### 32. A quiz topic chip runs into the card illustration

- Severity: minor
- Persona: logged-in dashboard
- Steps: Sign in, dismiss the tour, and scroll to Your recent quizzes. Look at the Cambridge Lower Secondary Science card.
- Expected: The topic chip sits clear of the illustration.
- Actual: The "EXAM STYLE (PAST PAPERS)" chip runs into the brain illustration in that card's header. The six cards do not overlap one another.
- Screenshot: `qa-artifacts/logged-in-dashboard/21-settled-desktop-01.png`

### 33. Notification titles are cut off

- Severity: minor
- Persona: logged-in dashboard
- Steps: Open the bell that reads 7 unread. Do not mark them read.
- Expected: Each title is distinct enough to tell similar quizzes apart.
- Actual: Seven items fit in the panel, but the titles are clipped, including "Cambridge International AS _ A Lev…" and "Cambridge International AS and A L…".
- Screenshots: `qa-artifacts/logged-in-dashboard/13-notifications.png`, `qa-artifacts/logged-in-dashboard/13b-notifications-panel.png`

### 34. Progress in the sidebar does nothing on Reports

- Severity: major
- Persona: logged-in practice
- Steps: Sign in, open `/reports`, and click Progress in the sidebar. Try more than once.
- Expected: The page goes to `/progress`. Home on the same menu goes to the dashboard, and Progress from Practice does open `/progress`.
- Actual: The URL stays on `/reports`. The page says "This page is for teachers."
- Screenshot: `qa-artifacts/logged-in-practice/clear-reports.png`

### 35. Recall's back link does not leave the review

- Severity: major
- Persona: logged-in practice
- Steps: Open `/recall/review` and, once the card is visible, click the Recall link. Do not rate the card.
- Expected: The link, which points at `/recall`, leaves the review.
- Actual: The URL stays on `/recall/review` after three tries. The card says 1 of 30.
- Screenshot: `qa-artifacts/logged-in-practice/clear-recall-review.png`

### 36. "Review 601 cards" starts a 30-card session

- Severity: major
- Persona: logged-in practice
- Steps: Open `/recall` and wait until the count finishes loading, then open the review.
- Expected: The session matches the 601 cards the hub says are due. While loading, the page does not claim the library is empty.
- Actual: For several seconds the hub says 0 cards and "Take a quiz and the ones you miss land here", even though the summary has already returned 601 due. The review then says 1 of 30, and the due request returns 30 cards. The subject chip is the file slug `CAMBRIDGE-IGCSE-BIOLOGY-MARRY-JONES-4TH-ED`. Progress also says "No results yet" while loading, then shows 123 tests and a 27% average.
- Screenshots: `qa-artifacts/logged-in-practice/retest-recall.png`, `qa-artifacts/logged-in-practice/clear-recall-review.png`

### 37. Exam prep promises national exams and only lists Cambridge Checkpoint

- Severity: minor
- Persona: logged-in student
- Steps: Sign in as this Rwanda student and open `/exam-prep`.
- Expected: The choices match the banner.
- Actual: The banner says "Cambridge Checkpoint, and your national exams." Step 1 lists only Cambridge Checkpoint. The page is not an error.
- Screenshot: `qa-artifacts/logged-in-student/04-exam-prep-top.png`

The same pass confirmed these login cases do not fail: empty body and empty fields return 400; a 20,000-character identifier, a script tag, `' OR 1=1 --`, an "ignore previous instructions" string, and `élève@école.test` all return 401 `Invalid credentials` and do not echo the identifier. Script and image payloads in `/?q=`, `/signup?email=`, and `/reset-password?token=` are not rendered as HTML. The reset form was not submitted.

## Unconfirmed

- Early `/signup` screenshots show an empty right column. The server HTML starts the form at `opacity: 0`. After hydration, about 4–5 seconds, the form is fully drawn. Not counted. Settled screenshot: `qa-artifacts/non-english/signup-1440x900.png`.
- The round "N" on local screenshots is the Next.js dev indicator. It covers the "A" in "A product of" on `/signup`. It is not part of the production page, so it is not counted.
- `POST /api/auth/login` answers a wrong password with `Invalid credentials`. The sign-in form does not show that string. It shows "Invalid email, student ID, or password. Please try again." The API wording is not counted as a screen bug.
- The sign-in dialog closed after a failed login while the dev server was compiling other routes. A second attempt also lost the dialog. `LoginForm` does set "Invalid email, student ID, or password." Hot reload during that compile can wipe the dialog, so this is not counted as a bug.
- HTML for many 200 responses contains the string "This page could not be found". That string is in the Next.js client payload, not the rendered page. The rendered homepage and signup page are the real screens.
- `/studylab/demo` timed out once while many routes were compiling. A later request returned 200. Not counted.
- Direct opens of `/#features`, `/#how`, `/#pricing`, and `/#studylab` all stay at the top. Clicks after the page has loaded do scroll. Counted under issue 4.
- Signed-in `/recall` did not finish. Two checks waited and then timed out while reading the page. Dashboard, Practice, and Exam prep on the same run had no console errors and no horizontal overflow. Not counted as a visual bug because the page never returned a result.

## AI quality

No live generation, so the same prompt was not run three times. `POST /api/generate-assessment` inserts a row, and the tutor route updates a lesson.

`/studylab/demo` shows a spinner, then `/login`, then the marketing homepage. No lesson is shown without an account.

The judge opened 21 saved scene cards on `/dev/scenes`. These are catalogue pieces, not a new exam paper. Average scores, 1–5: accuracy 4.6, relevance 5.0, tone 4.3, safety 5.0, consistency 4.1. Consistency here means the card agrees with itself.

Worst opened cards:

- Bubble sort. The question asks for the array after one pass, and the code box cuts off before the swaps.
- Linear search. The algorithm is right, and the code lines collide.
- History timeline. The card prints Agincourt 1071, Magna Carta 1151, and Black Death 1384, and the ticks stop at 1400.
- Maximum price. The prompt says $4, and the same card says the line is at $6.

Screenshots: `qa-artifacts/ai-judge/01-home.png`, `02-features.png`, `03-question-samples.png`, `04-studylab.png`.

## Coverage

Tested, without an account:

- Homepage, sign-in dialog, empty sign-in (browser validation blocks it), failed sign-in with a fake address, signup screen (not submitted), forgot-password screen (not submitted), reset-password screen (not submitted).
- Phone width 390×844 for the homepage and the signup dialog.
- Login API: empty, huge, script, SQL-shaped, prompt-shaped, accented, and non-JSON bodies.
- Repeated homepage loads (five times, all HTTP 200, 70–245 ms after the first). `/login` twice: each is one 307 to `/`, not a loop. Two parallel bad logins: both 401 `Invalid credentials`, no user object.
- Route sweep HTTP status, public and gated. The finished table is in `qa-artifacts/power-user/route-scan.json`. `/login` is one 307 to `/`. `/signup/` is one 308 to `/signup`. `/Practice` and `/DASHBOARD` are real 404 pages. Gated routes return a 200 HTML shell; without an account the client then sends the student to `/login`. `/classrooms` timed out once, then returned 200.
- One failed login as `ndumva@example.com` returned 401 and a 31-character body, which is `{"error":"Invalid credentials"}`.
- Signed-in impatient pass: refreshing the landing page twice returned to the dashboard still signed in. Back and forward between Home and Progress stayed signed in. One double-click on Create assessment opened the quiz builder once and did not send a second write. No new bug. Screenshot: `qa-artifacts/logged-in-impatient/08-double-click.png`.

Skipped, and why:

- Dashboard, practice, exam builder, assessment player, StudyLab tutor, gap map, classrooms, settings, admin actions, and payments. No test accounts, and those flows write or require a session.
- Generating or grading questions. That writes rows and spends a model call.
- Database comparison after a save. Nothing was saved. Login failures returned no user object.
- A French or Kinyarwanda browser language. The public pages stay `lang="en"` and the labels stay English. That was not filed as a bug. The wrong-password API body for `ndumva@example.com` is the English `Invalid credentials`.

## Top 5 fixes

1. Offer Grades 2–5 on the Rwanda school signup list.
2. Show a Sign in control on a 390px screen, including inside the create-account dialog.
3. Make `/login`, the signup Sign in link, and Back to Login open the sign-in form.
4. Scroll `/#features`, `/#how`, `/#pricing`, and `/#studylab` to those sections on a fresh open.
5. Replace the homepage fill-the-gaps picture that still prints `{{0}}` and `{{1}}`.
