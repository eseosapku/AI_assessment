# QA Fix Notes

Date started: 2026-11-19 (Africa/Kigali)

## Baseline before application changes

| Check | Baseline result |
| --- | --- |
| `npm.cmd run lint` | **Failed (pre-existing):** Next.js 16 no longer supports `next lint`; it interpreted `lint` as a project directory. |
| `node node_modules/typescript/bin/tsc --noEmit` | **Failed (pre-existing generated state):** `.next/types/validator.ts` referenced missing `app/studylab/demo/page.js`. The untouched production build subsequently regenerated types successfully. |
| `node node_modules/vitest/vitest.mjs run` | **Failed (pre-existing):** 494 files / 8,367 tests passed; 2 tests in `lib/no-control-bytes.test.ts` failed because `life-cycles.test.ts` contains byte `0x08` and `opportunity-cost/config.ts` builds a regex from a template-literal bare escape. |
| `npm.cmd run build` | **Passed:** Next.js production build compiled, typechecked, and generated 102 routes. |

The baseline did not call production, submit forms, write a database, send email, make a payment, or invoke a live AI model.

## Issue status

| Issue | Status | Files changed | Test |
| --- | --- | --- | --- |
| #1 | fixed | `lib/countries.ts` | `issue-1-rwanda-grades` (passed); full suite retained only the 2 baseline failures |
| #3 | fixed | `components/LandingPage.tsx`, `components/AuthModal.tsx` | `issue-3-mobile-sign-in` (passed) |
| #4 | fixed | `components/LandingPage.tsx`, `lib/landing-navigation.ts` | `issue-4-fresh-hash-scroll` (passed) |
| #12 | fixed | `app/login/page.tsx`, `components/LandingPage.tsx`, `lib/landing-navigation.ts` | `issue-12-login-opens-form` (passed); shared full suite retained only the 2 baseline failures |
| #20 | fixed | `components/studylab/trail/TrailCanvas.tsx`, `lib/studylab/trail/wheel.ts` | `issue-20-lesson-board-overflow` (passed) |
| #21 | fixed | `app/studylab/demo/page.tsx` | `issue-21-studylab-demo` (passed); TypeScript passed and shared full suite retained only the 2 baseline failures |
| #24 | fixed | `lib/hooks/useStudentDashboard.ts` | `issue-24-classrooms-refresh` (passed) |
| #26 | fixed | `app/(studio)/classrooms/[id]/page.tsx`, `lib/classroom-assignments.ts` | `issue-26-finished-classwork` (passed) |
| #27 | fixed | result API/page and `components/assessment/NextStepsPanel.tsx` | `issue-27-result-score-title` (passed) |
| #29 | fixed | result page, `lib/review-explanation.ts` | `issue-29-answer-explanation` (passed); TypeScript passed and shared full suite retained only the 2 baseline failures |
| #34 | fixed | `components/studio/AppShell.tsx`, `lib/product-tour.ts` | `issue-34-reports-progress-link` (passed) |
| #35 | fixed | `components/studio/AppShell.tsx`, `lib/product-tour.ts` | `issue-35-recall-back-link` (passed) |
| #36 | fixed | Recall due API/local fallback, hub and review | `issue-36-recall-count-loading` (passed); TypeScript passed and shared full suite retained only the 2 baseline failures |
| #2 | fixed | `components/LandingPage.tsx` | `issue-2-exam-prep-anchor` (passed) |
| #5 | fixed | `components/LoginForm.tsx`, `components/SignupForm.tsx` | `issue-5-password-accessibility` (passed) |
| #6 | fixed | `public/art/celebration.svg` and consumers | `issue-6-celebration-asset` (passed) |
| #7 | fixed | login API | `issue-7-login-invalid-json` (passed) |
| #8 | fixed | `components/AuthStoryPanel.tsx` | `issue-8-signup-story-overlap` (passed) |
| #9 | fixed | `components/LandingPage.tsx` | `issue-9-homepage-blanks` (passed) |
| #10 | fixed | `components/SignupForm.tsx` | `issue-10-rwanda-label` (passed) |
| #11 | fixed | `components/LandingPage.tsx` | `issue-11-tablet-header` (passed) |
| #13 | fixed | `components/LandingPage.tsx` | `issue-13-learnspace-name` (passed); TypeScript and palette guard passed; full suite retained only the 2 baseline failures |
| #14 | fixed | assessment cards, notification titles, `lib/quiz-display-title.ts` | `issue-14-readable-quiz-titles` (passed) |
| #15 | fixed | `components/ProfileSidebar.tsx` | `issue-15-profile-class` (passed) |
| #16 | fixed | notification hook/feed | `issue-16-first-practice-notification` (passed) |
| #17 | fixed | shell, notification bell, menu event | `issue-17-exclusive-account-menus` (passed) |
| #18 | fixed | `components/ProfileSidebar.tsx` | `issue-18-profile-above-tour` (passed) |
| #19 | fixed | home-tour routing (from #34/#35) | `issue-19-single-tour` (passed) |
| #22 | fixed | `components/studio/PracticeHub.tsx` | `issue-22-practice-mobile-fold` (passed) |
| #23 | fixed | `components/studio/SideNav.tsx` | `issue-23-mobile-nav-labels` (passed) |
| #25 | fixed | progress row and next-step card | `issue-25-dashboard-text-layout` (passed) |
| #28 | fixed | grading prompt and stored-result feedback | `issue-28-written-answer-response` (passed) |
| #30 | fixed | stored result page, `lib/result-review.ts` | `issue-30-blank-paper-review` (passed) |
| #31 | fixed | dashboard and classroom loading states | `issue-31-loading-totals` (passed) |
| #32 | fixed | `components/AssessmentCard.tsx` | `issue-32-topic-chip-collision` (passed) |
| #33 | fixed | notification titles | `issue-33-notification-titles` (passed) |
| #37 | fixed | exam-prep page copy | `issue-37-exam-prep-copy` (passed) |
| AI scene cards | fixed | algorithm tracer, timeline and supply/demand views | `issue-ai-scene-quality` (passed) |

## Product decisions

- Historical result scoring and option order are preserved. Old attempts are not silently rescored.
- The profile uses actual classroom memberships when opened and only falls back to the formatted account class when there are none.
- A blank saved paper keeps its historical score, but its review uses neutral “Not answered” treatment and makes no unsupported strengths or next-step claims.
- Scene interactions still begin unsolved. Timeline cards no longer print deliberately incorrect starting-marker dates as historical facts.
- No production service, database, email, payment, or live AI endpoint was called.
- Per-issue commits could not be created because this environment exposes `.git` read-only. Issue-scoped tests and changes remain separated for review.

## Final regression comparison

- TypeScript passed after all fixes.
- The final issue cluster's 16 test files / 17 tests passed; earlier issue tests passed in their clusters.
- Final sweep after the later file updates: all 533 Vitest files and all 8,416 tests passed with a 50,000 ms timeout. The standard-form group had its own explicit 30,000 ms override; that test-only limit was raised to 50,000 ms, and its focused 17/17 run passed before the full green run.
- Production build passed: Next.js compiled, TypeScript completed, and 103 static pages were generated.
