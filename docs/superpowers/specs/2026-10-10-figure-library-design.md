# Figure Library: 250,000 educational figures for every topic

Date: 2026-10-10. Status: approved 2026-10-11, with one change from the user: S3 and CloudFront cannot be set up yet, so everything is built and stored locally first (section 5.6).

## 1. What the user asked for

Said by the user (2026-10-08 to 2026-10-10):

- At least 50 images per chapter, "for good circulation of images", across all subjects, topics and subtopics in the software.
- Over 250,000 images "that work well for each topic", with "incredible quality" and "a good decent amount of variety".
- Images must be educational: they teach or test something in the topic, the way a textbook figure or an exam diagram does.
- A hard cap of $600 on model spend. No OpenStax for now.
- Drawn (generated) figures may make up most of the library, provided there are many kinds per subject and the user sees samples before bulk generation.

Assumed by me, open to correction:

- "250,000 images" counts distinct approved figures, each with at least one approved question. A figure may serve several topics that teach the same idea.
- "Every topic" covers all five sources in the database (section 2), including NERDC and the WAEC/JAMB syllabi.
- Subtopics need fewer than topics: at least 10 each, since a topic's figures are spread over its subtopics.

## 2. What has to be filled

Measured from the production database and the syllabus modules on 2026-10-10:

| Source | Books / subjects | Topics | Subtopics |
|---|---|---|---|
| Rwanda (curriculum 0) | 175 books | 1,377 | 8,030 |
| Cambridge (curriculum 1) | 81 books | 1,098 | 4,394 |
| NERDC (curriculum 2) | 231 class-subjects | 1,056 | none |
| WAEC syllabus (`lib/nigeria-exam-syllabi.ts`) | 36 subjects | 210 | none |
| JAMB syllabus | 25 subjects | 116 | none |
| Checkpoint strands (`lib/cambridge-checkpoint.ts`) | 8 subjects | 32 | none |
| **Total** | | **3,889** | **12,424** |

Today 7,037 figures have usable checked questions (`hasVetted`). Of 2,475 Cambridge and Rwanda chapters, 8 have 50 or more; the median has 1 to 2. NERDC, WAEC and JAMB topics have none of their own.

## 3. Success criteria

1. At least 250,000 approved figures. Existing banks count toward the total.
2. Every topic has at least 50 approved figures at its level; every subtopic has at least 10. Any topic that cannot reach this with educational figures is named in a list for the user to decide on (section 9, P0); none is quietly left short.
   - Decided 2026-10-12: text-led topics (mapped "mostly words", or a language or literature topic short of variety) aim for 15 picture questions instead of 50. The figures come from notices, timetables, menus, forms, picture prompts and source extracts. The P0 report names 91 such topics.
3. Quality: each source and each drawn family passes a blind review of 30 items scoring 27/30 or better before it is scaled, and keeps passing spot audits afterwards.
4. Variety: each topic's figures come from at least 6 different families or sources, no single family is more than 25% of a topic's figures, and near-duplicates are removed.
5. Licences: every real image is public domain, CC0, CC BY or CC BY-SA, or under Pixabay's licence, and carries its credit wherever it is shown.
6. Spend: model spend never exceeds $600, enforced by code (section 8).

## 4. Out of scope

- OpenStax, and anything licensed NC or ND. CK-12.
- Photos where an identifiable person is the subject; logos; adverts; decorative or chapter-opener images.
- AI-generated images (image models write labels and anatomy wrong).
- Phone layout work, and the frozen grade route.
- Replacing the existing figure banks. They stay and keep serving; the library adds to them.

## 5. Design overview

Five units, each usable and testable on its own:

```
 curriculum (DB + syllabi)
        │
        ▼
 ┌──────────────┐     figure plan per topic      ┌───────────────────┐
 │ 1 Concept map │ ─────────────────────────────▶ │ 2 Drawn figures    │──┐
 └──────────────┘  (concepts, level, families,    └───────────────────┘  │
        │           search terms)                  ┌───────────────────┐  │  approved figures
        └────────────────────────────────────────▶ │ 3 Real images      │──┤  + questions
                                                    └───────────────────┘  │
                                                                           ▼
                        ┌──────────────────────────────────────────────────────┐
                        │ 4 Library: Postgres rows, S3/CloudFront files,        │
                        │   quiz route picks by topic, credit line shown        │
                        └──────────────────────────────────────────────────────┘
                        5 Quality and budget controls wrap units 1 to 4
```

### 5.1 Concept map

Maps every topic and subtopic to what can illustrate it.

- **Input:** every topic and subtopic in section 2, with subject, book, level and the subtopic names.
- **Levels.** Four bands:
  - P: Primary 1 to 6.
  - LS: Lower Secondary 7 to 9, Rwanda S1 to S3, NERDC JSS.
  - UP: IGCSE, Rwanda S4 to S6, NERDC SSS, WAEC, JAMB.
  - AL: AS and A Level.
  A figure can serve neighbouring bands; its questions are written for one band.
- **Concepts.** A controlled list per subject, built first by clustering topic and subtopic names across curricula. Photosynthesis in Rwanda S2, Cambridge LS 8, NERDC SS2 and WAEC Biology becomes one concept, so one figure serves all four.
- **Output for each topic:**
  - its concepts;
  - which figure kinds fit, from a closed list of about 45. Drawn kinds include line graphs, circuits, maps and Punnett squares; real kinds include specimens, micrographs and landscapes. Drawn families are designed per kind in P3;
  - search terms and source hints for real images (5.3);
  - a feasibility class: drawn-rich, real-rich, mixed, or hard.
- **Method:** Haiku 4.5, one call per topic including its subtopics (about 3,900 calls), at on-demand prices while batch mode waits for S3 (5.6). Then a deterministic check: every concept named must exist in the list, and every kind named must exist in the closed list.
- **Supply probe:** each real-image search term is counted against Wikimedia Commons (free, one request at a time), so the feasibility report rests on how many candidate images actually exist.
- **Cost:** about $30.

### 5.2 Drawn figures

Figures generated from parameters, with the correct answer computed by the same code that draws the figure.

- **Where it runs:** offline, as a Python package `scripts/figgen/` using matplotlib, schemdraw (circuits, logic gates, flowcharts), RDKit (chemical structures), shapely (geometry) and Natural Earth data (maps). Python is chosen for these libraries. Generation is offline only, so nothing new enters the server bundle.
- **A family** is one module defining:
  - `concepts` and `levels` it serves;
  - `sample(seed) -> params`, with ranges chosen so instances differ meaningfully (no two instances share their key numbers);
  - `render(params) -> SVG`, in one shared exam-paper style (line weight, fonts, label placement);
  - `questions(params, level) -> [question]`, where every answer is computed, plus distractors for multiple choice built from typical mistakes;
  - `check(params, question)`, an invariant test that the stated answer is right.
