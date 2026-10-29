# Consumer audit

Read-only. No migration is proposed here, and nothing in the database was written.

Every row below reads `textbooks`, `topics`, `subtopics`, or `class_textbooks`, or stores `textbook_id`, `topic_id`, `topic_ids`, `subtopic_id`, or `subtopic_ids`. The new pipeline may only add side tables that point at these ids. It must not update or delete the rows these consumers use.

## What a delete or a re-key would take with it

`topics.textbook_id` and `subtopics.textbook_id` reference `textbooks` with `ON DELETE CASCADE`. `subtopics.topic_id` references `topics` with `ON DELETE CASCADE`. `class_textbooks.textbook_id` references `textbooks` with `ON DELETE CASCADE`. Deleting a book deletes its topics, its subtopics, and its grade links. Deleting a topic deletes its subtopics. Figures, quizzes, and mastery that store those ids would then point at nothing.

## Tables that store the ids

| table | columns | what breaks if the id moves |
| --- | --- | --- |
| textbooks | textbook_id | Every link below. |
| topics | topic_id, textbook_id | Subtopics, figures, quizzes, mastery. |
| subtopics | subtopic_id, topic_id, textbook_id | Quizzes, mastery, StudyLab rooms. |
| class_textbooks | class_id, textbook_id | The grade's book list. This is how a Cambridge book appears under a Rwanda grade. |
| classes | id, name, country | The grade the student picks. |
| assessments | textbook_id, topic_ids, subtopic_ids | Every saved quiz, including quiz-again. |
| topic_mastery | textbook_id, topic_id, subtopic_id | The gap map. Unique on (user, book, topic, subtopic). |
| learnspaces | textbook_id, topic_id, subtopic_id | StudyLab rooms. |
| figure_library_topics | topic_id, figure_id | Which diagram is offered for a topic. |
| figure_library | book, books, topic | Book titles and textbook ids stored as text on the figure. |

`assignments` stores subject, topics (text), grade, and curriculum as text, and points at an assessment. It does not store topic ids itself. Retiring an assessment still removes the assignment's result link.

## Screens and routes that read them

The quiz builder loads books with `GET /api/class-textbooks?class_name=&curriculum=`. That query joins `classes` to `class_textbooks` to `textbooks`. `components/FlowForm.tsx` is the screen. `app/manage-classes/page.tsx` and `app/api/classes/route.ts` plus `app/api/classes/[id]/route.ts` edit which books sit on a grade. Those links are left as they are.

Topics and subtopics for the chosen book: `app/api/topics/route.ts`, `app/api/topics/[id]/route.ts`, `app/api/subtopics/route.ts`, `app/api/subtopics/[id]/route.ts`, `app/api/textbooks/route.ts`, `app/api/textbooks/[id]/route.ts`. FlowForm uses them to build the quiz. Inserts there name the existing columns only (`topic_id`, `textbook_id`, `subtopic`). A new nullable column on `subtopics` would not change those statements. This pipeline will not add one. Descriptions go in a new table.

Generation and repeat quizzes: `app/api/generate-assessment/route.ts` loads topic and subtopic names for the stored ids. `app/api/quiz-again/route.ts` and `lib/quiz-again.ts` require a real textbook id or topic ids before a quiz can be repeated. `app/api/save-result/route.ts` writes the result against the assessment that holds those ids.

Gap map and StudyLab: `app/api/studylab/gap-map/route.ts`, `components/studylab/GapMap.tsx`, `app/api/studylab/route.ts`, `app/api/studylab/[id]/route.ts`, `app/api/studylab/tutor/route.ts`, `components/studylab/Workspace.tsx`, `lib/studylab/wall.ts`, `lib/studylab/lessonPolicy.ts`, `lib/studylab/stepLocks.ts`, `lib/studylab/persona.ts`. Mastery is summed per subtopic id. `app/api/next-step/route.ts` and `components/studio/StudioHome.tsx` read the same progress. `lib/admin/gap-metrics.ts`, `lib/admin/metrics.ts`, and `lib/admin/growth-metrics.ts` aggregate it.

Free-text quiz matching: `app/api/quiz-topic/match/route.ts` matches a typed topic to existing topic and subtopic rows.

Exam prep: `components/ExamPrepForm.tsx` and `app/api/exam-sources/route.ts` read textbooks for WAEC and JAMB (curriculum 3 and 4). Those books have no subtopics. They stay listed as they are.

## Figures

`lib/figure-library/pg-source.ts` samples `figure_library_topics` by `topic_id`, then loads `figure_library` and `figure_library_questions`. The asset path is a CloudFront key. Re-keying a figure or a topic id drops the picture off the quiz.

`lib/textbook-figure-bank.ts` reads `data/textbook-figure-bank.json`. Each figure stores `textbookIds` (the database book ids) and `topic` as the book's own topic name. `lib/checkpoint-figure-bank.ts` is the same idea for Checkpoint papers. `components/ExamFigure.tsx` and `lib/figure-src.ts` only turn a stored path into a CloudFront URL. They do not choose the topic.

`lib/textbook-vision-images.ts` and `lib/checkpoint-figures.ts` attach those banks during generation. `app/api/checkpoint-paper/route.ts` and `lib/checkpoint-paper.ts` use the Checkpoint bank. Report and print pages (`app/(studio)/reports/page.tsx`, `app/assignments/[id]/preview/page.tsx`) render the URL already stored on the question.

`data/topic-briefs.json` (489 chapters, read by `lib/topic-briefs.ts`) is keyed by textbook id plus the topic name. It is not a subtopic description. It stays where it is.

## Scripts that have written these tables before

These are not part of the running site. They are listed because running them again would change the tree. This pipeline does not run them.

- `scripts/link-cambridge-classes.js`, `scripts/link-unlinked-textbooks.js` write `class_textbooks`.
- `scripts/import-reb-2026.js`, `scripts/import-cambridge-toc-bundle.js`, `scripts/import-nerdc-textbooks.js`, `scripts/import-exam-papers.js`, `scripts/sync-cambridge-library.js` insert books, topics, and subtopics.
- `scripts/repair-textbook-topics.js`, `scripts/backfill-textbook-topics.js` rewrite topic rows.
- `scripts/backfill-gap-map-history.ts` reads the grade links and writes mastery.
- `scripts/figure-library/publish.ts` and `scripts/tag-textbook-figures.ts` publish figures against topic ids.
- `scripts/build-topic-briefs.ts` rewrites `data/topic-briefs.json`.

## What this audit allows

New tables only, with `textbook_id` and `subtopic_id` as foreign keys to ids that already exist. No `UPDATE` and no `DELETE` on `textbooks`, `topics`, `subtopics`, `class_textbooks`, `figure_library`, `figure_library_topics`, `assessments`, `topic_mastery`, or `learnspaces`. No migration file until this audit has been read.
