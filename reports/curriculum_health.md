# Curriculum health

Generated 2026-10-27 from the live Postgres tree. The row-level copy is `curriculum/snapshot.json` (654 textbooks, 3,698 topics, 12,424 subtopics). Downstream work should read that file, not the database.

No embeddings were built. Every subtopic is a bare name, and a bulk embedding run needs a cost check before it is spent. Extraction has not started.

## What the tree actually is

There is one tree, not one tree per examination system.

A textbook carries an integer `curriculum`. A topic belongs to a textbook. A subtopic belongs to a topic. A year group is a `classes` row, attached to a textbook through `class_textbooks`. There is no `system`, `level`, `subject`, or `description` column.

The integer is evidenced by the book titles, not by a lookup table:

| code | what the titles are | textbooks | topics | subtopics | textbooks with no class |
| --- | --- | ---: | ---: | ---: | ---: |
| 0 | REB student books (Biology S6, Mathematics S1, …) | 175 | 1,377 | 8,030 | 43 |
| 1 | Cambridge books (IGCSE, O Level, coursebooks) | 81 | 1,098 | 4,394 | 0 |
| 2 | NERDC Nigeria (Primary 1 — English Studies, …) | 231 | 1,056 | 0 | 0 |
| 3 | WAEC papers (WAEC 2015 — Agricultural Science) | 89 | 89 | 0 | 89 |
| 4 | JAMB papers (JAMB 2015 — Biology) | 78 | 78 | 0 | 78 |

REB and Cambridge do not share topic rows. They also do not have separate trees. Cambridge books are hanging off the Rwanda grade list: Grade 1 through Grade 12, including 24 books on Grade 10 and 20 each on Grade 11 and Grade 12. A Cambridge IGCSE question mapped through this link would be filed as a Rwanda senior grade.

Nigeria is already a third system in the database (NERDC, WAEC, JAMB). It is not a folder in the past-paper drive.

`subtopics` columns are `subtopic_id`, `textbook_id`, `topic_id`, `subtopic`. There is nowhere to store a description. `data/topic-briefs.json` has 489 chapter briefs (`teaches`, `notYet`, `example`). That is not a description on the 12,424 subtopics.

## Name quality

| check | count |
| --- | ---: |
| subtopics | 12,424 |
| blank names | 0 |
| names under 20 characters | 3,740 (30%) |
| names under 8 characters | 400 |
| names used more than once | 868 names, 2,571 rows |
| topics with no subtopics | 1,578 of 3,698 |
| topics with exactly one subtopic | 79 |

The repeated names are mostly book furniture, not concepts: "introduction" (90), "end unit assessment" (54), "introductory activity" (26), "learning intentions" (19), "unit summary" (15). French headings are in the same list ("mise en situation", "grammaire", "activité de production"). An embedding of these names would treat textbook scaffolding as a subtopic and would pull unrelated questions into it.

The largest real topics are still wide: SQL and Database Project (38), Theories of Human Development (34), Microsoft Excel (33), Unit 1: Sets (30). Those are the ones a single vector will smear across.

NERDC's 1,056 topics, and every WAEC and JAMB paper, have no subtopics. The 12,424 subtopics are only REB (8,030) and Cambridge (4,394).

## Drive, top two levels only

`G:\My Drive\pastPapers` is readable. Nothing below this was opened, so this is not an inventory and placeholder files have not been checked.

```
pastPapers
  Cambridge
    Igcse
    Olevel
    As and Alevel
    primary_checkpoints
  REB
    P6
    S3
    S6
```

Cambridge Lower Secondary Checkpoint is not a folder at this level. It may sit inside `primary_checkpoints`, or it may be absent. AS and A Level are one folder, not two.

The database year groups and the folder names are different words. Rwanda classes are `Grade1` and `Grade 2` … `Grade 12`. The REB folders are `P6`, `S3`, `S6`. Those have not been paired. Taken at face value, Grade 1–5, 7–8, and 10–11 have no REB folder at the second level, and the drive has no Nigeria directory at all.

## What stays

The grade links stay. Cambridge books stay listed under the Rwanda grades they are tied to. No book, topic, subtopic, or class link is updated. Level for the new pipeline will be written later in a new `book_level_map` row that points at the existing `textbook_id`. Descriptions for embedding will be written later in a new `subtopic_enrichment` row that points at the existing `subtopic_id`. Neither table exists yet, and no row has been written.

## Proposed furniture stop-list

A name is furniture when it is the book's own apparatus, not something being taught. "Introduction" is furniture at every grade. "Photosynthesis" is not, even when several books use that name. Each of those rows stays its own target.

Of 2,120 topics that have subtopics, 482 rows match the names below.

- 281 topics already have a real subtopic beside the furniture. Those 470 furniture rows would be `mappable = false`.
- 3 topics have nothing except furniture. Those 12 rows stay mappable, because a generic target inside the right topic is better than no target.

| topic | book | furniture rows kept |
| --- | --- | ---: |
| UNITÉ 3: LE PROGRÈS NATIONAL | FRENCH S4 LKK SB | 5 |
| CONTEXTE 2: PAIX ET JUSTICE - UNITE 2 | FRENCH S5 EL SB (2) | 6 |
| Unit 10: Story telling | P1-English-PB | 1 |

Nothing has been written to the database. This list waits for approval before any `subtopic_enrichment` row is inserted.

| name | rows |
| --- | ---: |
| introduction | 90 |
| end unit assessment | 54 |
| introductory activity | 26 |
| mise en situation | 24 |
| end of unit assessment | 21 |
| learning intentions | 19 |
| activité d'exploitation lexicale | 18 |
| activité de compréhension du texte | 17 |
| activité de production | 16 |
| j'observe, je lis et je réponds | 16 |
| unit summary | 15 |
| evaluation de l'unité | 15 |
| key unit competence | 14 |
| cross-cutting issues to be addressed | 14 |
| additional activities | 14 |
| check your progress | 12 |
| activité de mise en situation | 12 |
| guidance on the introductory activity | 12 |
| unit assessment | 10 |
| activité d'exploitation littéraire | 10 |
| list of lessons/sub-heading | 10 |
| summary of the unit | 10 |
| activité d'exploitation grammaticale | 9 |
| assessment | 8 |
| extended work | 8 |
| unit evaluation | 8 |

Left off the list, even though the name repeats: vocabulary (19), vocabulaire (16), grammar (9), grammaire (16), definition (9), sounds and spelling (29), sounds and spellings (19), language structure (9), reading and comprehension (9), production (24), applications (14), origin (11), cheque (11). Those can be the thing being taught. Say if any of them should be treated as furniture.
