# Figure Library P3k: The Computing Wave, Samples

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 15 Computing families, ending in a sample sheet. Computing has the most mapped topics with no figure: 397, of which 61 Primary, 63 Lower Secondary, 182 Upper Secondary and 91 A Level. The families cover logic, algorithms, data representation, spreadsheets, databases, networks and data structures, and every answer is computed by running the thing drawn.

**Approval:** the user's standing approval of 2026-10-14 covers this ("keep on going ... i agree and approve whatever yo do till i get back"). The sheet is published, and scaling follows it.

**Why Computing before Geography:** the spec orders the waves Maths, Physics, Chemistry, Biology, Geography, and so on. Computing has 397 empty topics, against Geography's 141, and its figures are pure computation, which drawn figures do best. Ruling, recorded here: coverage first.

**Architecture:** each family is one module in `scripts/figgen/families/`, following P3g and P3i. Each family ships with:
- an answer test over 1,000 seeds that recomputes every key by executing what is drawn: it evaluates the circuit, runs the pseudocode, sorts the list, applies the SQL;
- the shared tests: variety, wording, inside the axes, text overlap, and SVG/PNG.

Computing joins `WORDED_SUBJECTS`. Code is drawn as monospaced text in boxes. Diagrams (gates, flowcharts, trees, networks) are drawn directly with matplotlib.

**Tech Stack:** Python figgen (matplotlib, pytest); the read-only link report; `wave_sheet.py`.

**Spec:** `docs/superpowers/specs/2026-10-10-figure-library-design.md`, section 5.2 and section 9.

## Global Constraints

- **Spend:** $0. Samples only; nothing is written to the store.
- **Exactness:** every key is computed by executing the figure's content, and every value asked for is printed or countable.
- **Code:** Cambridge-style pseudocode (`DECLARE`, `←`, `IF … THEN … ENDIF`, `FOR … TO … NEXT`, `WHILE … ENDWHILE`, `OUTPUT`); Python only where a topic names Python.
- **Case:** the app's marker lowercases answers, so a key never differs from a wrong answer only by case. Binary and hex keys are digits and capitals, and an "a3"/"A3" difference is never the point.
- **MCQs:** an option set never lets the key be picked without the figure (the centrality test, extended to Computing).
- **Questions stand alone:** each names what it asks about.
- **Commits:** local only, on `aws_deploy`. Leave out the three unrelated files, and use the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **A trace that depends on a convention.** Examples: integer division, a loop bound that is inclusive or exclusive, the order of a bubble sort's passes, an IF without an ELSE. Expected: the convention is printed or stated; the test executes it the same way.
2. **A key that differs only by case or by spacing.** Examples: "1010" against "1 010", hex "3F" against "3f". Expected: the forms are accepted; no case-only distinctions.
3. **A circuit or flowchart drawn ambiguously.** Examples: a wire crossing a gate, an arrow with no head, two exits from a process box. Expected: layout tests check crossings and that every arrow is headed.
4. **A storage calculation whose unit convention is unstated.** Examples: 1 KB as 1000 or 1024 bytes, or bits against bytes. Expected: the stem states the convention ("1 KiB = 1024 bytes"), and the key follows it.
5. **Misfit links.** Computing's broad concepts (algorithms, data management) reach many topics. Expected: the link report is read topic by topic.

---

### Task 1: Computing joins the wording test; logic

- **Files:**
  - `scripts/figgen/tests/test_families_common.py` (`WORDED_SUBJECTS` += computing);
  - `scripts/figgen/tests/test_computing_answers.py` (new).
- **logic_gates** (`cs.logic`; UP, AL)
  - **Draws:** a circuit of two to four gates (AND, OR, NOT, NAND, NOR, XOR), with standard symbols, inputs A, B and C, and output X.
  - **Asks:** X for given inputs; the number of input rows that give X = 1; the expression (MCQ of four expressions).
  - **Concepts:** logic-gates, circuits-digital, logic-expressions, boolean-algebra.
- **truth_table** (`cs.logic`; UP, AL)
  - **Draws:** a truth table for a two- or three-input expression, with some output cells blank.
  - **Asks:** a blank cell; which expression the table shows (MCQ); how many rows give 1.
  - **Concepts:** logic-expressions, boolean-algebra, logic-gates.
- **Commit:** `feat(figgen): computing: logic`.

### Task 2: Algorithms

- **flowchart** (`process.flow`; LS, UP)
  - **Draws:** a flowchart with start and stop, input, process, one decision and a loop.
  - **Asks:** the output for an input; how many times the loop runs; the value of a variable at the end.
  - **Concepts:** algorithms, conditional-logic, iteration-control, problem-solving-design.
