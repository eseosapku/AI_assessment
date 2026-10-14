# Figure Library P3m: The Geography Wave, Samples

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 13 Geography families, ending in a sample sheet. Geography has 146 mapped topics (50 Lower Secondary, 96 Upper Secondary), and only 5 have a figure. Its three pilot families (climate_graph, cross_section, population_pyramid) declare no concepts, so they reach almost nothing.

The wave covers:
- map skills: grid references, direction, scale, distance, area, contours, cross-sections;
- weather and climate: climate graphs, weather-station records, wind roses, latitude, longitude and time;
- rivers: storm hydrographs;
- soils and employment: ternary graphs;
- population: pyramids, and the demographic transition;
- development: employment structure.

**Approval:** the user's standing approval of 2026-10-14 covers this ("keep on going ... i agree and approve whatever yo do till i get back"). The sheet is published, and scaling follows it.

**Architecture:**
- **Families:** one module per family in `scripts/figgen/families/`, following P3k.
- **Tests:** each family ships with:
  - an answer test over 1,000 seeds, in `scripts/figgen/tests/test_geography_answers.py`, that recomputes every key from the params;
  - the shared tests: variety, wording, inside the axes, text overlap, SVG/PNG.
- **Links:** each family declares `CONCEPTS` from the store's 191 `geography.*` ids, and a `NEEDS` pattern read against topic sections.
- **Wording test:** Geography joins `WORDED_SUBJECTS` once the three pilot families have named lead sentences.

**Tech Stack:** Python figgen (matplotlib, pytest); the read-only link report (`scratchpad/cs_links.py geography`); `wave_sheet.py`.

**Spec:** `docs/superpowers/specs/2026-10-10-figure-library-design.md`, sections 5.2 and 9.

## Global Constraints

- **Spend:** $0. Samples only; nothing is written to the store.
- **Exactness:** every key is computed from the figure's params. Every value asked is printed, countable or read on a gridline.
- **Rwandan context:** use Rwandan places and data where real data is the point:
  - climate stations Kigali, Musanze, Huye, Rubavu, Nyagatare, with two rainy seasons (March–May, September–December);
  - districts, crops and rivers (Nyabarongo, Akagera).
  - Invented maps carry invented names. A real place is never drawn wrongly as if it were accurate.
- **No knowledge-only questions:** a question that a student answers from memory, without the figure, is not asked. Population pyramids are not asked "which shape": P3b found the shapes disputed.
- **Conventions stated:**
  - six-figure grid references (eastings first);
  - the map scale (1:50 000, so a 2 cm grid square is 1 km);
  - the contour interval;
  - bearings measured clockwise from north;
  - 15° of longitude = 1 hour.
- **Commits:** local only, on `aws_deploy`. Leave out the three unrelated files, and use the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **A grid reference read the other way round.** Northings given first, or a six-figure reference whose third digit is the tenth in the wrong square. Expected: the stem says "eastings first", and the key and test follow it.
2. **A reading between gridlines.** A rainfall bar, a hydrograph peak or a pyramid bar that ends between lines. Expected: every value asked sits on a gridline, or the question carries a stated tolerance.
3. **A Rwandan climate graph that misleads.** One rainy season, or rains in July. Expected: the data keeps Rwanda's two rainy seasons and its dry June–August.
4. **Time-zone direction.** East is ahead of west. Expected: the key adds hours going east, and the test does the same.
5. **Ternary graph reading direction.** Each axis is read along its own gridlines. Expected: the three percentages sum to 100, and the drawn point sits on gridline crossings.

---

### Task 1: Geography joins the wording test; the pilot families reworked

- **Files:**
  - `scripts/figgen/tests/test_families_common.py` (`WORDED_SUBJECTS` += geography);
  - `scripts/figgen/tests/test_geography_answers.py` (new);
  - `climate_graph.py`, `cross_section.py`, `population_pyramid.py`.
- **climate_graph** (`geo.climate`; LS, UP)
  - **Draws:** a climate graph for a named station. Rainfall bars sit on 10 mm gridlines and the temperature line on 1 °C gridlines. Rwandan stations follow the two rainy seasons.
  - **Asks:** the wettest month (MCQ of months); the rainfall in a month; the annual temperature range; the total rainfall of a season (sum of stated months).
  - **Concepts:** weather-elements, temperature, humidity-precipitation, climate-zones, equatorial-climate, climate-factors.
- **cross_section** (`geo.section`; LS, UP)
  - **Draws:** as now.
  - **Asks:** a named lead on each question; at UP, adds the vertical exaggeration from the stated scales.
  - **Concepts:** cross-sections-sketch-maps, topographic-maps, relief-landforms.
- **population_pyramid** (`geo.population`; LS, UP)
  - **Asks:** the shape MCQ is dropped. Asks the percentage of a sex and age group; the percentage aged 0–14; whether there are more males or females aged 60 and over (from the bars); the dependent percentage (0–14 plus 60+).
  - **Concepts:** population-structure, population-growth.
