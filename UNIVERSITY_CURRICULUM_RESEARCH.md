# University Curriculum Research Basis (Pilot)

Date: 2026-04-27
Scope: Five-course university rollout for AI quiz generation

## Goal
Build a standards-informed university curriculum layer that is stronger than a topic list.
The model should support:
- Course-level competency domains
- Year-level progression in difficulty and complexity
- Better assessment patterns for AI-generated MCQ and long-form items

## Courses in This Week's Rollout
1. Medicine
2. Nursing
3. Pharmacy
4. Computer Science
5. Business Administration

## Sources Reviewed

### Medicine
- WFME Basic Medical Education standards
  - https://wfme.org/standards/bme/
  - Key signal used: principles-based quality framework; curriculum, assessment, quality assurance, governance themes.
- GMC Outcomes for Graduates
  - https://www.gmc-uk.org/education/standards-guidance-and-curricula/standards-and-outcomes/outcomes-for-graduates
  - Key signal used: knowledge, skills, and behaviours expected for new graduates, with practical safety readiness.

### Nursing
- NMC Standards of proficiency for registered nurses
  - https://www.nmc.org.uk/standards/standards-for-nurses/standards-of-proficiency-for-registered-nurses/
  - Key signal used: seven competency platforms (accountability, health promotion, assessing/planning, providing/evaluating care, leadership/teamwork, safety/quality, care coordination).
- WHO nursing and midwifery fact sheet and strategic directions references
  - https://www.who.int/news-room/fact-sheets/detail/nursing-and-midwifery
  - Key signal used: education, leadership, service delivery and quality-system alignment.

### Computer Science
- ACM Curricula Recommendations (CC2020/CS2023 ecosystem)
  - https://www.acm.org/education/curricula-recommendations
  - Key signal used: competency-oriented structure across algorithms, systems, software engineering, and evolving disciplines.

### Business Administration
- AACSB accreditation standards page
  - https://www.aacsb.edu/accreditation/standards
  - Key signal used: mission focus, learner success, outcomes-based quality, societal impact.
- CGMA Competency Framework
  - https://www.aicpa-cima.com/resources/article/cgma-competency-framework
  - Key signal used: five competency areas (technical, business, people, leadership, digital).

### Pharmacy
- Direct extraction from FIP/ACPE/AACP pages was limited by source-page parsing constraints in tooling.
- Interim modeling approach used internationally common pharmacy education pillars:
  - pharmaceutical sciences
  - clinical therapeutics
  - medication safety/pharmacovigilance
  - patient counseling
  - evidence-based medication decision-making

## What Was Changed in Code

### 1) Added a dedicated university curriculum module
- File: lib/university-curriculum.ts
- Added:
  - Year 1 to Year 6 progression
  - Course topic sets for all five courses
  - Standards reference metadata
  - Course pedagogy profiles (competency domains, assessment patterns, generation guidance)
  - Year progression guidance
  - Rich curriculum context output for AI prompt conditioning

### 2) Added university curriculum option to selector metadata
- File: lib/rwanda-curriculum.ts
- Added `university` entry in AVAILABLE_CURRICULA.

### 3) Integrated university flow in assessment form
- File: components/FlowForm.tsx
- Added support for:
  - University Year 1 to Year 6 selection
  - Subject and topic retrieval from university curriculum
  - Correct labels and summary rendering in the form

### 4) Improved generation API behavior for university mode
- File: app/api/generate-assessment/route.ts
- Added university curriculum context into prompt building.
- Prevented University Year 1 to 6 from being interpreted as school Grade 1 to 6 by using a university-safe grade normalization for prompt difficulty logic.

## Pedagogical Design Decisions
- Shift from content-only to competency + scenario framing.
- Use year progression model:
  - Y1 to Y2: foundational to applied core
  - Y3 to Y4: integrated and advanced application
  - Y5 to Y6: professional consolidation and transition-to-practice
- Encourage case-driven long-form questions where appropriate.

## Known Limitations
- Country-specific Sudan university curriculum mappings are not yet encoded.
- Pharmacy framework references are currently modeled from global patterns due fetch/extraction limitations from some standards sites.
- No per-institution custom module ingestion yet.

## Next Recommended Upgrade
1. Add institution profile presets (e.g., Sudan MBBS track, nursing school track) as JSON configs.
2. Add curriculum versioning by institution/year.
3. Add blueprint constraints per course (domain coverage %, vignette %, calculation %, professionalism %).
4. Add per-course benchmark test set to score generation quality before release.
