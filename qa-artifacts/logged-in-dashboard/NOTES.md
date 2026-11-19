# Logged-in dashboard

Signed in through the login API and opened `/dashboard` in headless Chrome. No password, payment, delete, or new assessment. Did not click Create assessment, Retake, New set, or Take the retake.

## Issues

### 1. Empty-state copy sits next to finished-quiz evidence

Severity: Medium

Steps:
1. Open `/dashboard` as the returning student.
2. Read the screen as soon as the hero, the week line, and "Your recent quizzes" are visible, before the quiz cards replace the empty area.

Expected: The ring, the week line, and the recent-quiz section agree about whether this student has already finished quizzes.

Actual: The ring says "No quizzes yet". The recent section says "Nothing to review yet" and offers "Take your first quiz". The same screen also says "1 quiz this week · 0% avg" and shows "Worth going over" ("Topics you've been getting wrong"). A blank gray block sits between the hero and the week line. After the list finishes loading, that copy is replaced by "27% average across 123 quizzes" and six recent quiz cards.

Screenshots:
- `c:\Users\hp\Desktop\update\AI_assessment\qa-artifacts\logged-in-dashboard\11-dashboard-desktop-00.png`
- `c:\Users\hp\Desktop\update\AI_assessment\qa-artifacts\logged-in-dashboard\12-dashboard-mobile-01.png`
- Loaded comparison: `c:\Users\hp\Desktop\update\AI_assessment\qa-artifacts\logged-in-dashboard\20-dashboard-settled-notour.png`
- Loaded comparison: `c:\Users\hp\Desktop\update\AI_assessment\qa-artifacts\logged-in-dashboard\21-settled-desktop-01.png`

### 2. Subject names and recent-quiz titles are cut off

Severity: Medium

Steps:
1. Open the loaded dashboard.
2. Read "How each subject is going" and "Your recent quizzes".

Expected: Each subject name and quiz title can be read.

Actual: Subject labels are clipped at 140px. On screen: "Cambridge Primary…", "Completing the squ…", "Literary Devices in L…", "Explain Albert Cam…". The full strings in the page are Cambridge Primary Science 5 (193px in a 140px box), Completing the square (150px), Literary Devices in Literature (186px), and Explain Albert Camus' Absurdity (210px). Recent-card titles stop at "Cambridge International AS A Level Economics Fourth…", "Cambridge International AS and A Level Biology …", and "Cambridge IGCSE™ Chemistry Workbook with…".

Screenshots:
- `c:\Users\hp\Desktop\update\AI_assessment\qa-artifacts\logged-in-dashboard\20-dashboard-settled-notour.png`
- `c:\Users\hp\Desktop\update\AI_assessment\qa-artifacts\logged-in-dashboard\21-settled-desktop-01.png`

### 3. Quiz topic chip overlaps the header illustration

Severity: Medium

Steps:
1. Open the loaded dashboard.
2. Scroll to "Your recent quizzes".
3. Look at the Cambridge Lower Secondary Science card.

Expected: The topic chip in the card header sits clear of the illustration.

Actual: The "EXAM STYLE (PAST PAPERS)" chip runs into the brain illustration in that header. The six cards themselves do not overlap one another.

Screenshot:
- `c:\Users\hp\Desktop\update\AI_assessment\qa-artifacts\logged-in-dashboard\21-settled-desktop-01.png`

### 4. Compact bottom-nav labels meet

Severity: Low

Steps:
1. Open `/dashboard` at a 390px-wide viewport.
2. Read the bottom nav.

Expected: Each label has space of its own.

Actual: The LearnSpace label's text ends on the right edge of its cell (0px to spare). Gap Maps starts 1px later, so the two labels read as one run of text.

Screenshots:
- `c:\Users\hp\Desktop\update\AI_assessment\qa-artifacts\logged-in-dashboard\18-dashboard-mobile-measured.png`
- `c:\Users\hp\Desktop\update\AI_assessment\qa-artifacts\logged-in-dashboard\01-tour-mobile-390x844.png`

### 5. Notification titles are cut off

Severity: Low

Steps:
1. Open the bell that reads 7 unread.
2. Read the list. Do not mark items read and do not open them.

Expected: Titles are distinct enough to tell similar quizzes apart.

Actual: The list has 7 items and fits in the panel. Titles are clipped, including "Cambridge International AS _ A Lev…" and "Cambridge International AS and A L…".

Screenshots:
- `c:\Users\hp\Desktop\update\AI_assessment\qa-artifacts\logged-in-dashboard\13-notifications.png`
- `c:\Users\hp\Desktop\update\AI_assessment\qa-artifacts\logged-in-dashboard\13b-notifications-panel.png`

## What was covered

- Dashboard with the product tour up, at 390×844, 375×667, and 1440×900.
- Skip the tour and Got it. On 390×844, Skip ends at y=653 and Got it at y=661; the bottom nav starts at y=755. On 375×667, Skip ends at y=464 and Got it at y=472; the nav starts at y=560. Both controls were the hit target, and neither was covered by the bottom nav. There is no bottom nav at 1440px. Got it closed the tour. Skip, tried on the tour again, also closed it. Desktop steps were advanced with Next until Got it on step 4 of 4; that control was visible and clickable.
- Notifications opened from the 7-unread bell. The list was not deleted and Mark all read was not used.
- The Sumba account menu opened on desktop and on a phone-width screen. It shows the profile, enrolled subjects, an active subscription, and Settings. No setting was changed.
- Loaded dashboard checked for the contradictions above. The 0% figures on the loaded page match the recent cards and the notification list (0%, 6%, 17%, 25%, 0%, 0%). The ring on that loaded page says 27% across 123 quizzes. The separate line "1 quiz this week · 0% avg" matches the newest card, which is 0% on Nov 17. Those 0% scores were not treated as a broken average.
- Hero title "Build an assessment and find your gaps" was measured on desktop and at 390px. Its text stays inside the banner. The week line also stays inside its row at 390px.
