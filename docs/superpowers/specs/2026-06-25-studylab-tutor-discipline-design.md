# StudyLab Tutor Discipline — Design

**Date:** 2026-06-25
**Status:** Approved for implementation
**Area:** StudyLab tutor (`app/api/studylab/tutor/route.ts`) + model config

## 1. Problem

The tutor doesn't use the whiteboard well: it treats the **chat as the lesson** (long explanations in `say`, thin cards), **narrates actions it never takes** ("I'll create a card to illustrate this" with no `createCard`), barely reaches for the rich card types (diagrams/tables/worked examples), and offers chat suggestions that are really **card actions** ("Run the code"). Root causes: a weak rule-list prompt, no enforcement that words match actions, and the tutor running on **`amazon.nova-lite-v1:0`** — a tiny model that can't follow a complex tool-orchestrating prompt.

## 2. Decisions (from brainstorming)

- **The whiteboard IS the lesson.** Tutor teaches by building the board; chat is a thin guide.
- **Bump the tutor model** to a stronger one (Nova Pro), env-overridable.
- Fix via prompt rewrite **and** deterministic guards.

## 3. Design

### 3.1 System-prompt rewrite (operating manual)

Replace the rule-list `SYSTEM` string with a role-based operating manual organized around one principle: **the whiteboard is the lesson.**

- **Core principle:** teach by BUILDING the board — every idea/example/diagram is a card. `say` is **1-2 short sentences that point to the board** ("Here's how it ionizes — see the card."), never the explanation itself. **Act, don't announce** — never say "I'll create a card…"; just create it.
- **Card-type heuristic** (use variety, not just concept cards): structure/relationship → `mermaid`; procedure/derivation/how-to → `worked`; comparison/structured data → `table`; key definition/tip/common mistake → `callout`; runnable program → `code` (programming only); plain fact/explanation → `concept`. Reach for diagrams often.
- **Suggestions = lesson navigation only:** e.g. "Go deeper", "Show another example", "I'm ready to continue", "Quiz me". NEVER actions the student performs on a card ("Run the code", "Click…").
- **Keep (condensed):** step discipline (sequential, +1), build-on-existing/no-duplicate (uses the EXISTING CARDS list), checkpoint flow + format rules (no `code` questions for non-programming; valid MCQs), accuracy/consistency, mermaid raw-syntax-no-fences.
- **One few-shot example turn** showing the ideal shape: short `say`, 2-3 varied cards (incl. a diagram), `connect`s, navigation suggestions.

### 3.2 Deterministic guards (`lib/studylab/tutorClean.ts`, pure, TDD)

Applied in `sanitizeResponse`:

- `cleanSay(say)`: drop filler sentences that announce card creation — sentences matching `/\b(create|make|add|draw|build|sketch|put together)\b[^.!?]*\bcard\b/i` or `/\bi'?ll (show|illustrate|map|sketch|draw)\b/i`. If nothing is left, keep the original (never blank the message).
- `cleanSuggestions(suggestions)`: drop chips that are card actions — matching `/\b(run|execute|click|press|tap|paste)\b/i`. Keep the rest.

### 3.3 Model bump

- `app/api/studylab/tutor/route.ts`: call the model with `model: TUTOR_MODEL`, where `TUTOR_MODEL = process.env.AWS_TUTOR_MODEL_ID || 'google.gemma-3-27b-it'`. Chosen over Nova Pro on cost (Nova Pro's $3.20/1M output is too expensive right now). `callGemma`'s `buildModelCandidates` expands this to the versioned/regional ids and falls back to `gemma-3-12b` if 27B is unavailable.
- Risk: the bare `gemma-3-27b-it` id previously returned `ValidationException` on this account (why the default was Nova Lite). The env override (`AWS_TUTOR_MODEL_ID`) lets the operator set whatever works — e.g. `google.gemma-3-12b-it` or back to `amazon.nova-lite-v1:0` — without a code change. Latency is acceptable for this flow.

## 4. Files

- `app/api/studylab/tutor/route.ts` — rewrite `SYSTEM`; apply guards in `sanitizeResponse`; `model: TUTOR_MODEL`.
- `lib/studylab/tutorClean.ts` (new) — `cleanSay`, `cleanSuggestions`.
- `lib/studylab/tutorClean.test.ts` (new) — guard tests.

## 5. Risks

- **Latency/cost** from Nova Pro — mitigated by the env override.
- Guards are conservative (regex); they only strip clear card-announcement filler and clear card-action chips, and never blank a message. Prompt is the primary fix; guards are a safety net.
- The prompt rewrite is behavior-only — affects new turns, not existing cards.
