# SDD ledger — plan: docs/superpowers/plans/2026-09-09-composable-material-engine-core.md

Spec: docs/superpowers/specs/2026-09-07-studylab-composable-material-engine-design.md (read)
Branch: aws_deploy, 25 ahead of origin at start. BASE for this plan: d5f3155.
Baseline suite: 111 files / 1469 tests.

## Pre-flight scan

Task pairs sharing a file or an interface:

| Tasks | Produced → consumed | Finding |
|---|---|---|
| T1 → T2-T9 | `MaterialSpec`, `MaterialState`, `parseMaterialSpec` | clean |
| T2 → T3 | `buildScope`, `scopeNames` | clean |
| T2 → T7 | `scopeNames`, for expression-reference checking | **CONFLICT — T1 mandates a check only T2 makes possible. See R1** |
| T3 → T6 | `allowsMove`, `applyMove`, `tick` | clean |
| T3 → T7 | `hasCycle` | clean |
| T3 → T8/T9 | `tick(...).solved`, against the legacy modules | **CONFLICT — completeness guard. See R2** |
| T4 → T7 | `checkIsolation` | clean |
| T5 → T7 | `MATERIAL_BOX`, `fitsInBox` | clean |
| T6 → T7 | `isSolvable`, `MAX_STATES` | clean |
| T7 → T8 | `validateMaterial` | clean |
| T8 → T9 | `Apparatus`, `getApparatus`, `apparatusNames`; T9 edits T8's `index.ts` and `equivalence.test.ts` | clean, strictly sequential |

Each task's internal agreement (its tests against the code it specifies):

| Task | Self-agreement |
|---|---|
| T1 | **fails** — Step 4 requires validating expression references, which needs T2 (R1). Everything else agrees. |
| T2 | clean |
| T3 | **fails** — the capacity test is satisfied by the `allow` rule instead, so it would pass for the wrong reason (R3) |
| T4 | clean |
| T5 | **weak** — the 40-slot fixture assumes a derived cap below 40 without deriving it (R4) |
| T6 | clean — checked the state-space arithmetic on both the solvable and too-large fixtures |
| T7 | **under-specified** — tests assert reason strings by regex that Step 3 never states (R5) |
| T8 | clean — verified `sortModule`'s work shape is `{ assign }`, as the test assumes |
| T9 | clean |

## Rulings

- **R1:** T1's `parseMaterialSpec` validates STRUCTURE only — ids, shapes, caps, and that `art` is a bare catalogue name. The step's requirement that it "reject when a rule references a group or control id that does not exist" moves to T7's composite gate, which is the first point `scopeNames` (T2) exists. — A task cannot implement a check whose input is built two tasks later. — If wrong: an expression naming nothing is caught one gate later than planned, still before any student sees it.
- **R2:** The interpreter must not call a board solved while pieces are unplaced. `sortModule.validate` guards this explicitly ("an unfinished board is not 'wrong'") *before* calling `evaluateSuccess`, so an interpreter that calls `evaluateSuccess` directly would disagree with it on a partial board — and T8/T9's whole purpose is that they agree. T3 carries the same guard for placement-based goals. — Verified in `lib/studylab/activities/patterns/sort.ts:15-17`. — If wrong: the equivalence tests fail loudly in T8, which is the point of having them.
- **R3:** T3's "refuses a move into a slot already at capacity" test is ambiguous as written: the piece it moves (`w`, a product) is also refused by the `allow` rule for that group, so it would pass without any capacity logic at all. The implementer must make it unambiguous — add a fourth piece the `allow` rules permit into that group and use it. — A test that passes for the wrong reason is worse than no test. — If wrong: nothing; the fix only strengthens it.
- **R4:** T5's "names the offending group" fixture hardcodes 40 slots against a cap the task derives at implementation time. Derive the fixture's slot count from `MATERIAL_BOX` (`maxSlotsPerRow * maxRows + 1`) rather than hardcoding 40. — If wrong: a test that silently stops exercising its case once the geometry changes.
- **R5:** T7's tests assert refusal reasons by regex (`/could not be read/i`, `/cycle/i`, `/cannot be completed/i`) that Step 3 does not state. The TESTS are the contract — the implementer writes reasons matching them. — If wrong: a reason reads slightly differently from the plan's prose, which the test settles.
- **R6:** Main repo, no worktree. The user directed it explicitly and watches edits live; the branch is `aws_deploy`, not main/master. — If wrong: work lands on a shared branch, but it is local-only and unpushed.

## Progress

Task 1: review spec OK, quality approved. 1 Important + 4 Minor. Reviewer probed parseMaterialSpec with a throwing getter, a Proxy, and a 200k-deep nesting — never throws, confirmed empirically.
Task 1: Ruling: the Important finding is that the REPORT claims the two isSuccessRule guards agree when they do not — the new one is stricter and actually matches the declared types (the old one never checked that binAssignment values are strings). The code is right; the claim is wrong. Duplication itself is justified, since lib/studylab/activities/ is off-limits this whole plan and sharing would mean editing validate.ts. Fixing the report rather than the code, plus pinning the caps the brief's fixed test file never exercised. — If wrong: a later reader trusts a corrected report instead of an incorrect one.