- **Planned scale:** about 250 families. Examples by subject:
  - **Maths:** number lines, fraction models, clocks, place-value charts, coordinate grids, transformations, angles, polygons, nets and solids, bar, pie and line charts, pictograms, histograms, box plots, cumulative frequency, scatter graphs, function and trigonometric graphs, inequality regions, circle theorems, vectors, bearings, loci, Venn and tree diagrams, sequences of patterns, scale drawings.
  - **Physics:** circuits, ray diagrams, force diagrams, motion graphs, waves, field patterns, Sankey diagrams, moments, decay curves, instrument readings (ammeter, voltmeter, thermometer, newton-meter).
  - **Chemistry:** structural formulas, dot-and-cross diagrams, particle diagrams, energy profiles, rate graphs, titration and solubility curves, chromatograms, apparatus readings (burette, measuring cylinder, balance).
  - **Biology:** enzyme, photosynthesis and population graphs, Punnett squares, pedigree charts, food webs, pyramids, dichotomous keys, microscope graticule measurements, labelled-diagram templates with varied targets.
  - **Geography:** climate graphs for real stations, population pyramids from UN data, choropleth maps from World Bank and Natural Earth data, synthetic contour maps with grid references, cross-sections, rose diagrams, development scatter plots.
  - **Economics and business:** supply and demand shifts, cost and revenue curves, break-even charts, PPFs, AD/AS, Lorenz curves, income statements and balance sheets, organisation charts, product life cycles, Gantt and critical-path networks.
  - **Computing:** logic circuits with truth tables, flowcharts, trees, stacks and queues, network topologies, ER diagrams, state machines, binary and hex grids, spreadsheet extracts.
  - **Languages:** notices, timetables, menus, signs, forms, posters and data charts in the style used by English as a second language and language exams.
  - **History and social studies:** timelines, map extracts from Natural Earth, census charts.
  - **Music:** rhythm, notes and scales in notation.
- **Wording:** stems come from several templates per family. Nova Micro (batch) rephrases them for variety and is not allowed to change numbers, which a code check enforces. Cost about $3.
- **Storage:** SVG files go to S3; the parameters, seed and questions go to Postgres, so any figure can be regenerated exactly.
- **Volume:** elastic. Drawn figures cost almost nothing, so they make up whatever share of the 250,000 the real images do not, within the variety limits in section 3.

### 5.3 Real images

Educational photographs and diagrams from openly licensed collections.

**Sources:**
- Openverse (one search across Wikimedia, Flickr and museums, with a filter for commercial use and modification).
- The Wikimedia Commons API, using extmetadata for licence and author.
- Smithsonian Open Access (CC0).
- The Met (CC0).
- NASA (credit NASA; no logos or insignia).
- CDC PHIL (public domain items only).
- iNaturalist (research-grade observations; CC0 and CC BY photos only).
- Pixabay, only where the topic itself is everyday things: language vocabulary, and Primary "materials around us".

**Pipeline, one stage at a time; each stage only passes on what survived:**
1. **Harvest:** for each concept, run its search terms against the sources, keeping the licence, author, source URL and dimensions.
2. **Filter without a model:**
   - licence on the whitelist;
   - at least 600 px on the short side;
   - no people-category or logo tags;
   - a perceptual-hash distance of at least 6 from anything already held;
   - licence re-checked on the file's source page, since Openverse metadata can be wrong.
3. **Screen (Nova Lite, batch, on a 512 px thumbnail):** "Is this an educational figure for concept X at level Y? Decorative, people, text-only or off-topic → no." About 0.005¢ each.
4. **Store:** resize to at most 1,200 px WebP and upload to S3.
5. **Write (Haiku 4.5, batch, looking at the image):** one to three questions at the topic's level. Uses the house rules from the vetted-question pipeline: answerable from the figure, no sentence-long exact-match answers.
6. **Check (Haiku 4.5, batch, a separate strict call):** keep or drop each question, with a reason. Only figures with at least one kept question are approved.

**Cost and volume:** about 0.4¢ per approved image after drop-outs. The budget for this unit is $380, which gives about 80,000 to 90,000 images. The pilot (P1) confirms Haiku quality. If Haiku falls short, the writer becomes Sonnet in batch mode, the real-image count falls to about 25,000 within the same budget, and drawn figures fill the difference.

**Priority:** the real-image budget goes first to topics the concept map marks real-rich or hard (biology organisms and anatomy, geography landforms, earth science, history, art, Primary SET and SST), where drawn figures cannot provide the variety.

### 5.4 Library and quiz integration

**Postgres, additive migrations only:**
- `figure_library`:
  - id, origin (`drawn` or a source name), family, level_band, subject;
  - `concept_ids[]`;
  - asset key, width, height;
  - spec JSONB (drawn only);
  - licence, author, source_url, credit text;
  - phash;
  - status (`candidate` → `screened` → `stored` → `approved` or `rejected`), with the reason.
- `figure_library_questions`: figure_id, level_band, kind (mcq, short, written), stem, parts, answer, accepted answers, marks, explanation, model, check verdict.
- `curriculum_concepts` and `topic_concepts`: curriculum, textbook_id or syllabus subject, topic_id or name, subtopic_id (nullable), concept_id, weight.

**Files:** an S3 bucket behind CloudFront, using the S3 move parked on 2026-10-08. About 4 GB of real images and 2 GB of SVG cost about $0.15 a month to store. Until then the files live locally (section 5.6).

**Quiz route:**
- `figuresForQuiz` gains a library source. Topic and subtopic map to concepts, which map to approved figures at the quiz's level band. The existing banks stay first for their own books.
- The existing repeat avoidance (`orderForStudent`, `seenFromRows`) and question-key de-duplication apply unchanged.
- Questions are read from the database, not JSON, so the server bundle does not grow.

**Credit:** real images show a one-line credit under the figure (author, licence, source), as CC BY and CC BY-SA require.

**Coverage report:** a script and an admin view showing figures per topic and subtopic, families per topic, and the largest family share, against the criteria in section 3.

### 5.5 Quality and budget controls

- **Blind reviews:**
  - before scaling any family or source, 30 items reviewed by Sonnet (the reviewer cannot see where an item came from);
  - pass mark 27/30;
  - failures are fixed and re-reviewed, never waved through.
- **Spot audits:** 1% of approved items per subject, by Haiku, with a Sonnet second look on anything flagged.
- **Pilot comparison:** the same 60 real images run through the Haiku pipeline and the existing Sonnet pipeline, then blind-reviewed. Haiku is accepted if it scores at least 90% of Sonnet's clean rate.
- **Variety guard:** every batch merge recomputes family share per topic and refuses to add figures that would push a family over 25% of a topic.
- **Samples for the user:** a sample sheet for each subject's families (rendered figures with their questions and answers), shown before bulk generation, as agreed.

### 5.6 Local first, until S3 and CloudFront work

On 2026-10-11 AWS could not be used for S3 or CloudFront. The library is built so that moving to S3 later is a copy and a setting change, nothing more.

- **Staging store.** A SQLite database (`figures.db`) holds everything while the library is built: concepts, topic mappings, the family catalogue, figures, questions, review results and spend. Python and Node can both read it, using Python's built-in `sqlite3` and Node's built-in `node:sqlite`. Pipeline runs never write to the production database.
- **Files.** Images and SVGs go in a local folder outside the repository, set by `FIGURE_LIBRARY_DIR` (default `C:\Users\Stephen\figure-library`). Files are laid out exactly as the S3 keys will be (`assets/<origin>/<id>.<ext>`), so the move is one `aws s3 sync`.
- **Publishing.** A publish script copies approved rows from the staging store into the Postgres tables in 5.4, and the files to S3. It is the only step that touches production, and it runs only after S3 and CloudFront exist.
- **The app.** The quiz route reads library figures only when `FIGURE_ASSET_BASE` is set (the CloudFront URL in production). In development it can point at a dev-only route serving the local folder, so library figures can be tried in real quizzes on this machine before anything is deployed.
- **Batch pricing needs S3.** Bedrock batch jobs read and write S3. Until S3 works:
  - P0 and the pilot run at on-demand prices; both are small.
  - Drawn figures are unaffected.
  - Harvesting, filtering and screening real images can go ahead (screening on-demand with Nova Lite costs little).
  - Writing and checking questions for real images in bulk waits for S3. Running it on-demand would double its cost and halve the number of real images.

