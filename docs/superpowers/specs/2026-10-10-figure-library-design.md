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
      - 495 tests pass.
    - **A wording of its own:** 27 of every 30 figures carry a question no other has, because the quiz route drops a repeated wording.
    - **Linking:** families reach topics by P0 concept and level (`link.py`).
      - A topic counts its sections' concepts.
      - At Primary, a figure reaches only the school years it suits, read from the book's name: a 7-digit place-value chart is Stage 6, not Stage 1.
    - **Coverage of the 302 mapped Maths topics:** with no figure source, 298 before and 83 with the wave. With six or more families, 0 before and 16 with the wave.
      - The 83 are mostly A Level and Upper Secondary functions, calculus, matrices, complex numbers, money and finance.
      - They need a second Maths batch: function and trigonometric graphs, money, Argand diagrams, mechanics and distributions.
      - Thirteen families reach under three topics at some level, because today's books barely teach them (none names bearings or nets).
    - Sample sheet: https://claude.ai/artifact/4sEbeJdYjQM77F6vrWo2Ju
    - **Next, P3b, after the user's verdict:** fixes, generation, the blind review (about $10), approval and coverage.
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