Task 1: fix round 1/5 (3 addressed, 0 open; commits 0ecad4a..a83866d, tests 1477 -> 1485).
Task 1: complete (commits 140cd68..a83866d, review clean).
Task 1: minor (deferred): a sparse/holey pieces array is only incidentally rejected (Array.every skips holes); unreachable via JSON input.
Task 1: minor (deferred): numeric fields accept NaN/Infinity (typeof check only); unreachable via JSON input.

Task 2: review spec FAILED, quality not approved. 2 Critical, 2 Important.
Task 2: Ruling: buildScope must NOT evaluate derive rules. That is the design doc's tick step 3 and the plan gives it to Task 3, whose already-written test requires a failed derive to leave its name ABSENT from the scope. Task 2 shipped it fail-closed to 0, which launders evaluateExpr's null sentinel into a real value and destroys the signal — and the brief's fixture has rules: [] so no test touched the path at all. Revert the evaluation; scopeNames keeps LISTING derive names, which is its legitimate job for validation. — If wrong: derive evaluation lands one task later than an ambiguous brief implied, which is where the design doc puts it anyway.
Task 2: Ruling: a derive rule named count_left or sum_h_left silently overwrites that aggregate, and nothing detects it — an id an LLM picks could clobber the board's own reading of itself. Add an exported collidingNames(spec) to scope.ts, where the names are generated, for Task 7's gate to consume. Rejecting it at parse time is wrong: parse is structural and knows nothing about aggregates. — If wrong: one more small exported helper than strictly needed.

Task 2: fix round 1/5 (3 addressed, 0 open; commits 064ddd1..a714fc8, tests 1491 -> 1496).
Task 2: complete (commits a83866d..a714fc8, review clean after 1 fix round).
Task 2: minor (deferred): scope.ts's top-of-file header claims scopeNames and buildScope cannot disagree about which names are legal, without caveating that derive names are exactly where they deliberately do; buildScope's own docstring three lines below states it correctly.

Task 3: review spec OK, quality approved. 1 Important + 2 Minor. Reviewer independently traced the two-pass control flow, the capacity fixture, and evaluateExpr's fail-closed path.
Task 3: Ruling: drop the pairing -> SuccessInput conversion rather than keep an untested guess. The reviewer checked the only existing consumers of the pairing kind (label.ts, threePeriod.ts) and both pair a piece id with a CONTENT VALUE — a label string, an answer — never with a slot id, so [pieceId, slotId] is really a restatement of binAssignment. The design's canon also lists matching-pairs, which needs piece-to-piece. Nothing needs the conversion today: decision 2's guard only needs 'pairing' in PLACEMENT_GOAL_KINDS, and an absent pairs array fails closed identically. Whichever canon entry first needs pairing defines its shape, with a test. — If wrong: a pairing goal reports not-solved until a canon entry defines the mapping, which is the safe direction.
Task 3: OBLIGATION for Task 7: hasCycle is exported and correct but nothing calls it yet, so a cyclic spec handed straight to tick silently returns a partial two-pass answer. Task 7's composite gate must wire it — the plan already lists it as consumed there.

Task 3: fix round 1/5 (1 addressed, 0 open; commits f67bb04..0d11054, tests 1509 -> 1510).
Task 3: complete (commits a714fc8..0d11054, review clean after 1 fix round).
Task 3: minor (deferred): exactOrder pools all ordered groups into one array sorted by slot index; unlikely to be exercised since most ordering apparatus have exactly one ordered group.

Tasks 4-5: review spec OK, quality approved. 1 Important + 3 Minor. Reviewer independently recomputed the constants (maxSlotsPerRow=9, maxRows=5, cap 45) and confirmed the corrected fixture at 46 would NOT have been exceeded by the brief's original hardcoded 40.
Tasks 4-5: Ruling: (Important) the width chain is real — ActivityFrame literally sets w-[420px], and 360 matches dropZoneGeometry's own CONTENT_WIDTH_PX that two live renderers depend on. The height chain is not: ActivityFrame sets no h-* or max-h-* at all, so the card grows with content, and CARD_HEIGHT_PX=380 traces only to blocks.ts defaultSize.h, which feeds canvas collision spacing and which actions.ts explicitly pads because content is expected to exceed it. Every chrome term subtracted from it was read accurately off the markup, but the budget itself is not a constraint. Do not delete the cap — a group with 200 slots must still be refused. Make the premise honest instead: name the constant for what it is, say in the comment that it is the canvas spacing allowance rather than a rendered cap, and record that Stage 3 must make it real or this check is decorative. — If wrong: a correctly-named assertion instead of a mislabelled measurement; the numbers do not change.
Tasks 4-5: Ruling: (Minor, worth fixing) fitsInBox checks groups-per-row and per-group slots independently, each assuming the whole content width — so several groups each near their own cap pass both while needing far more width than the card has. ok:true is necessary but not sufficient. Add a joint total-slot budget. — If wrong: the check refuses a scene that would in fact have fitted, which the reason names so it can be shrunk.
Tasks 4-5: Ruling: (Minor, worth fixing) varyingTraits uses 'key in p.traits', which finds inherited Object.prototype members, so a trait named toString or constructor reads the inherited value instead of the MISSING sentinel. This codebase is explicitly paranoid about exactly this reachability elsewhere. Use Object.prototype.hasOwnProperty.call. — If wrong: nothing; it is strictly more correct.

