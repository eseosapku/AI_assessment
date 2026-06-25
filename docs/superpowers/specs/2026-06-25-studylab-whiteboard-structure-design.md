# StudyLab Whiteboard Structure — Design

**Date:** 2026-06-25
**Status:** Approved for planning
**Area:** StudyLab LearnSpace canvas + tutor

## 1. Problem

The tutor uses the whiteboard with no spatial strategy. Observed in real use:

- Cards spawn in grid slots by creation order; **related cards end up far apart** and edges span the whole canvas with no proximity.
- The tutor is **blind to the board** — the prompt sends only card ids (`s1-intro`), not titles — so it **re-creates cards that already exist** (e.g. two "Properties of a BST" cards) and the suggestion chips push duplicates ("Show me the properties" after properties are shown).
- A **mermaid card rendered its raw ```` ```mermaid ```` source** as text instead of a diagram.
- There's **no way to interact with a card** to steer the lesson.

## 2. Goals

- The lesson map self-organizes into a tidy connected graph (short edges, real proximity).
- The tutor builds on what's already on the board instead of duplicating it.
- Tapping a card surfaces contextual follow-ups that keep the session on track.
- Mermaid diagrams render.

## 3. Decisions (from brainstorming)

- **Layout:** auto-layout the AI lesson graph (dagre); the tutor stops choosing positions.
- **Layout cadence:** auto-tidy the AI lesson cards every turn; **freeform blocks are never moved**.
- **Tap-a-node:** a popover beside the card with contextual actions.
- One new dependency: `@dagrejs/dagre`.

## 4. Design

### 4.1 Auto-layout engine

New module `lib/studylab/layout.ts` (pure — dagre is plain JS, no React/DOM, unit-testable in Node):

```ts
export function layoutGraph(
  nodes: StudyNode[],
  edges: StudyEdge[]
): Record<string, { x: number; y: number }>
```

- **Included:** visible, non-freeform nodes — AI content cards (concept/code/diagram/mermaid/worked/table/callout), `stepGroup`, `checkpointHeader`, `quiz`. **Excluded:** freeform nodes (`source === 'freeform'` or `isFreeform(type)`), hidden nodes, user edges (`u-` prefix).
- Build a dagre graph: `rankdir: 'TB'`, `nodesep: 60`, `ranksep: 110`; each node sized from `blockSize(type)`. Add the included `connect`/checkpoint edges between included nodes. Run `dagre.layout()`; convert dagre's centre coords to top-left; return `{ id: {x,y} }` for included nodes only.
- Deterministic (dagre is), so the board does not jitter between turns. Disconnected components are stacked by dagre.

New helper to apply it (Workspace): after a tutor turn produces `nextCanvas`, compute `layoutGraph(nextCanvas.nodes, nextCanvas.edges)` and rewrite the position of every included node; leave all other nodes' positions untouched. Then fit the view to the newly-created cards.

### 4.2 Tutor board-awareness + dedup

- **Prompt input:** Workspace sends, instead of `card_ids: string[]`, a `cards: { id: string; title: string; step: number }[]` array (AI cards only, via a small extension of `aiCardIds`). The tutor route renders these as `EXISTING CARDS:\n<id> "<title>" (step N)` so the model sees what exists and connects to existing ids rather than duplicating.
- **Deterministic dedup:** `applyActions` drops a `createCard` whose normalized title (`trim().toLowerCase()`) equals an existing visible AI card's title. Add a pure helper `titleExists(nodes, title)` (TDD).
- **Prompt cleanup:** remove position guidance (the client lays out); instruct the model to send **raw mermaid syntax with no code fences**; keep the "no re-teaching / build on existing cards" rules and reference the new EXISTING CARDS list.

### 4.3 Tap-a-node popover

- `StudyCanvas` `onNodeClick`: if the node is an AI lesson card (concept/code/diagram/mermaid/worked/table/callout), open a popover anchored at the click position (screen coords) with actions templated off `node.data.title`:
  - "Explain this deeper", "Show an example of this", "Quiz me on this", "Why does this matter?"
- Clicking an action calls a new prop `onCardPrompt(text)` → Workspace `handleSend(text)`, with text like `Focusing on the card "<title>": <action>.` Then closes. Closes on outside-click / Escape.
- Quiz/checkpoint nodes and freeform nodes do not open it (freeform has its own header controls; quiz nodes are interactive already).

### 4.4 Mermaid render fix

In `MermaidNode`, sanitize the source before `mermaid.render`: strip a leading ```` ```mermaid ```` or ```` ``` ```` fence and trailing ```` ``` ````, and a stray leading `mermaid` line; trim. Prompt change in 4.2 also stops the model emitting fences.

## 5. Files

- `lib/studylab/layout.ts` (new) — dagre layout.
- `lib/studylab/layout.test.ts` (new) — layout + dedup-helper tests.
- `lib/studylab/actions.ts` — `titleExists` dedup guard in `createCard`; export it.
- `lib/studylab/freeform.ts` — add `aiCards(nodes): {id,title,step}[]` (titles for the prompt) alongside `aiCardIds`.
- `components/studylab/Workspace.tsx` — run layout after each turn; send `cards` to the tutor; `onCardPrompt` → `handleSend`.
- `components/studylab/StudyCanvas.tsx` — `onNodeClick` popover; pass `onCardPrompt`.
- `components/studylab/MermaidNode.tsx` — fence sanitize.
- `app/api/studylab/tutor/route.ts` — render EXISTING CARDS; drop position guidance; no-fences instruction.
- `package.json` — add `@dagrejs/dagre`.

## 6. Risks / notes

- **Layout uses block-size estimates, not measured heights.** dagre arranges by rank, so exact heights matter little; acceptable for v1. A measured-size refinement is a later option.
- **Re-tidy every turn moves AI cards** the user may have nudged — accepted per the brainstorming decision (freeform is what users arrange; AI cards are the tutor's to keep tidy).
- **Dagre is deterministic** but adding/removing nodes can shift the whole tree; the gentle fit-to-new-cards keeps the user oriented.
