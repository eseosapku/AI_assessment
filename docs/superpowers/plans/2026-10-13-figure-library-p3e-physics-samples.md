# Figure Library P3e: The Physics Wave's Families and Sample Sheet

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Physics drawn families reach the 195 mapped Physics topics, which today have one figure among them. The families cover mechanics, electricity, magnetism, heat, waves and light, and atomic physics. They are shown to the user on a sample sheet before anything is generated at scale.

**Architecture:**
- **Same machinery as the Maths waves (P3a–P3d).** Each family is a module in `scripts/figgen/families/`. It declares `SUBJECT = "physics"`, `CONCEPTS` (P0 physics concepts), `BANDS` (LS, UP, AL) and, where needed, `AVOID` or `avoid_for(p)`. It links through `link.py`.
- **Units.** `core.measure(v, unit)` gives every fair form of a quantity: "6 Ω", "6Ω", "6 ohms"; "2.5 N"; "1,200 J". Physics answers carry units more than Maths answers did.
- **The sample sheet** is `wave_sheet.py --subject physics`, labelled "P3e, the Physics wave".
- **Generation and the blind review wait for the user's verdict** (P3f).

**Tech Stack:** Python 3.12, matplotlib, pytest (`python -m pytest scripts/figgen -q -p no:cacheprovider`), sqlite3 (read-only here).

**Spec:** `docs/superpowers/specs/2026-10-10-figure-library-design.md`. The relevant parts are section 3 (success criteria), 5.2 (drawn figures) and 9 (P3: "in waves by subject: Maths, Physics, … Each wave starts with samples for the user").

## Global Constraints

- **Cost and store.**
  - No model spend.
  - No writes to the staging store: the linker and sheet open it read-only.
  - No production database access.
- **Answers.**
  - Every answer is computed by the code that drew the figure, and recomputed independently in `test_physics_answers.py` over 1,000 seeds.
  - MCQs have exactly one correct option, never two equivalent, and no option set lets the key be picked without the figure (the P3c and P3d lesson). Option sets vary two features, 2 × 2.
  - Short answers accept every fair form, through `core.short`, `core.money` and the new `core.measure`: with and without the unit and the space; unit words ("ohms", "newtons"); thousands with a comma or a space; and the exact decimal or fraction.
  - Every key is exact. A reading is always on a gridline, a scale mark or a printed label. No tolerances are planned.
  - Constants are stated in the stem where a question needs them: "Take g = 10 N/kg", and the density of water.
- **Readable.**
  - Everything drawn lies inside the axes (the shared test).
  - No text overlaps, and every letter sits by what it names.
  - Arrows for forces, rays and currents show their heads.
- **Level and context.**
  - Lower Secondary uses whole numbers and one-step formulae. Upper Secondary and A Level may use rearranged and two-step formulae.
  - SI units throughout.
  - Contexts are ones learners in Rwanda know: a moto, a minibus, a bicycle, a solar panel on a roof, a charcoal stove, a phone charger, a radio, a hydroelectric dam (never with invented figures for a real one), maize and bananas on a market scale.
  - Names come from `core.NAMES`.
- **Variety:**
  - 40 different figures in 60 seeds, ignoring the name, unless a family sets `MIN_VARIETY`.
  - Story details (who and where) are chosen in `questions()`, never stored in the figure's parameters, so de-duplication sees only what is drawn.