## 6. Data flow for one topic

Take "Rivers" in a Rwanda S2 Geography book:
1. The concept map gives the concepts `river-processes` and `river-landforms`, level LS, families such as cross-section, long-profile graph, contour map, rose diagram and hydrograph, and real-image terms such as meander, oxbow lake, waterfall, delta and floodplain.
2. Drawn: each family generates candidates with computed answers, and an automatic check confirms each answer is right.
3. Real: harvest from Wikimedia, Smithsonian and NASA, then filter, screen, store, write and check.
4. Approved figures are tagged to both concepts. The quiz for any LS topic mapped to those concepts can use them.
5. The coverage report shows "Rivers" at, for example, 140 figures from 11 families, with the largest family at 18%.

## 7. Error handling

- Every pipeline stage is resumable and idempotent, keyed on figure id. A failed batch record is retried, never silently dropped. After the existing "long runs silently fail the tail" trap, counts are checked at the end of every stage.
- A licence that cannot be re-confirmed on the source page means rejection, not a guess.
- A drawn figure whose `check()` fails is a bug in its family: the family stops until it is fixed.
- Before a merge, the quiz-route loader validates rows (question shape, answer present, multiple-choice key in range). Invalid rows are logged and excluded.

## 8. Budget

| Item | Model | Estimate |
|---|---|---|
| P0 concept map | Haiku on-demand | $30 |
| P1 pilot, both pipelines plus comparison | Haiku, Sonnet, Nova | $25 |
| Drawn: rephrasing | Nova Micro batch | $3 |
| Drawn: blind reviews and audits (about 250 families) | Sonnet and Haiku | $60 |
| Real: screening (about 450,000 candidates) | Nova Lite batch | $25 |
| Real: writing and checking | Haiku batch | $380 |
| Reserve | | $77 |
| **Total** | | **$600** |

**Enforcement:** every pipeline script records actual token use in a spend ledger, the `spend` table of the staging store (5.6; pipeline runs never write to production). A job estimates its own cost before starting and refuses to start if the estimate would take cumulative spend past $600. Spend is reported after every job.

Prices used are AWS-listed on-demand prices halved for batch: Haiku 4.5 at $0.50 / $2.50 per million tokens, Nova Lite at $0.03 / $0.12, Nova Micro at $0.0175 / $0.07. They are re-read from the AWS pricing page before P0.

## 9. Phases and exit criteria

- **P0 Concept map.**
  - Exit: every topic and subtopic mapped.
  - The user receives a feasibility report: for each topic, the planned drawn and real supply, and a named list of any topics that cannot reach 50 educational figures, with options.
  - **Result (2026-10-12):**
    - 3,888 of 3,889 topics mapped; "ICT Basics", a computing unit inside the P4 SET book, is left for Computing.
    - 3,350 concepts. 17,857 Wikimedia search terms counted.
    - 1,264 topics (33%) ready now by figure kinds. 2,441 (63%) ready once the drawn families are built (an upper bound). 183 (5%) still short: 91 mostly words, 85 with few kinds mapped (largely Art and Music), 7 short of real images.
    - 8,742 of 12,424 subtopics (70%) have two or more kinds under a feasible topic.
    - Spend $25.44: concepts $5.09, mapping $20.35.
    - Report: https://claude.ai/artifact/BqS74o2K7ERYoaj4bNqfkW.
    - Decisions (2026-10-12, the user: "do all that you recommend"):
      - The text-led topics take the lower target in section 3.
      - The few-kind topics are rechecked by remapping them. Done: 38 of 85 now reach the target, for 1,266 ready, 2,477 ready once drawn and 145 short. The remaining 47 use one medium (art media, music notation) and take the lower target of 15 unless the drawn music families give them enough variety.
      - The real-image gaps go to the other collections in P4.
      - The pilot is split into P1a (drawn figures) and P1b (real images).