Tasks 4-5: fix round 1/5 (3 addressed, 0 open; commits 0f905c6..f325ef5, tests 1522 -> 1524). Reviewer recomputed maxTotalSlots=60 independently and confirmed the joint-check fixture (6 groups x 11 slots, per-group cap 45, sum 66) exercises only the new check.
Tasks 4-5: complete (commits 0d11054..f325ef5, review clean after 1 fix round).
Tasks 4-5: minor (deferred): the toString-trait test cannot discriminate old from new behaviour, since traits are typed number|string and both a function reference and a symbol compare unequal to every string — kept as a regression guard against a future reintroduction of 'in'.
OBLIGATION for Stage 3 (next plan): MATERIAL_BOX.heightPx is an allowance, not a rendered cap. ActivityFrame sets no h-*/max-h-*, so the card is height:auto. Stage 3 must make it a real CSS max-height or adopt an enforced scrollable-zone backstop like CompareActivity's ZONE_MAX_HEIGHT, or the height half of fitsInBox is decorative.

Task 6: review spec OK, quality approved. 1 Important + 2 Minor. Reviewer traced the canonical key by hand (built off spec order, not Object.keys, so move order cannot fork a state), proved the cap cannot false-reject, and ran the too-large and performance fixtures standalone to confirm each exercises what it claims.
Task 6: Ruling: (Important) controlSamples falls back, above 20 grid points, to 20 points evenly spaced across the CONTINUOUS min..max range — values not on the control's step grid and unreachable by any real slider. Two failure directions: an ordinary control (0..100 step 1, numericWithin target 50 tolerance 0.5) is falsely rejected because no sample lands within tolerance; and worse, a material can be certified solvable via an interior sample no slider can produce, which is this task's own bug in the control dimension. Unlike Task 3's pairing guess, this branch IS required — the brief says 'discretise each by its step' and the design doc defines state as placement plus discretised controls — so the fix is narrower than removal: sample 20 evenly-spaced INDICES INTO THE STEP GRID, snapping to min + step * roundedIndex. Fold in the float grid-count wobble at the same time. — If wrong: the sampler visits a coarser but always-real subset of slider positions, so it can under-explore and report unreachable, never certify an unreachable material as solvable.

Task 6: fix round 1/5 (2 addressed, 0 open; commits 660b1fe..3967db5, tests 1530 -> 1531, perf 124ms of a 2000ms budget). Reviewer worked the new sampler by hand (min 0, max 25, step 1 -> 20 on-grid indices, both endpoints present) and brute-forced 543 real undercount cases plus 6000 span/step pairs to confirm the epsilon never over-rounds.
Task 6: complete (commits f325ef5..3967db5, review clean after 1 fix round).
Task 6: minor (deferred): MY ERROR, propagated into a code comment. I told the implementer the float wobble shows up as 1/0.1 = 9.999999999999998; that is false, 1/0.1 === 10 exactly. The real case is 0.3/0.1 = 2.9999999999999996, flooring to 2 instead of 3. solvable.ts:34-36 and commit 3967db5's message both now cite the non-reproducing example. The FIX is correct and necessary — only the cited case is wrong. Correct the comment to 0.3/0.1.
Task 6: minor (deferred): the Set-based index dedup can yield fewer than 20 unique samples for a grid just over the cap (~21-25 points), reducing coverage further. Every returned value is still on-grid, so it is lossiness, not incorrectness.

PLAN RUN STOPPED at the user's request (credits) after Task 6 of 9. Task 7 was dispatched and its agent died on a session rate limit before writing anything — the tree was clean, no partial work to recover.
Remaining: Task 7 (composite gate, brief already written at task-7-brief.md), Task 8 (canon + 4 apparatus), Task 9 (5 more apparatus). Task 7's dispatch must carry three inherited obligations: wire hasCycle, land expression-reference checking against scopeNames, and consume collidingNames.
Stop-time state: 117 test files / 1531 tests, tsc clean, HEAD 286a002, 32 commits ahead of origin, nothing pushed.