- **Wording:** 27 of 30 figures carry a stem no other has. `test_families_common.WORDED_SUBJECTS` gains "physics".
- **Commits:** local on `aws_deploy`, the three unrelated files left out, with the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **A value read between gridlines or scale marks.** Examples: a needle between divisions, a ray crossing a gridline off a lattice point, an image formed between grid points. Expected: every value asked for lies on a mark; pinned per family.
2. **An MCQ answerable without the figure.** Examples: a direction question with one odd-one-out option, or a component question where the key is "the middle" option. Expected: 2 × 2 option sets, and the P3c centrality test extended to the Physics MCQs.
3. **A unit form marked wrong:** "6 ohms", "6Ω", "2.5N", "1 200 J". Expected: accepted, through `core.measure`; pinned.
4. **A family linked into chapters it does not suit.** Examples: a circuit in "Electric fields", or a heating curve in "Climate change". Expected: the link report names every topic each family reaches, and `AVOID` removes misfits before the sheet.
5. **Physics that is wrong in a way the arithmetic test cannot see.** Examples: a force arrow pointing against the stated direction, a ray bending away from the normal on entering glass, a lens image on the wrong side, or Fleming's rule reversed. Expected: each family's answer test checks the physics itself (Snell's law on the drawn angles; F = IL × B by cross product), not only the numbers.

## File Structure

- `scripts/figgen/core.py` (modify): `measure(v, unit)`.
- `scripts/figgen/families/*.py`: 19 new Physics modules, registered in `families/__init__.py`.
- `scripts/figgen/tests/test_physics_answers.py` (new): one answer test per family, plus that family's physics checks.
- `scripts/figgen/tests/test_families_common.py` (modify): `WORDED_SUBJECTS` gains "physics".

---

### Task 1: Groundwork

- [ ] **Failing tests:**
  - `test_core.py::test_a_measure_is_accepted_in_every_fair_form`: `measure(6, "Ω")` ⊇ {"6", "6 Ω", "6Ω", "6 ohms", "6 ohm"}; `measure(2.5, "N")` ⊇ {"2.5", "2.5 N", "2.5N", "2.5 newtons"}; `measure(1200, "J")` ⊇ {"1200 J", "1,200 J", "1 200 J"}.
  - `WORDED_SUBJECTS` gains "physics", so every Physics family must pass the wording test.
- [ ] **Implement** `measure`: the number's forms (thousands separators; decimals via `short`), each with the unit and without the space, plus unit words: Ω → ohm/ohms; N → newton/newtons; J → joule/joules; W → watt/watts; V → volt/volts; A → amp/amps/ampere/amperes; Hz → hertz; Pa → pascal/pascals; s → seconds; m → metres; °C → degrees.
- [ ] **Commit:** `feat(figgen): every fair form of a measure; physics joins the wording test`.

### Tasks 2–7: The families

**Every family:**
- Declares `ID`, `KIND`, `SUBJECT = "physics"`, `BANDS`, `CONCEPTS`, and `AVOID` where needed. It has `sample(rng)`, `draw(p)` and `questions(p, rng)`.
- Is registered in `families/__init__.py`, and passes every shared test.
- **Order per family:**
  1. Write the answer test with its physics checks, and see it fail.
  2. Write the module.
  3. Get the tests green.
  4. Look at one figure of every sub-type, and fix what a student would trip on.
- **One commit per task:** `feat(figgen): physics wave: <group>`.

#### Task 2: Motion and forces

- **motion_graph** (`graph.line`; LS, UP, AL)
  - **Draws:** a distance–time graph (stopped, steady, faster) or a speed–time graph (speeding up, steady, slowing down) of a moto, minibus, bicycle or runner. Every corner is on a gridline.
  - **Asks:**
    - the speed on a stage;
    - when it was stopped;
    - the acceleration;
    - the distance travelled (the area);
    - the average speed for the whole journey.
  - **Checks:**
    - speeds and accelerations are whole numbers or halves;
    - the average speed is total distance over total time.
  - **Concepts:** speed, velocity, acceleration, distance-time-graphs.
- **force_diagram** (`physics.force`; LS, UP)
  - **Draws:** a box or a cart with two to four labelled force arrows (N) along one line, or at right angles at UP.
  - **Asks:**
    - the resultant force and its direction (MCQ of direction × size);
    - "The mass is 4 kg. What is its acceleration?";
    - the weight from the mass ("Take g = 10 N/kg");
    - "Is it in equilibrium?" (MCQ).
  - **Checks:**
    - the resultant is the vector sum of the arrows as drawn;
    - perpendicular forces form Pythagorean triples.
  - **Concepts:** forces, force-mass-and-acceleration, newtons-laws-of-motion, scalars-and-vectors, mass-weight-and-gravity, friction.
- **moments** (`physics.force`; LS, UP, AL)
  - **Draws:** a uniform beam on a pivot with loads at marked distances, one unknown.
  - **Asks:**
    - the unknown load or distance for balance;
    - the moment of a load;
    - at UP and AL, the support force.
  - **Checks:**
    - clockwise moments equal anticlockwise moments;
    - every distance lies on a marked division.
  - **Concepts:** moments-and-turning-effects, stability-and-equilibrium, centre-of-mass-and-gravity, simple-machines.
- **spring_graph** (`graph.line`; LS, UP)
  - **Draws:** a force–extension graph, straight to the limit of proportionality and then curving.
  - **Asks:**
    - the spring constant;
    - the extension for a force within the limit;
    - the limit of proportionality;
    - at UP, the energy stored (the area of the triangle).
  - **Checks:**
    - k is a whole number of N/cm or N/m;
    - every reading is on a gridline.
  - **Concepts:** hookes-law, forces.

#### Task 3: Matter and energy

- **pressure** (`physics.force`; LS, UP)
  - **Draws:** one of:
    - a U-tube manometer with the height difference on a cm scale;
    - a block resting on one of its faces, with the face's sides labelled.
  - **Asks:**
    - the height difference;
    - the pressure difference ρgh ("Take g = 10 N/kg, density of water 1000 kg/m³");
    - the pressure on the face, F/A, and which face gives the most pressure (MCQ).
  - **Checks:** the pressure is recomputed from the drawn values.
  - **Concepts:** pressure, atmospheric-pressure, manometer-pressure-measurement, pascals-principle.
- **density_displacement** (`instrument.reading`; LS, UP)
  - **Draws:** a measuring cylinder before and after a stone is lowered in, and a balance reading.
  - **Asks:**
    - the volume of the stone;
    - its density (g/cm³);
    - "Will it float in water?" (MCQ).
  - **Checks:** each level lies on a marked division, and the density is exact to 2 decimal places.
  - **Concepts:** density, measurement-of-length-and-volume, floating-and-buoyancy.
- **energy_sankey** (`process.flow`; LS, UP)
  - **Draws:** a Sankey diagram for a device (solar panel, charcoal stove, filament lamp, LED lamp, kettle, motor, radio) with the input and the useful and wasted outputs in J, arrow widths to scale, one value missing.
  - **Asks:**
    - the missing energy;
    - the efficiency (%);
    - the useful energy store (MCQ);
    - at UP, the power, given the time.
  - **Checks:** the energy is conserved, and the efficiency is a whole number %.
  - **Concepts:** energy-conversions-and-transfers, conservation-of-energy, energy, power, energy-resources.

#### Task 4: Electricity

- **circuit** (`physics.circuit`; LS, UP, AL)
  - **Draws:** a cell or battery (V) with two or three resistors in series, in parallel, or in series with a parallel pair, and an ammeter and a voltmeter, in standard symbols.
  - **Asks:**
    - the total resistance;
    - the ammeter reading;
    - the voltmeter reading;
    - the power in a resistor;
    - at AL, a current found by Kirchhoff's laws.
  - **Checks:**
    - V = IR holds round every loop;
    - the currents at a junction sum to zero;
    - the values are exact (resistances chosen so currents are simple).
  - **Concepts:** electric-current, potential-difference, electrical-resistance, ohms-law, resistors-in-circuits, circuit-symbols-and-diagrams, electrical-energy-and-power, kirchhoffs-laws.
- **meter_dial** (`instrument.reading`; LS, UP)
  - **Draws:** an analogue ammeter, voltmeter or newton meter dial, with the needle on a division.
  - **Asks:**
    - the reading;
    - the size of one small division;
    - the difference between two readings.
  - **Checks:** the needle is on a division.
  - **Concepts:** measurement-precision-and-uncertainty, measurement-instrumentation-procedures, electric-current, potential-difference.
- **iv_graph** (`graph.line`; UP, AL)
  - **Draws:** I–V characteristics: a resistor (straight), a filament lamp (curve) and a diode.
  - **Asks:**
    - the resistance at a marked point;
    - which component it is (MCQ);
    - "Does it obey Ohm's law?" (MCQ).
  - **Checks:** the resistance is V/I at a lattice point.
  - **Concepts:** ohms-law, electrical-resistance, basic-electronic-components.

#### Task 5: Magnetism

- **motor_rule** (`physics.field`; UP)
  - **Draws:** a wire between N and S poles, with the current shown by an arrow or by ⊙ and ⊗; or, as a generator, the wire moved through the field.
  - **Asks:**
    - the direction of the force (MCQ: up, down, left, right, into, out of the page);
    - the direction of the induced current;
    - what makes the force bigger (MCQ).
  - **Checks:** F = IL × B and the induced emf by v × B, computed as cross products. The options are 2 × 2 balanced.
  - **Concepts:** force-on-current-carrying-conductor, magnetic-fields, electric-motors, electromagnetic-induction, generators.
- **transformer** (`physics.circuit`; UP, AL)
  - **Draws:** a transformer with primary and secondary turns and voltages, one missing.
  - **Asks:**
    - the missing voltage or number of turns;
    - "step-up or step-down?" (MCQ);
    - at AL, the current in the secondary for an ideal transformer.
  - **Checks:** Vs/Vp = Ns/Np exactly.
  - **Concepts:** transformers, electromagnetic-induction, alternating-current.

#### Task 6: Heat, waves and light

- **heating_curve** (`graph.line`; LS, UP)
  - **Draws:** the temperature–time graph of ice warmed through melting and boiling, or wax cooling, with the plateaus on gridlines.
  - **Asks:**
    - the melting or boiling point;
    - how long it took to melt;
    - the state during a stage (MCQ);
    - at UP, the energy supplied (power × time) and the specific heat capacity.
  - **Checks:** the plateaus lie at the stated temperatures, and the energies are exact.
  - **Concepts:** changes-of-state, heat-and-temperature, internal-energy, heat-capacity-and-specific-heat, states-of-matter.
- **wave_graph** (`physics.wave`; LS, UP, AL)
  - **Draws:** a transverse wave as displacement against distance, or against time, on a grid.
  - **Asks:**
    - the amplitude;
    - the wavelength or period;
    - the frequency;
    - the wave speed (v = fλ, with the other quantity given).
  - **Checks:** the peaks and crossings lie on gridlines.
  - **Concepts:** wave-properties, waves, sound, simple-harmonic-motion.
- **ray_optics** (`physics.ray`; LS, UP)
  - **Draws:** a ray reflected by a plane mirror, or refracted into glass, with the normal dashed and the angles marked.
  - **Asks:**
    - the angle of reflection;
    - the angle between the ray and the mirror;
    - the refractive index n = sin i / sin r (to 2 d.p.);
    - "Which way does the ray bend?" (MCQ).
  - **Checks:**
    - the drawing obeys the law of reflection and Snell's law;
    - a ray entering glass bends towards the normal.
  - **Concepts:** reflection-of-waves, plane-mirrors, refraction-of-waves, light-and-optics.
- **lens_diagram** (`physics.ray`; UP, AL)
  - **Draws:** a converging lens on a grid with both principal foci marked and an object arrow, plus its two construction rays and the image.
  - **Asks:**
    - the image distance;
    - the image height;
    - the magnification;
    - "real or virtual, upright or inverted?" (MCQ, 2 × 2).
  - **Checks:**
    - 1/f = 1/u + 1/v gives the image's position;
    - the image tip lies on a lattice point.
  - **Concepts:** lens-formula-and-ray-diagrams, lenses, thin-lenses, optical-instruments.
- **em_spectrum** (`physics.wave`; LS, UP)
  - **Draws:** the electromagnetic spectrum as a band of seven regions with one region blank, and an arrow for increasing frequency or wavelength.
  - **Asks:**
    - the missing region (MCQ);
    - which region has the longest wavelength (MCQ);
    - a use or danger (MCQ).
  - **Checks:** the order is right in both directions of the arrow.
  - **Concepts:** electromagnetic-spectrum, light-and-optics.

#### Task 7: Atomic physics

- **decay_graph** (`graph.line`; UP, AL)
  - **Draws:** a sample's activity (Bq) or count rate against time, with the half-life on the grid.
  - **Asks:**
    - the half-life;
    - the activity after n half-lives;
    - the time to fall to a stated activity.
  - **Checks:** the activity is A₀/2ⁿ at whole half-lives, on gridlines.
  - **Concepts:** radioactivity, radioactive-decay, decay-constant-and-half-life.
- **nucleus** (`chem.particle`; LS, UP)
  - **Draws:** a nucleus of protons and neutrons (two shadings, counted) with its electrons in shells.
  - **Asks:**
    - the proton (atomic) number;
    - the nucleon (mass) number;
    - the symbol form (MCQ of ᴬ_Z X notation);
    - the nucleus after alpha or beta decay (MCQ, 2 × 2 of A and Z).
  - **Checks:** the counts are recomputed, and decays conserve A and Z.
  - **Concepts:** atomic-structure, nuclear-structure, nuclear-atom, radioactivity.

---

### Task 8: Link, look, sheet and record

- [ ] **Link report** against the real store, read-only. List every topic each family reaches by name and level. Remove misfits with `AVOID`, each as a ruling. A level reaching fewer than three topics is widened, or kept by ruling, as in P3c.
- [ ] **Look.** Read one PNG of every sub-type and band, and fix what a student would trip on.
- [ ] **Fresh review.** Commission a whole-batch final review before the sheet (the P3c lesson: the review caught giveaways and fair forms before money was spent).
- [ ] **Sheet.** Run `python scripts/figgen/wave_sheet.py --subject physics --label "P3e, the Physics wave" --per-family 3 --out <scratchpad>/physics-wave.html`, then publish it for the user.
- [ ] **Record.** Add a P3e result under P3 in the spec and update memory. Commit.
- [ ] **Next (P3f, after the user's verdict):** fix what the user flags, draw 30 of each family, run the blind review, triage by sub-type, approve, draw to volume and approve again, and report coverage.