- **P1 Pilot.** About 6 topics across Maths, Biology, Geography, Economics, a language and History. About 20 drawn families. About 600 real candidates.
  - Exit: blind reviews pass; the Haiku-versus-Sonnet result is decided; the user has seen sample sheets and approved them.
  - **P1a result (2026-10-12), drawn figures:**
    - 20 families, 600 figures (30 each), in the local store; 16 pilot topics across maths, biology, geography, economics and business, English and history.
    - Every answer is recomputed independently in tests on 1,000 seeds; layout tests check text overlap, lines through labels and boxes, and values on gridlines.
    - Blind review changed during the pilot. The first run showed the key and passed items the reviewer had itself called ambiguous; the review now has Sonnet answer each question without the key, and code compares. Every family passes: 18 at 30/30, number line and population pyramid at 29/30.
    - Looking at the figures and the two review rounds found and fixed real defects in 15 families: overlapping labels, arrows running behind food-web boxes (which changed the chain count), merged angle arcs, ambiguous pyramid shapes, a measuring cylinder in a geography topic, timetable questions that were arithmetic, case-only Punnett keys the app's marker cannot tell apart, and more. "Stable" pyramids are no longer drawn: the reviewer disputed 8 of 8.
    - Two rejections were reviewer errors (a number line miscounted), kept rejected.
    - Spend $8.73 (first review $3.80, blind review $4.93). Library total $34.53.
    - Sample sheet: https://claude.ai/artifact/MhzcrPTiCKXaQn1bh1W1dP.
    - Approved by the user on 2026-10-12 ("okay go ahead, graphs are cool"), who called the real images "the real test". P1a's exit is met.
  - **P1b result (2026-10-12), real images:**
    - Six topics, one per real kind: Cells (IGCSE), Classification of Kingdom Animalia (S1–S3), Forms of relief (S1–S3), The Cold War, Laboratory safety and apparatus (S1–S3), and The life cycle of flowering plants (Primary).
    - Harvest, Wikimedia Commons only: 600 candidates stored. Rules before download turned away 296 files: too small, wrong licence, people or logo categories, near-copies, or no author.
    - Screening: **Nova Lite failed.** It copied the example reply (599 of 600 kept); with a placeholder template it wrote "<true>" and kept an office block for the Cold War and cancer slides for Cells. Haiku screens instead: 316 of 600 kept, and every case checked by eye was right.
    - Keep rates show where Commons is thin: landforms 82%, animals 66%, apparatus 60%, flowering plants 54%, the Cold War 29% (people, unrelated buildings) and cells 25% (research-paper figures and medical histology).
    - **Writer comparison (5.5), on the same 60 images, both blind-reviewed with the key hidden:**
      - Sonnet: 87 of 92 questions clean (95%).
      - Haiku: 67 of 113 (59%).
      - Haiku is at 63% of Sonnet's rate, under the 90% bar, so by the fallback in 5.3, **Sonnet writes real-image questions.**
      - Haiku's faults: 27 wrong keys, 21 with more than one right answer, 14 not answerable from the image.
    - Costs per image, on-demand: screening $0.0018 (Haiku), Sonnet writing and checking $0.0148, review $0.0065.
      - Screening is far over section 8's estimate. P4 needs free pre-filters (title, category and description relevance) and smaller thumbnails before the model sees an image, and other collections for the thin topics.
      - At batch prices with Sonnet, the $380 real-image budget gives roughly 25,000 to 35,000 real images, as 5.3 foresaw for this case.
    - Credit lines need cleaning in P4: Wikimedia's Artist field can carry notes ("Author info – Reusing images") or a link instead of a name.
    - Spend $5.30 (screen $1.30, Haiku writing $2.27, Sonnet writing $0.89, reviews $0.86). Library total $39.84.
    - Sample sheet: https://claude.ai/artifact/B66CKkscUKRnqYdb26zgdy.
  - **The user's review of the P1b sheet (2026-10-12):**
    - Too many images were decorative; the user wants diagrams "like" a textbook's.
    - Some cell images were at the wrong level.
    - Landforms were "way out of league", and learners "will never have seen those things".
    - The Cold War is fine if it keeps to the curriculum.
    - Lab apparatus and classification were good.
  - **P1b.2 result (2026-10-12), diagrams first and judged against the syllabus.** Same six topics.
    - **Changes:**
      - Haiku made each topic's search terms from its syllabus points, diagrams first and then East African or named examples.
      - The harvest includes SVG diagrams, rendered to PNG by Wikimedia and placed on white.
      - The screen sees the syllabus points and judges `in_syllabus`, `unfamiliar_example` and the image type. A distant example counts only against places, in geography and history; elsewhere it rejected bees and flowers.
      - Sonnet writes questions bound to the syllabus points.
    - **Screening:** 946 candidates, of which 374 were kept (classification 109, flowering plants 88, apparatus 82, cells 49, Cold War 32, landforms 14).
      - Landforms are now the East African Rift, Lake Kivu, the Albertine Rift, and Kenyan and Malawian scarps.
      - Cells are now numbered plant and animal cell diagrams and a labelled prokaryote.
    - **Writing:** Sonnet wrote 207 questions on 89 images (diagrams first) and kept 122. The blind review found 119 of 122 clean (98%) on 72 images, up from 95% in P1b.
    - **Spend:** $3.72 (screen $1.97, writing $1.28, review $0.46, terms $0.01). P1 in all $17.75, within section 8's $25. Library total $43.56.
    - **For P4:**
      - Landforms (14 kept) and the Cold War (32) stay thin on Commons; drawn families and other collections must carry them.
      - Credit lines need cleaning, since Artist fields carry notes and links.
      - History screening still lets through weak items, such as uniform plates and 1980s station photos.
    - Sample sheet: https://claude.ai/artifact/66UHHw6WDBehsNR1PBPHLG (version 2, after the changes below).
    - **The user's decision on the round-two sheet (2026-10-12): no scanned pages of old books or catalogues, "at all", however good the drawing.**
      - A rule turns away DPLA, Biodiversity Heritage Library and Internet Archive book pages before download, and the screen judges `scanned_page`.
      - 33 held scans were rejected. Scanned declassified documents (CIA maps of Cuba via DPLA) went too; the Cold War is down to 9 approved images.
    - **Approval, for P2 (from the final review):**
      - A real figure is published when its status is `approved`, with all its `figure_questions`.
      - `approveReal` sets that from the screen, the writer's check and the blind review: questions the review failed are dropped, and an image it judged unclear is rejected.
      - Any rejection, whether by the screen, the scanned-page rule or the review, removes the image's questions.
      - Pilot result: 86 images approved, with 142 questions (Cells 16, Classification 19, Flowering plants 16, Apparatus 18, Landforms 8, Cold War 9; 39 of them diagrams).
    - **The screen judges distant examples against the learners' own region**, from the curriculum: Rwanda and East Africa for Rwanda and Cambridge, Nigeria or West Africa for NERDC, WAEC and JAMB.
    - Spend for P1b.2 in all: $5.30; P1 in all $19.33. Library total $45.13.
- **P2 Foundation.** The staging store and local file layout (5.6), the Postgres tables, the quiz-route library source, the credit line, the coverage report, and the publish script.
  - Exit: library figures appear in real quizzes on this machine, served from the local folder. Going live waits for S3 and CloudFront; then it is publish, set `FIGURE_ASSET_BASE`, deploy, and check a live marker.
  - **P2a result (2026-10-12, plan `2026-10-12-figure-library-p2a-local-quizzes.md`):** the local half, built, with no model spend.
    - **Approval.** `review-drawn.ts --approve` approved 598 drawn figures in all 20 families (the 2 review rejections stay rejected). The store now holds 684 approved figures, 598 drawn and 86 real, on 22 topics (`coverage-report.ts`).
    - **Source.** `lib/figure-library/local-source.ts` reads the store read-only, and only when `FIGURE_LIBRARY_DIR` and `FIGURE_ASSET_BASE` are both set; on Amplify neither is, and the route is unchanged. A quiz on sections takes its topics' figures.
    - **Choosing.** Library figures come after the bank's, within the same three-in-five share. They are shuffled and taken from each source in turn, and each comes with its question reserved: a wording not yet on the paper, one the student has not had, of the kind the quiz's mix asks for at its place.
      - Drawn families ask the same few questions of every figure ("What is the median?"), and the route removes a repeated wording. A one-family topic therefore gives one or two figures per quiz; P3's further families and wordings are what fill it.
    - **Files.** `/api/figure-library/asset/...` serves `assets/` only, in development only.
    - **Credit.** A real image shows its credit line under the figure in the quiz and on the results page, and on a recall card made from a missed question.
    - **Before going live:**
      - Quizzes made on this machine save `/api/figure-library/asset/...` addresses to the production database, and those figures show broken there.
      - The Postgres tables, the publish script and a Postgres source (P2b) wait for S3.