- **Commit:** `feat(figgen): geography: the pilot families reworked`.

### Task 2: Map skills

- **grid_reference** (`geo.map`; LS, UP)
  - **Draws:** a 1:50 000 grid of 5 × 5 squares with numbered eastings and northings. Symbols are placed with a key: church, school, health centre, market, bridge, spot height.
  - **Asks:** the four-figure reference of a symbol's square; the six-figure reference of a symbol at a gridline tenth; the 8-point compass direction from one symbol to another.
- **map_distance** (`geo.map`; LS, UP)
  - **Draws:** the same grid with a scale bar, a straight road between two symbols along a gridline or a 3-4-5 diagonal, and a shaded forest of whole squares.
  - **Asks:** the road's length in km; the forest's area in km²; the length a 4 cm line on the map stands for.
- **contour_map** (`geo.map`; LS, UP)
  - **Draws:** contour lines with heights at a stated interval round one or two hills, spot heights, and points A, B and C.
  - **Asks:** the contour interval; the height of a point on a contour; which side of the hill is steeper (the closer contours, MCQ); the gradient from A to B as 1 in n (rise and run printed or countable).
- **Concepts** for all three: map-reading-and-interpretation, topographic-maps, map-skills-measurement, cross-sections-sketch-maps.
- **Commit:** `feat(figgen): geography: map skills`.

### Task 3: Weather and climate

- **weather_station** (`geo.climate`; LS, UP)
  - **Draws:** a week's readings at a school weather station: rain-gauge millimetres as bars on gridlines, and maximum and minimum temperatures.
  - **Asks:** the week's total rainfall; the mean maximum; the day with the greatest daily temperature range.
  - **Concepts:** weather-data-collection, weather-elements, humidity-precipitation, temperature.
- **wind_rose** (`geo.climate`; LS, UP)
  - **Draws:** a wind rose of 30 or 31 days, with a bar length for the days the wind blew from each of 8 directions, on 1-day rings, and calm days in the centre.
  - **Asks:** the prevailing wind; the days from a direction; the calm days.
  - **Concepts:** winds, weather-data-collection.
- **lat_long** (`geo.globe`; LS, UP)
  - **Draws:** a latitude–longitude grid at 15° spacing, with labelled points.
  - **Asks:** a point's latitude and longitude; the local time at a point when it is noon at another (15° = 1 hour, east ahead); the difference in latitude between two points.
  - **Concepts:** earth-movements, earth-universe, cartographic-projections.
- **Commit:** `feat(figgen): geography: weather and the globe`.

### Task 4: Rivers, soils, population and development

- **hydrograph** (`graph.line`; UP)
  - **Draws:** a storm hydrograph. Rainfall bars and the discharge line are on gridlines, and the peaks fall on whole hours.
  - **Asks:** the lag time (peak rain to peak discharge); the peak discharge; the rise in discharge from base flow.
  - **Concepts:** river-system, flooding, drainage-systems, river-processes.
- **ternary_graph** (`graph.ternary`; UP)
  - **Draws:** a triangular graph with 10% gridlines and lettered points, in one of two contexts:
    - soil texture: sand, silt, clay;
    - employment structure: primary, secondary, tertiary.
  - **Asks:** one percentage of a point; the third percentage given two; which point has the most of one component.
  - **Concepts:** per figure (`concepts_for`): soil-properties and soil-classification, or development-indicators.
- **dtm** (`graph.line`; UP)
  - **Draws:** the demographic transition model. Birth-rate and death-rate curves are on gridlines, and stages 1–5 are marked.
  - **Asks:** the birth rate at a stage boundary; the stage where the gap (natural increase) is largest; the natural increase at a marked time.
  - **Concepts:** population-growth, population-structure.
- **employment_structure** (`table.data`; UP)
  - **Draws:** divided bars for 3–4 named countries, each split into primary, secondary and tertiary percentages on 10% gridlines.
  - **Asks:** a country's tertiary percentage; the missing percentage; which country has the largest primary sector.
  - **Concepts:** development-indicators, industry-definition.
- **Commit:** `feat(figgen): geography: rivers, soils, population and development`.

### Task 5: Link, look, review, sheet and record

- [ ] **Link report** for all 13 families, read by topic name and section. Each AVOID for a misfit is a ruling.
- [ ] **Look** at one PNG of every sub-type.
- [ ] **Probe `agrees`** offline on the new answer shapes: grid references, "N 6° S", times, directions. Fix misses by TDD.
- [ ] **Fresh review** by an Opus subagent, then one fix pass.
- [ ] **Sheet:** `wave_sheet.py --subject geography --label "P3m, the Geography wave"`, published.
- [ ] **Record** a P3m result in the spec and in memory.
