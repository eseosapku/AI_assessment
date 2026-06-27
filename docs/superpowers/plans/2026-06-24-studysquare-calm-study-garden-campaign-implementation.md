# StudySquare Calm Study Garden Campaign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local mixed marketing campaign pack for StudySquare with serene nature-backed ads, posters, and feature creatives.

**Architecture:** Create a static campaign board in `marketing/studysquare-calm-garden/` and render it to share-ready PNG/PDF assets. Use AI-generated nature plates where available, then compose brand text, product panels, and StudySquare motifs deterministically so copy stays crisp.

**Tech Stack:** HTML, CSS, local image assets, Playwright/Chromium screenshot export, Pencil AI image fills for generated background plates.

## Global Constraints

- Do not commit anything to git.
- Keep all deliverables local inside `marketing/studysquare-calm-garden/`.
- Use "StudySquare" as the platform brand and "StudyLab" as a product feature.
- Use blue sky, green grass, and calm outdoor learning as the campaign visual base.
- Use deterministic layout text, not generated-image typography, for final copy.
- Include social and print-oriented formats in the mixed pack.
- Avoid generic SaaS-blue dashboard visuals, purple AI startup gradients, and stressful exam-room imagery.

---

### Task 1: Campaign Workspace

**Files:**
- Create: `marketing/studysquare-calm-garden/README.md`
- Create: `marketing/studysquare-calm-garden/assets/`
- Create: `marketing/studysquare-calm-garden/exports/`

**Interfaces:**
- Consumes: approved campaign design spec.
- Produces: workspace folders and usage notes for later tasks.

- [ ] **Step 1: Create campaign folders**

Create `marketing/studysquare-calm-garden/assets` and `marketing/studysquare-calm-garden/exports`.

- [ ] **Step 2: Add README**

Write a README explaining what the campaign pack contains, how to preview it, and where exported PNG/PDF files are stored.

- [ ] **Step 3: Verify folder structure**

Run: `Get-ChildItem marketing/studysquare-calm-garden -Recurse`

Expected: README, `assets`, and `exports` exist.

### Task 2: Generated Nature Plates

**Files:**
- Create: `marketing/studysquare-calm-garden/studysquare-calm-garden-backgrounds.pen`
- Export into: `marketing/studysquare-calm-garden/assets/`

**Interfaces:**
- Consumes: image prompt pattern from the design spec.
- Produces: reusable background PNGs for master, feature, exam, and pricing layouts.

- [ ] **Step 1: Create Pencil document**

Create a Pencil document with frames for campaign background plates.

- [ ] **Step 2: Generate AI image fills**

Generate nature plates for these prompts:

```text
Master: bright serene study garden, blue sky, green grass path, floating paper study cards, optimistic education advertising image, no text.
StudyLab: sunny outdoor learning tree made of connected study cards, blue sky, green field, calm academic mood, no text.
Gap Map: peaceful green field with winding path and colored learning markers, blue sky, educational trail map mood, no text.
Teacher: outdoor classroom board in a calm garden, class progress cards, sunny blue sky, green grass, no text.
```

- [ ] **Step 3: Export generated plates**

Export each plate as PNG into `marketing/studysquare-calm-garden/assets/`.

- [ ] **Step 4: Verify exported plates**

Open or screenshot the exported images and check that they are bright, legible, and text-free.

### Task 3: Static Campaign Board

**Files:**
- Create: `marketing/studysquare-calm-garden/index.html`
- Create: `marketing/studysquare-calm-garden/styles.css`

**Interfaces:**
- Consumes: generated plates from Task 2 and existing product screenshots from `docs/motion-ad-assets/`.
- Produces: renderable campaign board with all required creative formats.

- [ ] **Step 1: Build layout data**

Define creative variants:

```js
[
  "master-square",
  "story",
  "linkedin",
  "x-post",
  "x-header",
  "a3-poster",
  "a4-flyer",
  "ai-builder",
  "studylab",
  "gap-map",
  "interactive-study",
  "feedback",
  "teacher-tools",
  "exam-prep",
  "pricing"
]
```

- [ ] **Step 2: Build HTML**

Create one `.creative` section per variant with StudySquare wordmark, campaign headline, supporting copy, CTA, product chips, and feature cards.

- [ ] **Step 3: Build CSS**

Style the campaign with StudySquare colors, large friendly type, nature backgrounds, floating product panels, square motifs, and format-specific dimensions.

- [ ] **Step 4: Verify in browser**

Open `marketing/studysquare-calm-garden/index.html` and check that all sections render without overlap.

### Task 4: Export Assets

**Files:**
- Create: `marketing/studysquare-calm-garden/export-assets.mjs`
- Output: `marketing/studysquare-calm-garden/exports/*.png`
- Output: `marketing/studysquare-calm-garden/exports/*.pdf`

**Interfaces:**
- Consumes: campaign board from Task 3.
- Produces: share-ready raster exports and print PDFs.

- [ ] **Step 1: Write export script**

Use Playwright to open the local HTML file and screenshot each `.creative` node by `data-export-name`.

- [ ] **Step 2: Export PNGs**

Run: `node marketing/studysquare-calm-garden/export-assets.mjs`

Expected: PNG files exist in `exports`.

- [ ] **Step 3: Export print PDFs**

Use browser PDF output for A3 and A4 pages, or export high-resolution PNGs if per-node PDF output is not available.

- [ ] **Step 4: Verify dimensions**

Run an image inspection script to confirm each PNG has the intended pixel dimensions.

### Task 5: Visual QA

**Files:**
- Read: `marketing/studysquare-calm-garden/exports/*.png`
- Modify: `marketing/studysquare-calm-garden/styles.css` if needed.

**Interfaces:**
- Consumes: exported assets.
- Produces: corrected assets if text overlap, weak contrast, or broken image rendering appears.

- [ ] **Step 1: Inspect representative exports**

Inspect at least master square, story, LinkedIn, X header, A3, and two feature posters.

- [ ] **Step 2: Fix any layout issues**

Adjust CSS dimensions, text sizes, panel spacing, or background overlay strength.

- [ ] **Step 3: Re-export**

Run the export script again after fixes.

- [ ] **Step 4: Final verification**

Confirm export files exist, dimensions are correct, and inspected images satisfy the campaign spec.
