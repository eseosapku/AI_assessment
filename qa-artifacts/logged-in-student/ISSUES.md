Logged-in student pass for b.sumba@alustudent.com on http://localhost:3000 only. Profile was not changed. No quiz, lesson, or payment was submitted.

## Issues

### 1. Home, Progress, and Recall say the account is empty while its data is still loading
Severity: Medium

Steps:
1. Sign in as this student.
2. Open /dashboard, /progress, and /recall and look at each page before its request finishes.

Expected: A loading placeholder until the existing quizzes, results, and recall cards appear.

Actual: The pages render the first-time empty copy while loading.
- Home shows a grey loading block beside "No quizzes yet", "Nothing to review yet", and "Take your first quiz". After the dashboard request, the same page shows 27% across 123 quizzes.
- Progress shows em dashes for Total tests, Average, Subjects tracked, and Latest grade, and at the same time "No results yet / Start practicing". After loading it shows real totals (48 subjects, latest grade D).
- Recall shows an em dash for cards due, the line "0 cards in your library", and "Take a quiz and the ones you miss land here", with a spinner under Your decks. After loading it offers "Review 601 cards" and lists decks.

Screenshots:
- qa-artifacts/logged-in-student/pass2--dashboard-while-empty.png
- qa-artifacts/logged-in-student/final-dashboard.png
- qa-artifacts/logged-in-student/pass2--progress.png
- qa-artifacts/logged-in-student/final-progress.png
- qa-artifacts/logged-in-student/pass2--recall.png
- qa-artifacts/logged-in-student/final-recall.png

### 2. The Home coach mark opens on other pages and stacks on the page's own tour
Severity: High

Steps:
1. Sign in on a browser that has not dismissed the tours.
2. Open /practice, /recall, /progress, and /studylab. Also open /report-card, /studylab/gap-map, and /classrooms.

Expected: One coach mark for the page that is open, pointed at a control on that page.

Actual: A Home-shell card titled "Ask for a lesson, not an answer" (1/3, "When you get stuck") opens on these pages and highlights the LearnSpace item in the sidebar. On Practice, Recall, Progress, and LearnSpace a second coach mark for that page is open behind it. Both cards have Skip and Next. The front card covers the page the student opened.

Screenshots:
- qa-artifacts/logged-in-student/03-practice-top.png
- qa-artifacts/logged-in-student/final-recall.png
- qa-artifacts/logged-in-student/final-progress.png
- qa-artifacts/logged-in-student/final-studylab.png
- qa-artifacts/logged-in-student/final-report-card.png
- qa-artifacts/logged-in-student/final-studylab-gap-map.png
- qa-artifacts/logged-in-student/final-classrooms.png

### 3. Exam prep promises national exams and only offers Cambridge Checkpoint
Severity: Low

Steps:
1. Sign in as this student (country RW).
2. Open /exam-prep.

Expected: The choices match the banner.

Actual: The banner says "Sit a real paper under real conditions — Cambridge Checkpoint, and your national exams." Step 1 lists only Cambridge Checkpoint. The page is not blank and not an error.

Screenshot: qa-artifacts/logged-in-student/04-exam-prep-top.png

## Pages covered

Login lands on /dashboard.
- /dashboard: loads real quiz history after the empty flash above. Not a crash.
- /practice: page renders (mode chooser). Covered by two tours. Not a crash.
- /exam-prep: one exam choice, as above. Not a crash.
- /recall: 601 cards due and decks, after the false zero above. Not a crash.
- /progress: results load (48 subjects). Not a crash.
- /report-card: list of assessments loads (123 selected in the preview). Not a crash. Covered by the Home tour.
- /studylab: existing lessons load (101 in progress, 12 completed). Not a crash. Two tours.
- /studylab/gap-map: map loads (195 gaps, subject tiles). Not a crash. Covered by the Home tour.
- /settings: Profile & security form loads for this account. Not a crash. No fields were changed.
- /classrooms: empty state, "No classes yet / When your teacher adds you, your classrooms will show up here." Not a crash.

No console errors were captured on the settled logged-in pages. While the marketing page was open for sign-in, the console logged a 404 for /art/celebration.png. The sign-in modal itself showed no broken image.
