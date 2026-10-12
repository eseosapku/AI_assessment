# Figure Library P3c: The Second Maths Batch and its Sample Sheet

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 20 new drawn Maths families reach the 107 mapped Maths topics that P3b left without figures (calculus, functions, complex numbers, matrices, 3D, A Level statistics and motion, money and commerce, Primary operations and proportion, algebra). They are shown to the user on a sample sheet before anything is generated at scale.

**Architecture:**
- **Same machinery as P3a and P3b.** Each family is a module in `scripts/figgen/families/` that declares `CONCEPTS`, `BANDS` and, where a chapter shares a word without the content, `AVOID`. It links through `link.py`.
- **Shared test.** A new test requires everything a family draws to lie inside its axes. The P3b final review found an L of dots drawn half outside its space.
- **The sample sheet** is `wave_sheet.py`, with a new `--families` filter and phase label, so the user sees only this batch. Coverage is counted against what is already approved.
- **Generation and the blind review wait for the user's verdict** (P3d).

**Tech Stack:** Python 3.12, matplotlib, pytest (`python -m pytest scripts/figgen -q -p no:cacheprovider`), sqlite3 (read-only here).

**Spec:** `docs/superpowers/specs/2026-10-10-figure-library-design.md`. The relevant parts are section 3 (success criteria), 5.2 (drawn figures) and 9 (P3: "in waves by subject … each wave starts with samples for the user"; the P3b result's "Next").

## Global Constraints

- **Cost and store.**
  - No model spend.
  - No writes to the staging store: the linker and sheet open it read-only.
  - No production database access.
- **Answers.**
  - Every answer is computed by the code that drew the figure, and an answer test recomputes it independently over 1,000 seeds.
  - **MCQs:** exactly one option is correct, with no two options equivalent. For example, a matrix's transpose may not equal the matrix, and no equation may appear in two forms.
  - **Short answers:**
    - at most 40 characters;
    - every fair form is accepted: with and without the unit; "x = 2" and "2"; "(4, 3, 2)", "(4,3,2)" and "4, 3, 2"; "3 + 2i" and "3+2i"; a fraction in lowest terms and its terminating decimal; "1,500", "1500" and "1500 Frw"/"1500 RWF";
    - never a key that differs from a wrong answer only by case.
  - **Exact by default.** Every value asked for lies on a gridline, a lattice point or a printed label. A question that asks for an estimate states its `tolerance` (`core.short(..., tolerance=)`). No tolerance window may take in an answer got by a wrong method. This batch plans no estimates.
- **Readable.**
  - Everything drawn lies inside the axes (the new shared test).
  - No two pieces of text overlap (the existing `test_no_two_pieces_of_text_overlap`).
  - Arcs, asymptotes and marked points never merge into a shape that reads two ways.
- **Level** (the user's bar, 2026-10-12): numbers, vocabulary and methods suit the band.
  - Primary uses whole numbers, with stage limits read by `stages(p)`.
  - Contexts are ones learners in Rwanda know. Names come from `core.NAMES`; prices are in Rwandan francs (Frw), with the coins and notes in use (coins 10, 20, 50, 100; notes 500, 1000, 2000, 5000); VAT is 18%.
  - Real places are never given invented measurements.
- **Variety** (spec 3.4): `test_figures_vary_from_seed_to_seed` holds at 40 different figures in 60 seeds, ignoring the name, unless a family sets `MIN_VARIETY`. Generation must reach 150 different figures, or the family states its limit.
- **A wording of its own:** 27 of 30 figures carry a stem no other has (the existing shared test).
- **Commits.**
  - Commits stay local on `aws_deploy`, and the three unrelated working-tree files stay out of them.
  - Messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **A value read between gridlines.** Examples: a tangent's second point, a curve value off a lattice point, an asymptote between lines, a vertex of a transformed square, a speed at a corner of a velocity–time graph. Expected: every value asked for is a lattice point or a printed label. Pinned per family by a "reads exactly" assertion in its answer test.
2. **A sub-type that draws wrongly while the family passes.** Examples: a piece outside the axes, two arcs or asymptotes that merge, an open-circle point hidden under a filled one. Expected: the inside-the-axes test (Task 1), and a look at one figure of every sub-type (Task 8), not just seeds 1 to 3.
3. **An MCQ with two defensible answers.** Examples: a matrix equal to its transpose; equations of a line or curve that are the same written two ways; a limit that "does not exist" when the one-sided limits agree. Expected: pairwise inequivalent options. Pinned per family.
4. **A family linked into chapters it does not suit.** Examples: an area under a curve in "Hooke's law", or an algebra area model in "Integration". Expected: the link report (Task 8) lists every topic each family reaches, and `AVOID` removes the misfits before the sheet.
5. **Money answers marked wrong for a fair form:** "1,500 Frw", "1500", "1500 RWF". Expected: accepted. Pinned in the money families' answer tests.

## File Structure

- `scripts/figgen/core.py` (modify): `function_axes(ax, x0, x1, y0, y1, ystep)`, the coordinate-grid set-up the function-graph families share; `money(n)` for amounts and their forms.
- `scripts/figgen/families/*.py`: 20 new modules, registered in `families/__init__.py`.
- `scripts/figgen/wave_sheet.py` (modify): `--families` and `--label`.
- `scripts/figgen/tests/test_families_layout.py` (modify): the inside-the-axes test.
- `scripts/figgen/tests/test_families_answers.py` (modify): one answer test per new family.
- `scripts/figgen/tests/test_wave_sheet.py` (modify): the filter.

---

### Task 1: Groundwork

**Produces:**
- `core.function_axes(ax, x0, x1, y0, y1, ystep=1)`: axes through the origin, both spines at zero, a grid on every unit with ticks every `ystep`, limits padded by 0.5, and labels at size 8.
- `core.money(n) -> list[str]`: the fair forms of an amount of francs, for example "1500", "1,500", "1500 Frw", "1,500 Frw", "1500 RWF", "1500Frw" and "1500 francs".
- `wave_sheet.main(--families a,b,c --label "P3c, the second Maths batch")`.

- [ ] **Step 1: Failing tests.**
  - `test_families_layout.py::test_everything_drawn_lies_inside_the_axes[fid]`, for every family over seeds 1–20. Every `Line2D`'s data, and every patch's data-space vertices, must lie within the axes' x and y limits (with 1e-6 slack). Text is excluded; the overlap test covers it.
  - `test_core.py` (new):
    - `money(1500)` includes all the forms above;
    - `money(500)` has no comma form.
  - `test_wave_sheet.py`: `main(["--families", "quadratic_graph", ...])` writes a sheet with one family and the label given.
- [ ] **Step 2: Run** and expect a FAIL. If an existing family fails the inside-the-axes test, triage it against its PNG:
  - a real clip is fixed;
  - an intentional overhang (a parallel-marks arrowhead past the line end, say) widens that family's limits.
  - Record each as a ruling.
- [ ] **Step 3: Implement.** **Step 4:** the suite goes green.
- [ ] **Commit:** `feat(figgen): everything drawn inside the axes; function axes and money forms; a sheet for some families`.

---

### Tasks 2–7: The new families

**Every family:**
- Is a module declaring `ID`, `KIND`, `SUBJECT = "mathematics"`, `BANDS`, `CONCEPTS`, plus `stages(p)` at Primary and `AVOID` where needed. It has `sample(rng)` (with `band` when it has several), `draw(p)` and `questions(p, rng)`, built with `core.mcq`, `core.short` and `core.count`.
- Is registered in `families/__init__.py`, and passes every shared test.
- **Order per family:**
  1. Write the answer test in `test_families_answers.py`. It recomputes every answer from the params over 1,000 seeds and checks the invariants listed below; run it and see it fail.
  2. Write the module.
  3. Get the tests green.
  4. Read the PNG of one instance of every sub-type and band, and fix what a student would trip on.
- **One commit per task:** `feat(figgen): second maths batch: <group>`.
- Concepts are listed without the `mathematics.` prefix.

#### Task 2: Calculus graphs (Upper Secondary, A Level)

- **tangent_gradient** (`maths.coordinate`; UP)
  - **Draws:** y = ax² + bx + c or a cubic with integer coefficients, its equation printed, and the tangent at P (a lattice point). Two lattice points on the tangent are marked.
  - **Asks:**
    - "Use the two marked points to find the gradient of the tangent at P." (short);
    - "What is the gradient of the curve at P?" (from dy/dx, the same number; the stem names the equation);
    - "Which is the equation of the tangent at P?" (MCQ);
    - "What is the gradient of the normal at P?" (short, a fraction in lowest terms and its decimal where it terminates).
  - **Invariants:**
    - the tangent gradient is a non-zero integer from −6 to 6;
    - the marked points are lattice points inside the view, at least 2 apart;
    - P is a lattice point.
  - **Concepts:** curve-gradient, gradient-function, tangents-normals, rates-of-change, differentiation-applications.
- **stationary_points** (`maths.coordinate`; UP, AL)
  - **Draws:** the curve y = a(x³ − (3/2)(r + s)x² + 3rsx) + d (r and s of the same parity, a = ±1), or a quadratic. Its equation is printed, and the turning points are marked A and B on lattice points.
  - **Asks:**
    - "What are the coordinates of the maximum point?" (MCQ: swapped, the minimum, signs);
    - "For which values of x is the gradient negative?" (MCQ);
    - "How many solutions has f(x) = k?" (short; k strictly between or beyond the turning values, never equal to one);
    - AL: "At which point is d²y/dx² > 0?" (MCQ: A or B).
  - **Invariants:**
    - f′(r) = f′(s) = 0;
    - the turning values are integers in view;
    - the y-grid steps 1 or 2.
  - **Concepts:** stationary-points, optimization-practical-maximum-minimum, derivatives-second, cubic-polynomials-graphs-moduli.
- **area_under_curve** (`maths.coordinate`; UP, AL)
  - **Draws:** y = 3αx² + 2βx + γ (the derivative of a cubic with integer coefficients), positive on [a, b]. The region under it from x = a to x = b is shaded, and the equation is printed.
  - **Asks:**
    - "Calculate the area of the shaded region." (short, an integer, "units²" accepted);
    - "Which integral gives the shaded area?" (MCQ: limits swapped, the wrong upper limit, the derivative in place of the function);
    - "What is the value of ∫ from a to (a+1) of f(x) dx?" (short, an integer).
  - **Invariants:**
    - f > 0 on [a, b];
    - a and b are integers in view;
    - the area is recomputed by exact antiderivative.
  - **Concepts:** definite-integrals, integration, indefinite-integrals, differentiation-reversed. Chapters to avoid are decided in Task 8 (the candidates are mechanics, hyperbolic functions and random variables).
- **limit_graph** (`maths.coordinate`; UP)
  - **Draws:** a piecewise function of line segments with a break at x = a: a jump, a hole (a removable discontinuity), or continuous. Open and filled circles are drawn at x = a.
  - **Asks:**
    - "What is f(a)?";
    - "What is the limit of f(x) as x tends to a from the left?";
    - "… from the right?";
    - "Does the limit as x → a exist?" (MCQ: yes and its value, no because the one-sided limits differ, and so on);
    - "Is f continuous at x = a?" (MCQ).
  - **Invariants:**
    - every key value is an integer at a lattice point;
    - the open and filled circles never coincide, except in the continuous case, where only a filled one is drawn;
    - the MCQ's right option follows the case.
  - **Concepts:** limits-numerical-functions, one-sided-limits, function-continuity, limits-applications.

#### Task 3: Function graphs (Upper Secondary, A Level)

- **exp_graph** (`maths.coordinate`; UP)
  - **Draws:** a decay or growth curve in context, such as "the mass of a medicine in the blood" or "a population of bacteria", N = N₀ · 2^(±t/T). The grid places N₀, N₀/2 and N₀/4 (or 2N₀ and 4N₀) on gridlines at t = 0, T and 2T. A pure-maths variant draws y = kˣ (k = 2 or 3) with its asymptote.
  - **Asks:**
    - "What was the mass at the start?";
    - "From the graph, what is the half-life?" (or the doubling time);
    - "What mass is left after 2T?";
    - "Which equation describes the curve?" (MCQ: the base, N₀ or the period wrong).
  - **Invariants:** every asked value is on a gridline at a whole-number time.
  - **Concepts:** exponential-equations-practical-applications, decay-radioactive, population-growth-problems, continuity-exponential-functions, exponents-logarithms-applications, inverse-logarithmic-exponential.
- **trig_graph** (`maths.coordinate`; UP)
  - **Draws:** y = a sin(bx°) + c or y = a cos(bx°) + c for 0 ≤ x ≤ 360, with x gridlines every 30° or 45°, and a ∈ {1, 2, 3}, b ∈ {1, 2, 3}, c ∈ {−1, 0, 1, 2}.
  - **Asks:**
    - "What is the amplitude?";
    - "What is the period?" ("180", "180°");
    - "What is the greatest value of y?";
    - "Which equation is drawn?" (MCQ: sin and cos swapped, b, a or c wrong);
    - "How many solutions has the equation y = k for 0 ≤ x ≤ 360?" (short; k strictly between the minimum and maximum, never equal to either).
  - **Invariants:** the maxima and minima lie on gridlines; no two options draw the same curve.
  - **Concepts:** trigonometric-functions-graphs, trigonometric-inequalities, equations-inequalities, simple-harmonic-motion.
- **rational_graph** (`maths.coordinate`; UP, AL)
  - **Draws:** y = k/(x − p) + q with its asymptotes dashed, where p ≠ 0, k ∈ {±1, ±2, ±3, ±4, ±6} and p divides k, so the y-intercept is an integer.
  - **Asks:**
    - "What is the equation of the vertical asymptote?" ("x = 2", "2");
    - "… the horizontal asymptote?";
    - "Where does the curve cross the y-axis?";
    - "Which equation is drawn?" (MCQ);
    - "As x tends to p from the right, y …" (MCQ: increases without limit, decreases without limit, tends to q, tends to 0).
  - **Invariants:**
    - the asymptotes lie on gridlines, and the curve never touches them;
    - the branches are clipped to the view;
    - the y-intercept is a lattice point.
  - **Concepts:** asymptotes, rational-functions, curves-relationships.

#### Task 4: Complex numbers, matrices and 3D (Upper Secondary, A Level)

- **argand** (`maths.coordinate`; UP, AL)
  - **Draws:** an Argand diagram with points A, B and C at integer coordinates from −6 to 6, with axes labelled Re and Im.
  - **Asks:**
    - "Which complex number does A represent?" (MCQ: the parts swapped, a sign, the conjugate);
    - "What is |z| for the number at B?" (short; asked only on Pythagorean points);
    - "Which point represents the conjugate of A?" (MCQ, when it is drawn);
    - "What is A + B?" (short: "3 + 2i", "3+2i").
  - **Invariants:**
    - no two points coincide;
    - the conjugate question is asked only when its point is drawn and unique;
    - points are never on an axis, unless the variant is a real or imaginary one.
  - **Concepts:** complex-numbers-applications, modulus-complex-numbers, polar-coordinate-system, exponential-form-complex-definition.
- **matrix_transform** (`maths.coordinate`; UP, AL)
  - **Draws:** the unit square OABC (or a triangle) and its image O′A′B′C′ under M = [[a, b], [c, d]] with integer entries from −3 to 3 and det ≠ 0, on a grid.
  - **Asks:**
    - "Which matrix maps OABC onto its image?" (MCQ: the transpose, the columns swapped, a sign);
    - "What are the coordinates of B′?";
    - "What is the area of the image?" (|det|);
    - "What is the determinant of the matrix?" (signed; the stem says the matrix maps the square onto the image).
  - **Invariants:**
    - b ≠ c, so the transpose differs;
    - no distractor maps the square onto the same image;
    - the image fits in −8 to 8.
  - **Concepts:** linear-transformation-2d, transformation-matrices, operations-linear-transformation, matrices.
- **points_3d** (`maths.coordinate`; UP, AL)
  - **Draws:** a cuboid OABCDEFG on oblique 3D axes x, y and z, with O at the origin and edges along the axes of lengths p, q and r. The vertices are lettered.
  - **Asks:**
    - "What are the coordinates of F?" (short: "(4, 3, 2)", "(4,3,2)", "4, 3, 2");
    - "What is the length OF?" (asked only when √(p² + q² + r²) is an integer: (1, 2, 2), (2, 3, 6), (1, 4, 8), (2, 6, 9), (4, 4, 7), (3, 4, 12), (2, 4, 4), (6, 6, 7));
    - "What are the coordinates of the midpoint of OF?" (halves as decimals);
    - "Which vertex has coordinates (p, 0, r)?" (MCQ).
  - **Invariants:** the edge lengths are printed on the edges; the vertex letters are unambiguous.
  - **Concepts:** three-dimensional-case, point-location-space, distance-two-points, position-line-plane-3d.

#### Task 5: A Level statistics and motion

- **prob_distribution** (`graph.bar`; AL)
  - **Draws:** a vertical-line (stick) graph of P(X = x) for x = 0 to 4 (or 1 to 5), with probabilities in multiples of 0.05 on a 0.05 grid. One stick is missing and marked "?".
  - **Asks:**
    - "Find P(X = 3)." (1 − the rest);
    - "Find P(X ≥ 2).";
    - "Find E(X)." (exact to 2 d.p.);
    - "What is the most likely value of X?" (short; there is a single mode).
  - **Invariants:** the probabilities sum to 1, the missing one is from 0.05 to 0.5, and every value is on a gridline.
  - **Concepts:** discrete-random-variables, cumulative-distribution-function.
- **pdf_graph** (`graph.line`; AL)
  - **Draws:** a straight-line probability density function, one of:
    - uniform on [a, b];
    - f(x) = kx on [0, a] (a triangle);
    - a symmetric triangle on [0, 2m].
    The height is marked "k".
  - **Asks:**
    - "Find k." (area 1; the fraction and its terminating decimal);
    - "Find P(X < c)." (exact);
    - "Find E(X)." (by symmetry, or 2a/3);
    - uniform only: "Find the median."
  - **Invariants:** c is inside the support, and every answer is a fraction with a small denominator.
  - **Concepts:** continuous-random-variables, probability-density-function-transformation, calculating-e-gx-continuous.
- **velocity_time** (`graph.line`; UP, AL)
  - **Draws:** a velocity–time graph of three or four straight stages (speeding up, steady, slowing down) of a minibus or a moto, with every corner a grid point. Velocity is in m/s and time in s.
  - **Asks:**
    - "What is the acceleration in the first n seconds?" ("2", "2 m/s²");
    - "What is the deceleration at the end?";
    - "How far does it travel altogether?" (the area, an integer);
    - "What is its greatest speed?".
  - **Invariants:**
    - the areas are integers;
    - the accelerations are integers or halves;
    - the graph starts and ends at v = 0, or the stem says it does not.
  - **Concepts:** acceleration-time, acceleration-displacement, differentiation-kinematics, kinematic-graphs.

#### Task 6: Money (Primary, Lower and Upper Secondary)

- **money** (`business.document`; P)
  - **Draws:** either
    - a shop's price board of 4 to 6 items (mango, bread, soap, a pen, an exercise book, a bottle of water, sugar) with prices in Frw; or
    - a purse of notes and coins drawn as labelled rectangles and circles (coins 10, 20, 50, 100 Frw; notes 500, 1000, 2000, 5000 Frw).
  - **Asks:**
    - "How much do 2 mangoes and 1 bread cost?";
    - "Aline pays with a 1000 Frw note. How much change does she get?";
    - "Which item costs the most?" (MCQ);
    - "How much money is in Keza's purse?";
    - "How much more does she need to buy a book costing 1,500 Frw?".
  - **Invariants:**
    - totals stay within the stage's range (up to 1,000 Frw at Stages 1–2, 5,000 at 3–4, 50,000 at 5–6);
    - the change is never negative;
    - prices are multiples of 50 (10 at Stages 1–2);
    - accepted forms come from `core.money`.
  - **Concepts:** buying-selling-prices, money-earning, simple-budgeting-rwandan-currency, buying-selling-role-play.
- **price_tag** (`business.document`; LS, UP)
  - **Draws:** one of:
    - a sale tag ("Was 12,000 Frw. Now 20% off");
    - a receipt with VAT at 18%;
    - a sales slip with a commission rate;
    - a bank's savings notice (simple interest at LS; compound at UP, with 2 or 3 years).
  - **Asks:**
    - "What is the sale price?";
    - "How much is saved?";
    - "What is the VAT on the receipt?";
    - "How much commission does Eric earn?";
    - "How much interest after 3 years?";
    - UP: "What is the amount after 2 years?" (to the nearest franc; the key is rounded, as the bank notice states).
  - **Invariants:**
    - every answer except the compound amount is a whole number of francs;
    - the percentages are whole numbers.
  - **Concepts:** buying-selling-prices, percentage-change, multipliers-percentage-change, commission, indirect-taxes, interest-rates, borrowing-investing-money, commercial-arithmetic.

#### Task 7: Primary number and proportion; algebra; Pascal

- **bar_model** (`maths.number`; P)
  - **Draws:** a bar model of one kind:
    - part–whole, with two or three parts and one marked "?";
    - comparison, two bars with the difference marked "?";
    - equal parts, the whole split into n equal parts with one marked "?".
  - **Asks:**
    - "Use the bar model to find the missing number." (short);
    - "Which number sentence matches the bar model?" (MCQ: the operation or order wrong);
    - for equal parts, "How many are in each part?".
  - **Invariants:**
    - the parts sum to the whole;
    - the numbers fit the stage (up to 20 at Stage 1, 100 at 2, 1,000 at 3–4, 10,000 at 5–6);
    - the bar lengths are proportional within 10%.
  - **Concepts:** missing-numbers-operations, partitioning-add-subtract, complements-to-ten, subtraction-take-away.
- **scale_drawing** (`maths.measure`; P, LS)
  - **Draws:** a plan of a classroom, a garden or a football pitch on a centimetre grid, with "Scale: 1 cm represents 2 m" (or 5 m, 10 m) or a scale bar.
  - **Asks:**
    - "What is the real length of the garden?";
    - "What is the real width?";
    - LS: "What is the real area?";
    - "A path is 12 m long. How long is it on the plan?".
  - **Invariants:** the plan's lengths are whole centimetres on the grid, and every answer is a whole number.
  - **Concepts:** scale-drawing-concept, scale-drawings-actual-distance, scale-drawings-length.
- **percent_grid** (`maths.number`; P)
  - **Draws:** a 10 × 10 grid with some squares shaded, at Stages 5–6.
  - **Asks:**
    - "What percentage is shaded?" ("37", "37%");
    - "What fraction is shaded? Give it in its lowest terms.";
    - "What decimal is not shaded?";
    - "What is the ratio of shaded to unshaded squares, in its simplest form?".
  - **Invariants:** at least 5 and at most 95 squares are shaded; the lowest-terms fraction is recomputed.
  - **Concepts:** fractions-percentages, ratios-proportions-percentages, working-with-ratio, fractions-decimals.
- **algebra_area** (`maths.geometry`; LS, UP)
  - **Draws:** a rectangle split into two or four parts (an area model), its sides labelled x + 3 and x + 2, 2x and x − 1, and so on.
  - **Asks:**
    - "Which expression gives the perimeter?" (MCQ);
    - "Which expression gives the area?" (MCQ; the expansion, with one term or sign wrong);
    - "When x = 4, what is the area?";
    - UP: "The area is 40 cm². Find x." (an integer root).
  - **Invariants:** every length is positive at the x asked, and the expressions are pairwise distinct when expanded.
  - **Concepts:** algebraic-expressions-constructing, working-with-brackets, simplifying-expressions, algebraic-expressions-substituting-evaluating. Chapters to avoid are decided in Task 8 (the candidates are integration, circular measure, indices and surds).
- **pascal** (`maths.number`; UP)
  - **Draws:** Pascal's triangle, rows 0 to 7, with two or three entries shown as "?".
  - **Asks:**
    - "What number is missing at P?";
    - "Use the triangle: what is the coefficient of x² in (1 + x)⁵?";
    - "What is the sum of the numbers in row 6?";
    - "Which row gives the coefficients of (a + b)⁴?" (MCQ).
  - **Invariants:** the missing entries are recomputed, and never the 1s at the ends.
  - **Concepts:** binomial-theorem, factorial-notation.

---

### Task 8: Link, look, sheet and record

- [ ] **Link report against the real store, read-only.**
  - For each new family, list every topic it reaches by name and level.
  - Remove misfits with `AVOID`. Each removal is a ruling.
  - A declared level reaching fewer than three topics either widens its concepts to those topics' specific P0 concepts or drops the level, also as a ruling.
- [ ] **Look.** Read one PNG of every sub-type and band of every new family, and fix what a student would trip on. Re-run the tests after each fix.
- [ ] **Sheet.**
  - Run `python scripts/figgen/wave_sheet.py --subject mathematics --families <the 20> --label "P3c, the second Maths batch" --per-family 3 --out <scratchpad>/maths-batch-2.html`.
  - Publish it as an artifact for the user.
  - The coverage table shows what the batch adds to the 302 mapped Maths topics.
- [ ] **Record.** Add a P3c result under P3 in the spec: the families, their levels, the coverage change and $0 spent. Update memory. **Commit:** `docs(figure-library): the P3c result`.
- [ ] **Next (P3d, after the user's verdict):**
  - fix what they flag;
  - generate 30 of each new family;
  - run the blind review (about $5 for 20 × 30);
  - triage by sub-type, including rejections inside passing families;
  - approve, draw to volume and approve again;
  - report coverage.