- **trace_table** (`cs.code`; UP, AL)
  - **Draws:** pseudocode of 5–9 lines with a loop, and its trace table partly filled.
  - **Asks:** a blank cell; the final output; how many times a line runs.
  - **Concepts:** algorithms, variable-assignment, iteration-control, program-testing-running.
- **sort_trace** (`cs.structure`; UP, AL)
  - **Draws:** a list of 6–8 numbers, with bubble or insertion sort named.
  - **Asks:** the list after the first pass; the swaps in that pass; the passes needed.
  - **Concepts:** algorithms, data-structures-introduction.
- **binary_search** (`cs.structure`; UP, AL)
  - **Draws:** a sorted list with its indices, and the item searched for.
  - **Asks:** the first index checked (the midpoint rule is stated); how many items are checked; the order in which they are checked.
  - **Concepts:** algorithms, data-structures-introduction.
- **Commit:** `feat(figgen): computing: algorithms`.

### Task 3: Data representation

- **binary_place** (`cs.structure`; LS, UP)
  - **Draws:** an 8-bit place-value table with a byte filled in.
  - **Asks:** its denary value; its hex; the value after a left shift.
  - **Concepts:** number-systems, data-representation-structure-management.
- **bitmap_image** (`cs.structure`; LS, UP, AL)
  - **Draws:** a black-and-white or 4-colour pixel grid, with its key.
  - **Asks:** the binary code of one row; the file size in bits or bytes (the colour depth is stated); the colours a 2-bit depth allows.
  - **Concepts:** data-representation-structure-management, data-storage-measurement, file-compression.
- **sound_samples** (`graph.line`; UP, AL)
  - **Draws:** a wave with its sample points marked on a grid.
  - **Asks:** the sample value at a time; the sample rate; the file size for a stated bit depth and duration.
  - **Concepts:** data-representation-structure-management, data-storage-measurement.
- **Commit:** `feat(figgen): computing: data representation`.

### Task 4: Spreadsheets, databases and networks

- **spreadsheet_formula** (`table.data`; LS, UP)
  - **Draws:** a grid of 4–6 rows with column letters and row numbers, numbers and text in it, and one formula shown in a cell.
  - **Asks:** the value of a SUM, AVERAGE, MAX, IF or COUNTIF; which cell holds a value.
  - **Concepts:** spreadsheet-functions, complex-formulas-functions, spreadsheet-cells.
- **database_query** (`table.data`; UP, AL)
  - **Draws:** a table of 6–8 records and a SQL `SELECT … FROM … WHERE … ORDER BY` query.
  - **Asks:** how many records the query returns; the first field returned; the primary key (MCQ).
  - **Concepts:** database-queries, sql-data-manipulation-language, database-tables.
- **network_topology** (`cs.structure`; LS, UP)
  - **Draws:** lettered networks: star, bus, ring and mesh.
  - **Asks:** which shows a star (letters); how many cables a mesh of n devices needs; which device's failure stops the whole star.
  - **Concepts:** network-topologies, computer-network-characteristics, lan-hardware.
- **Commit:** `feat(figgen): computing: spreadsheets, databases and networks`.

### Task 5: Data structures and encryption

- **binary_tree** (`cs.structure`; AL)
  - **Draws:** a binary search tree of 7–10 numbers.
  - **Asks:** the in-order, pre-order or post-order traversal; the tree's height; where a new value goes.
  - **Concepts:** data-structures-introduction, algorithms.
- **stack_queue** (`cs.structure`; UP, AL)
  - **Draws:** a stack or queue with its pointer, and a list of operations (PUSH, POP, ENQUEUE, DEQUEUE).
  - **Asks:** the item on top or at the front after them; the item removed by an operation; how many items are left.
  - **Concepts:** data-structures-introduction.
- **caesar_cipher** (`cs.structure`; LS, UP)
  - **Draws:** the alphabet over its shifted alphabet, with the shift stated.
  - **Asks:** a word encrypted; a word decrypted.
  - **Note:** keys are in capitals, and a lowercase answer is the same word, so case cannot decide a mark.
  - **Concepts:** cipher-encryption, computer-security-terms.
- **Commit:** `feat(figgen): computing: data structures and encryption`.

### Task 6: Link, look, review, sheet and record

- [ ] **Link report** for all 15 families, read by topic name. Each AVOID for a misfit is a ruling.
- [ ] **Look** at one PNG of every sub-type.
- [ ] **Fresh review** by an Opus subagent, then one fix pass.
- [ ] **Sheet:** `wave_sheet.py --subject computing --label "P3k, the Computing wave"`, published.
- [ ] **Record** a P3k result in the spec and in memory.