- **P3 Drawn at scale.** In waves by subject: Maths, Physics, Chemistry, Biology, Geography, Economics and Business, Computing, Languages, History, Music. Each wave starts with samples for the user.
  - Exit: each wave's families pass review; the wave's topics reach their drawn share.
  - **P3a result (2026-10-12, plan `2026-10-12-figure-library-p3a-maths-samples.md`): the Maths wave's samples. $0 spent, nothing written to the store.**
    - **Families:** 37 Maths families: 28 new and the pilot's 9 reworded, across number, measure, geometry, solids, graphs, coordinates, statistics and probability.
      - Every answer is recomputed by a test over 1,000 figures.
      - Where it can be, the answer is checked against the drawing itself: polygons from their angles, areas by the shoelace formula, every circle-theorem angle measured, cube nets folded, transformations without symmetry and every wrong option shown not to fit.
      - 586 tests pass, including one per finding of the whole-branch review.
    - **Questions stand alone:** a quiz asks one question per figure.
      - Each question carries what it needs: its scale, its size, which line.
      - Each question needs the figure: the given angles are on the drawing, not in the question.
      - Each answer is accepted in every fair form ("8" for "8.0", "15 eggs" for 15).
    - **A wording of its own:** 27 of every 30 figures carry a question no other has, because the quiz route drops a repeated wording.
    - **Linking:** families reach topics by P0 concept and level (`link.py`).
      - A topic counts its sections' concepts.
      - At Primary, a figure reaches only the school years it suits, read from the book's name: a 7-digit place-value chart is Stage 6, not Stage 1.
      - Concepts that pulled families into calculus, ratio or polynomial chapters were dropped, or those chapters are avoided by name.
    - **Coverage of the 302 mapped Maths topics** (school years counted): with no figure source, 298 before and 107 with the wave. With six or more families, 0 before and 16 with the wave.
      - The 107 are mostly A Level and Upper Secondary functions, calculus, matrices, complex numbers, money and finance.
      - They need a second Maths batch: function and trigonometric graphs, money, Argand diagrams, mechanics and distributions.
      - Thirteen families reach under three topics at some level, because today's books barely teach them. Bearings reaches none, since no book names bearings or nets.
    - Sample sheet: https://claude.ai/artifact/4sEbeJdYjQM77F6vrWo2Ju
  - **P3b result (2026-10-12, plan `2026-10-12-figure-library-p3b-maths-scale.md`): the Maths wave drawn, reviewed and approved. The blind review cost $12.04; the library total is $57.17.**
    - **Store:** all 36 drawn families pass the blind review, and 5,144 Maths figures are approved.
      - Each family has 150 figures, except four that have no more different figures: clock 144, quadratic 84, pattern 66, conversion 54.
      - Bearings is not drawn, because no book teaches it yet.
      - The library holds 5,473 approved drawn figures and 86 real images.
    - **Review:** 33 of 36 families passed the first time. The three failures, and the reviewer's notes on passing figures, were fixed; those families were redrawn and reviewed again.
      - **Fixed in the figures:**
        - travel graphs name the place;
        - cuboids look closed and say "including the top";
        - one of a thing is singular;
        - ruler objects are things the drawing looks like;
        - spinners are said to be fair;
        - the y-axis is always drawn on quadratics;
        - vectors end on their grid points;
        - histogram axes say "Age", not "Ages", and each context has its own wording.
      - **Fixed in the marking:**
        - a reading from a curve accepts a small square either way, including half-units, and asks for the nearest unit;
        - the review counts any answer the marker accepts;
        - a reviewer's "13 or 14" inside an accepted range is one answer.
    - **Linking:** the quiz check found box plots in Bivariate Statistics, pulled in by a section mapped to "dispersion".
      - One-variable families now avoid two-variable chapters, and two-way tables avoid averages and spread.
      - `generate.py --relink` moves stored figures without redrawing them or losing their reviews.
    - **The final review** found sub-types whose reviewed figures had all failed, inside families that passed as a whole.
      - The L of dots had its upright arm cut off, so the key counted dots the drawing did not show.
      - Two obtuse vertically-opposite arcs closed into a ring.
      - A translation asked about a corner the image shared.
      - All three are fixed, and the families were redrawn and passed again (the L 3 of 3, vertically opposite 6 of 6).
      - The review's slack is now stated per question: `figure_questions.tolerance`, set only on curve readings. Elsewhere every number the reviewer writes must be the key.
      - A cumulative frequency window never takes in an answer got by a wrong method: none, n/2 as the median, or a quartile read off and left.
      - After each review, triage the rejections inside passing families by sub-type, not only the failing families.
    - **Coverage of the 302 mapped Maths topics:** 195 have approved figures.
      - 153 have 50 or more, 24 have 20 to 49, and 18 have fewer than 20; all 18 are at Primary, where a figure suits only some school years.
      - 107 have none, as P3a predicted.
      - 66 topics have figures from three or more families, and 15 from six or more. Reaching section 3's mix needs the second Maths batch and real images.
    - **Next:** the second Maths batch for the 107 topics (function and trigonometric graphs, money, Argand diagrams, mechanics, distributions), then the Physics wave.
  - **P3c result (2026-10-12, plan `2026-10-12-figure-library-p3c-maths-second-batch.md`): the second Maths batch's samples. $0 spent, nothing written to the store.**
    - **Families:** 20 new ones.
      - **Calculus and functions:** tangent and gradient, stationary points, the area under a curve, limits and continuity from a graph, exponential growth and decay, sine and cosine graphs, and reciprocal curves.
      - **Complex numbers, matrices and 3D:** Argand diagrams, the unit square under a matrix, and a cuboid on x, y and z axes.
      - **A Level:** a discrete distribution, a straight-line density function, and velocity–time graphs.
      - **Money:** a shop board and a purse in Rwandan francs; sale tags, VAT receipts, commission slips and savings notices.
      - **Primary and algebra:** bar models, plans with a scale, hundred-square percentages, area models for brackets, and Pascal's triangle.
    - **Checks:** every answer is recomputed by a test over 1,000 figures, and 1,032 tests pass.
      - A new shared test fails any family that draws outside its axes. Lines that stand for whole straight lines are marked, so they may run to the frame.
      - An amount of francs is accepted in every fair form ("1,500", "1500 Frw", "1500 RWF").
    - **Linking:** the link report listed every topic each family reaches. Misfits are named in `AVOID`, for example area under a curve in Hooke's law and an area model in a book's glossary.
    - **Coverage of the 302 mapped Maths topics:** topics with no family fall from 107 to 27, and topics with six or more families rise from 15 to 17.
      - **Still empty:** completing the square, the equation of a line and types of data at A Level; mechanics (Hooke's law, projectiles, circular motion, equilibrium); hypothesis tests; proof by induction and series; indices, surds and standard form; number sets and binary operations; Thales; Primary position and time.
    - Sample sheet: https://claude.ai/artifact/GmdMwLUEFkuFSs5f3Ub3n4
    - **Final review:** it found no wrong key, and its findings are fixed:
      - velocity–time corners now lie on gridlines;
      - bar-model options no longer print the hidden number;
      - every family accepts more answer forms through `core.short` ("3,843", ".78", three significant figures, "15m/s"), and `core.money` takes "Frw 1,500";
      - prices fit what is bought;
      - every "Which equation…?" MCQ has a 2 × 2 option set, so its key cannot be picked from the options alone.
    - **Families with fewer than 150 different figures** stop there: exp_graph 136, trig_graph 120, pdf_graph 148, algebra_area 126.
    - **Next, P3d, after the user's verdict:**
      - fix what the user flags;
      - draw 30 figures of each family;
      - run the blind review (about $5);
      - triage rejections by sub-type, including those inside passing families;
      - approve, draw to volume and approve again;
      - report coverage.
  - **P3d result (2026-10-13, plan `2026-10-12-figure-library-p3d-maths-second-batch-scale.md`): the second Maths batch drawn, reviewed and approved. The blind review cost $7.99; the library total is $65.16.**
    - **Store:** all 20 families pass the blind review, and 2,928 more Maths figures are approved, so the Maths drawn total is 8,072.
      - Each family has 150 figures, except exp_graph 136, trig_graph 120, pdf_graph 148 and algebra_area 126.
      - The library holds 8,401 approved drawn figures and 86 real images.
    - **Review:** 18 of 20 families passed the first time.
      - **Area under a curve:** a question asked about curve the figure did not show. It now reads the shaded region's edge, and the shading no longer hides the axis numbers.
      - **Density functions:** the reviewer was right but wrote "17/3 ≈ 5.67". The check now reads an approximation after the exact answer as the same answer.
      - **Sub-types failing inside passing families,** each fixed, redrawn and reviewed again:
        - a wrong gradient region that was also true;
        - a tangent's letter beside the curve;
        - one number in one of several equal parts;
        - coins without "Frw";
        - "12 800" with a space, now accepted, and read by the review as one number.
      - **Noted passes acted on:** a gradient asked off the drawing; seats and stamps for squares; a curve drawn past its stated range; "the first 1 seconds"; a rain count with too few values; a reading on the plot's edge.
      - Three rejections were the reviewer's own slips and are recorded, not "fixed".
    - **New:** `generate.py --refresh-forms` widens stored figures' accepted answers in place where the stem and key are unchanged, so their reviews still stand.
    - **Coverage of the 302 mapped Maths topics:** 274 have approved figures.
      - 242 have 50 or more, 20 have 20 to 49, and 12 have fewer than 20.
      - 88 have three or more families, and 17 six or more.
      - 28 have none: those P3c listed, plus derivatives of exponential functions, which the calculus families now exclude as a misfit.
    - **Final review:** it confirmed, figure by figure, that every approved figure matches the reviewed code. Its findings are fixed:
      - the review now reads "x ≈ 1.6" as a label and the answer, and a hedge after "≈" as a second answer;
      - the integral MCQ varies the limits read off the shading and the curve's sign, so no option can be picked without the figure (area_under_curve was redrawn and passed again, 30/30);
      - `--refresh-forms` leaves any figure whose options, kind or tolerance changed;
      - three and four significant figures are offered only for decimals under 10.
    - **Answer forms refreshed:** 284 stored figures of earlier families (sample_space, supply_demand, cross_section and others) gained the newer fair forms in place, with no figure left out and every review kept.
    - **Money bar models (2026-10-13, job `p3d-money`, $0.12):** about a third of bar models are now about francs, in the steps a learner pays in. A new per-figure `avoid_for` in `link.py` means only those reach the francs chapters: 43 of 43 bar models there are about money, and they passed review 30/30.
    - **Next:** the Physics wave (P3e), starting with sample figures for the user.
  - **P3e result (2026-10-13, plan `2026-10-13-figure-library-p3e-physics-samples.md`): the Physics wave's samples. $0 spent; nothing new written to the store.**
    - **Families:** 19 new ones.
      - **Motion and forces:** distance–time and speed–time graphs, force diagrams (along a line, or at right angles at UP), moments on a metre rule, and force–extension graphs.
      - **Matter and energy:** U-tube manometers and blocks on their faces, density by displacement, and Sankey diagrams.
      - **Electricity:** series, parallel and mixed circuits; ammeter, voltmeter and newton-meter dials; and I–V graphs of a resistor, a filament lamp and a diode.
      - **Magnetism:** the motor effect and induction, and transformers.
      - **Heat, waves and light:** heating and cooling curves, wave graphs, reflection and refraction, converging-lens ray diagrams, and the electromagnetic spectrum.
      - **Atomic physics:** decay curves of real isotopes, and models of real atoms.
    - **Checks:** every answer is recomputed over 1,000 figures, and each family's test checks the physics itself, not only the numbers.
      - Directions are cross products (F = IL × B, v × B).
      - Refraction keeps to Snell's law on the drawn angles, and lens images obey 1/f = 1/u + 1/v.
      - Energy is conserved, and Kirchhoff's laws hold at each junction.
      - Half-lives and melting points are the real ones, and only real beta emitters decay.
      - Every value asked for lies on a mark.
      - The full suite has 1,341 tests.
    - **New shared checks:** every Physics MCQ is tested against the P3c centrality test. Lens and pressure labels are tested clear of every line.
    - **Answer forms:** `core.measure` accepts every fair form of a quantity: "6 ohms", "6Ω", "2.5N", "1 200 J", "36 kJ", "0.02 s" for 20 ms, and "−20 °C". Three significant figures now round half up, as taught. Six stored pdf_graph figures that offered "0.562" for 0.5625 were refreshed in place.
    - **Linking:** the link report was read topic by topic, and AVOID keeps each family out of chapters it does not suit. Only the motor's Sankey reaches the motor chapters.
      - Waves, the spectrum and the atom are not drawn for lower secondary, which has no chapter for them.
      - **Coverage of the 195 mapped Physics topics:** 156 get a family (121 one or two, 35 three to five).
      - **Still empty:** electric, gravitational and magnetic fields; electrostatics; circular motion and orbits; A Level thermal physics, ideal gases, capacitance, quantum physics and medical imaging; communications; relativity; lower-secondary magnetism.
    - **Final review:** it found no wrong key and confirmed the physics. Its findings are fixed:
      - a Sankey option set with two right answers;
      - garbled spring wording;
      - the manometer's gas arm drawn open, and stories that contradicted the levels;
      - a face MCQ answerable from its options;
      - labels crossed by rays;
      - circuits skewed to parallel, with a voltmeter question whose answer was printed;
      - an LDR distractor that gives a resistor's line;
      - MCQs the figure played no part in (where a figure-based question was cheap);
      - the plan's right-angle forces and equilibrium question;
      - the remaining link misfits;
      - missing unit forms.
      Its minor points are recorded in the plan's ledger.
    - Sample sheet: https://claude.ai/artifact/7UsXRD685aNXRsPuskV7Bm
    - **Next, P3f, after the user's verdict:**
      - fix what the user flags;
      - draw 30 figures of each family;
      - run the blind review (about $5);
      - triage rejections by sub-type;
      - approve, draw to volume and approve again;
      - report coverage.
  - **P3f result (2026-10-14, plan `2026-10-13-figure-library-p3f-physics-scale.md`): the Physics wave drawn, reviewed and approved. The blind review cost $7.91 (cap $8); the library total is $73.20.**
    - **Store:** all 19 families pass, and 2,599 Physics figures are approved.
      - Each family has 150 figures, except where it has fewer distinct ones: iv_graph 124, nucleus 50, em_spectrum 28.
      - The library holds 11,000 approved drawn figures and 86 real images.
    - **Review:** the first pass gave 495 of 547. Two network drops were resumed.
      - **Failing families, fixed by TDD, redrawn and reviewed again:**
        - **Meter dials (8 of 30):** dials of 30 to 50 small divisions were misread by one. They now have at most 12, with two or more between each number.
        - **Lens diagrams (1 of 9):** "What is the magnification?" was read as signed. They now ask how many times as tall, and number the axes in centimetres.
      - **Other fixes, from rejections and noted passes:**
        - each question states what it assumes: friction ignored, the rule's weight, an ideal transformer, resistance as V ÷ I;
        - each motion question names what moves;
        - manometer levels are dashed to the scale;
        - the spring's limit is a visible corner;
        - decay questions sit on gridlines inside the plot;
        - lamp curves keep rising;
        - devices run at real powers;
        - atoms go up to aluminium;
        - the transformer's coils are marked not to scale.
      - **The answer check now reads, as one answer:**
        - a restated unit ("0.5 A (500 mA)");
        - standard form ("4 × 10^4");
        - a unit's power ("m/s^2");
        - trailing zeros ("0.020 s").
      - Grams are accepted as kilograms.
      - A family with fewer than 30 figures passes once all of them are reviewed, at 27 in 30.
      - Three rejections were the reviewer's own slips, and are recorded.
    - **Coverage of the 195 mapped Physics topics:** 156 have approved figures.
      - 146 have 50 or more, and 10 have 20 to 49.
      - 35 have three or more families.
      - 39 have none: fields, electrostatics, orbits and circular motion, A Level thermal physics, gases, capacitance, quantum physics and medical imaging, communications, relativity, and lower-secondary magnetism.
    - **Quiz check (in process, the way the route reads it):**
      - resistors in circuits: 118 figures, 410 questions;
      - lenses: 150 figures, 750 questions;
      - radioactivity: 76 figures, 228 questions.
    - **Next:** the next subject wave (Chemistry or Biology), or Physics families for the 39 empty topics (fields, orbits, capacitance), whichever the user chooses.
  - **P3g result (2026-10-14, plan `2026-10-14-figure-library-p3g-physics-gaps-and-chemistry.md`): the Physics gaps and the Chemistry wave, as samples. $0 spent; nothing new written to the store.** The user asked for both ("do all that you reccomend") and then gave standing approval to keep going ("i agree and approve whatever yo do till i get back"). So the sheets are published, and scaling (P3h) does not wait for a verdict.
    - **23 families:**
      - 9 Physics families for the empty topics: electric_field, coulomb_force, magnet_field, circular_motion, gravity_orbit, gas_law, capacitor_discharge, photoelectric and energy_levels.
      - 14 Chemistry families: particle_diagram, electron_shells, ionic_bonding, covalent_bonding, periodic_table, organic_structure, energy_profile, electrolysis, rate_graph, solubility_curve, ph_curve, mass_spectrum, titration and chromatogram.
    - **The chemistry is checked on what is drawn, over 1,000 seeds:**
      - shells fill 2,8,8,2;
      - ionic charges balance;
      - every covalent and organic atom has its full number of bonds;
      - electrolysis products follow the discharge rules;
      - pH curves are solved from the charge balance;
      - solubility and isotope data are real, rounded to the grid.
    - **Shared changes:**
      - `core.formula_forms` accepts "H2O" for "H₂O" and "Mg2+" for "Mg²⁺".
      - The review's `agrees` now reads a charge's sign and its element. Before, "2-" passed for "2+".
    - **The fresh review** found 2 Critical and 8 Important problems, all fixed with tests:
      - overlapping particles in a solid mixture;
      - a "most soluble" question asked where two rounded curves met;
      - rate-graph changes that did not fit the reaction (acid added to hydrogen peroxide);
      - a stop time the curve hid;
      - the sign-blind grader;
      - hydrogen asked for its group, and a B³⁺ ion;
      - pH values read between gridlines;
      - a guessable bond-type MCQ;
      - a half-shaded magnet that hinted at the pole;
      - link misfits.
    - **Links:** each family's AVOID was read topic by topic. capacitor_discharge reaches only A Level Capacitance; the Chemistry families reach 4 to 33 topics each.
    - **Sheets:** Chemistry at https://claude.ai/artifact/AS8zC9cQzqPeCa1zqCGLgn, and the Physics gaps at https://claude.ai/artifact/XFygkwvbENVmF5WCPB6HM3.
    - **Next:** P3h, drawing these 23 families at scale (plan `2026-10-14-figure-library-p3h-gaps-and-chemistry-scale.md`). After it, the Biology wave (P3i), whose first six families are already built.
  - **P3h result (2026-10-15): the Physics gaps and the Chemistry wave, drawn, reviewed and approved.** The blind review cost $5.64 and the fix review $2.56; the library total is $81.79.
    - **First pass:** 515 of 680 figures passed. 89 rejections were the answer check, not the figures. The reviewer had the answer right but wrote it as:
      - a word with a gloss: "Copper (metal)";
      - a charge inside text: "Cu2+ (copper(II) ion)";
      - the key to 2 or 3 significant figures: "158 mJ (158.4 mJ)";
      - a form in standard form: "11 ×10¹⁴ Hz";
      - "about" before a unit with a number in it: "about 170 g per 100 g of water";
      - a part ending in an accepted form: "also called group 15".
    - **The fixes:**
      - `agrees` reads all six patterns, plus a bare unit factor ("7 (×10¹⁴ Hz)"). This was a free regrade.
      - Eight families were redrawn and reviewed again:
        - field lines on the plates are arrowed and evenly spaced;
        - magnet field lines are traced from the magnet's surface, after correct arrows were read as pointing into N;
        - particle boxes are all drawn as gases, after a solid box among element, compound and mixture boxes read as no solid;
        - covalent bonding counts one named multiple bond;
        - group numbering is stated;
        - burette readings carry ±0.05 cm³ and photoelectric intercepts ±0.2.
    - **Approved:** all 23 families, 2,978 figures. gravity_orbit has 20 distinct figures, organic_structure 82, magnet_field 76, photoelectric and ionic_bonding 72 each, and electrolysis 128.
    - **Coverage:**
      - Physics: 176 of the 210 mapped topics have figures, 163 with 50 or more.
      - Chemistry: 107 of 185 have figures, 90 with 50 or more (it had 1).
      - Library: 14,064 drawn and real figures approved.
    - **Quiz check (in process):** electrochemical cells, 64 figures and 256 questions; indicators and titration curves, 214 and 708; carboxylic acids, 44 and 176.
    - **Next:** the Biology sheet (P3i, built and reviewed), its scale (P3j), and the Computing wave (P3k), which has the most empty topics (397).
  - **P3i result (2026-10-15, plan `2026-10-14-figure-library-p3i-biology-wave.md`): the Biology wave as samples.** $0 spent; nothing new was stored.
    - **15 new families:**
      - enzyme, photosynthesis, population, osmosis, blood-glucose and spirometer graphs;
      - pedigrees, solved for the genotypes the chart decides, and DNA strands;
      - quadrats, dichotomous keys of real leaves (maize, banana, mango, avocado, hibiscus, cassava, bean, neem), and variation charts;
      - magnification, antibiotic plates, agar cubes and food test tables.
    - **Changes to existing families:** Biology joined the wording test; food_web and punnett gained concepts and a named lead sentence.
    - **The fresh review** found:
      - Critical: cassava drawn as five free ellipses read as five leaflets, so the key led to neem;
      - Important: a scale bar that could not be measured on screen;
      - Important: MCQs that needed no figure (insulin, "denatured", "which is a producer");
      - Important: units written several ways.
      All were fixed with tests.
    - **Sheet:** https://claude.ai/artifact/4NdZG8ffZRKyC94UiWVvTc
    - **Next:** P3j, drawing Biology to scale, and P3k, the Computing wave.
  - **Curriculum audit (2026-10-15), after the user asked whether quadrats are really taught at upper secondary.** They are: Rwanda S4 Biology Unit 1 covers sampling techniques, Rwanda S6 covers measuring population density, and Cambridge AS/A Level covers systematic sampling. But some links were loose, so every subject's links were checked against the books' subtopics.
    - **The rule:** `link.topic_index` now carries each topic's section names. A family may declare `NEEDS`, a pattern for what it teaches. A topic whose book lists sections is reached only when its name or one of its sections matches. Topics without sections (WAEC, JAMB, NERDC) are judged by concepts as before.
    - **Applied to:** all 17 Biology families, 11 Chemistry families and 6 Physics families. Eleven Maths families gained targeted `AVOID`s, read section by section.
    - **spring_graph** is now Upper Secondary only: no Lower Secondary book teaches springs.
    - **Effect:** 5,223 loose links removed (92,296 to 87,073 before P3j). Physics 173 of 210 topics with figures (162 with 50+), Chemistry 98 of 185 (84), Maths 271 of 515 (238). The P3h figures above were before the audit.
  - **P3j result (2026-10-15, plan `2026-10-15-figure-library-p3j-biology-scale.md`): Biology at scale.** $5.09 spent (blind review $3.80, three fix reviews $1.29); library total $86.88.
    - **Blind review:** 475 of 510 passed. Three families fell short:
      - quadrat (13 failures): labels covered plants and plants sat on edges. Plants now stand clear of edges and labels.
      - osmosis_graph (20): "% decrease in mass" and like forms were missing. Forms were added; a free regrade flipped 10.
      - dna_strand (26): no 5′ and 3′ ends, so the codon could be read either way. The ends are now drawn. Reviewers then read "written 5′ to 3′" backwards, and called "(left to right)" a contradiction, so the stem asks for "the mRNA codon that pairs with bases i to i+2 … in order from left to right". The key was right throughout.
    - **Approved:** all 17 families, 2,490 figures. punnett has only 96 distinct figures; the rest have 150 each.
    - **Coverage:** Biology 80 of 169 mapped topics have figures, 77 with 50 or more (it had 9). Library: 16,494 figures approved, 95,741 approved links.
    - **Quiz check (in process):**
      - Movement into and out of cells: 283 figures, 999 questions.
      - Rwanda S4 Introduction to biodiversity: 299 figures, 892 questions.
      - Respiration and gas exchange: 226 figures, 828 questions.
      None were missing a question or a file.
    - **Next:** P3k, the Computing wave (397 empty topics).
  - **P3j final review and the index fix (2026-10-15).** $0.
    - **The app's marker (Critical):** the short-answer slip allowance applied to a whole accepted form. So "2 hydrogen bonds" passed for "3 hydrogen bonds", and "5% increase in mass" for "5% decrease in mass". It is now judged word by word: numbers and words under 8 letters must be exact (`lib/short-answer.ts`).
    - **Six NEEDS misfits:** osmoregulation, codominance, work and energy, oxidation numbers, measurement errors and plant nutrition no longer receive figures.
    - **The index:** `topic_map.dropped` counts the invalid ids the mapper returned. link.py read it as "the topic was dropped", which hid 491 mapped topics, 213 of them Maths. They are now indexed.
      - That reached 234 more topics. Each was read by name, and the misfits were named in AVOID across 45 families; no existing link was lost.
      - 75 Lower Secondary spring graphs had been left unlinked when spring_graph became Upper Secondary only; they were rejected.
    - **Coverage:**
      - Maths: 425 of 515 topics have figures (373 with 50 or more).
      - Physics: 186 of 210 (174).
      - Chemistry: 107 of 185 (90).
      - Biology: 80 of 169 (76).
      - Library: 16,419 figures approved, 126,839 approved links.
    - **Quiz check:**
      - Rwanda Primary "Numbers from 0 up to 200": 41 figures, 123 questions.
      - IGCSE "Histograms and cumulative frequency diagrams": 264 figures, 1,034 questions.
      - AL "Cell membranes and transport": 17 figures, 68 questions.
  - **P3k result (2026-10-15, plan `2026-10-15-figure-library-p3k-computing-wave.md`): the Computing wave as samples.** $0 spent; nothing new was stored.
    - **15 families**, each answer computed by running what is drawn:
      - logic: gates and truth tables;
      - algorithms: flowcharts, trace tables of Cambridge-style pseudocode, bubble and insertion sorts, binary search;
      - data: binary place value, bitmaps, sound samples;
      - applications: spreadsheet formulas, SQL queries, network topologies;
      - structures and security: binary search trees, stacks and queues, Caesar ciphers.
    - **Links:** read by name. 109 misfit pairs were named in AVOID: AS IT topics with no sections, storage hardware, Java, C++ and Visual Basic introductions for pseudocode, and word processing. They reach 106 of the 397 Computing topics that had no figure.
    - **The fresh review** found:
      - Critical: truth-table blanks that could not be worked out, with no expression printed;
      - Important: stacks and queues that overflowed their drawn cells; insertion passes that moved nothing; stems that printed the list; one-digit hex refused.
      - Re-graded to Important: "cell B2" and bit codes in fours refused; empty trace-table cells, which Cambridge reads as "unchanged"; a mesh of four whose crossing diagonals read as a junction.
      All were fixed with tests.
    - **The grader:** a probe of `agrees` found that it matched codes by their digits, so "3E" reached "3F" and "D4" reached "C4". Fixed before any Computing review was paid for.
    - **Sheet:** https://claude.ai/artifact/EBt1kTPURmuHeZhxzp6B93
    - **Next:** P3l, drawing Computing at scale (plan `2026-10-15-figure-library-p3l-computing-scale.md`).
  - **P3l result (2026-10-15, plan `2026-10-15-figure-library-p3l-computing-scale.md`): Computing at scale.** $4.46 spent (blind review $3.28, fix review $1.18); library total $91.34.
    - **Blind review:** 414 of 450 passed. bitmap_image (6/30) and truth_table (21/30) failed for one reason: a later question gave the figure to another person ("Keza's image" beside "Kalisa drew this bitmap"), and reviewers, who read every question at once, called it unclear whose image it was. A test now keeps a figure's owner to the first question's person, in Computing and Geography. Trace tables now say each row is the values after one time round the loop.
    - **Fix review:** 149 of 150 passed.
    - **Approved:** all 15 families, 2,248 figures (150 each, two rejected).
    - **Coverage:** Computing 106 of 397 mapped topics have figures, 101 with 50 or more (it had none). Library: 18,667 figures approved.
    - **Quiz check (in process):**
      - Rwanda "Introduction to Computer Algorithm": 375 figures, 990 questions.
      - Cambridge AL "Algorithms": 372 figures, 1,085 questions.
      - a spreadsheet topic: 71 figures, 213 questions.
      None were missing a question or a file.
    - **Next:** P3m, the Geography wave (plan `2026-10-15-figure-library-p3m-geography-wave.md`).
- **P4 Real images at scale.** Real-rich and hard topics first.
  - Exit: the $380 budget is used, or every topic's real share is met.
- **P5 Fill and report.**
  - Exit: the coverage report meets section 3. Topics still short get more drawn instances or are on the user-approved exceptions list.

## 10. Prerequisites from the user

1. **AWS, when it is working again** (P0 to P3 do not need it). An S3 bucket and CloudFront distribution for figures. An IAM user key for the pipeline with S3 write, Bedrock invoke, and permission to create batch jobs. A Bedrock batch service role that can read and write the batch bucket. The `.env.assets.local` key planned on 2026-10-08 can be widened to cover this.
2. **Free API keys:**
   - Openverse: OAuth app registration, which raises the anonymous limit of 100 requests a day.
   - Smithsonian: an api.data.gov key.
   - Pixabay.
   NASA, Wikimedia, the Met, CDC and iNaturalist need no key.
3. **A contact email for API user agents.** Wikimedia requires one. I will not use the account email without permission.

## 11. Risks

- **Haiku question quality.** Untested on figures. Measured in P1; the fallback is written into 5.3.
- **Hard topics** (summary writing, literary appreciation, religious studies). Some may not reach 50 educational figures. They are surfaced in P0, never padded with weak images.
- **Licence metadata errors on aggregators.** Licences are re-confirmed on the source page.
- **Rate limits** (Openverse, Pixabay). Harvests are throttled and resumable; Wikimedia and Smithsonian carry most of the volume.
- **Time.** About 250 drawn families is a large build. It ships in subject waves, so value lands early and each wave is reviewed.
- **Database size.** About 250,000 figure rows and about 400,000 question rows (under 1 GB). The production database plan should be checked for headroom before P2.

## 12. Testing

- **Drawn families:** pytest per family. `check()` holds on 1,000 seeds; parameters stay in range; SVG parses; no two of 1,000 seeds produce the same key parameters.
- **Pipelines:** unit tests for licence whitelisting, hash de-duplication, spend estimation and refusal, and stage resumability (fixtures, no network).
- **App:** vitest for the library source in `figuresForQuiz` (concept lookup, level band, repeat avoidance) and for the credit line. tsc stays clean. A production-simulation boot test runs before every push, and a live marker is checked after.
