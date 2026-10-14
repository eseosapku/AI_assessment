# Figure Library P3p: The Economics, Business and Accounting Wave, Samples

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 17 families for Economics (108 mapped topics), Accounting (137) and Business (162), ending in a sample sheet. Today the three subjects have figures in 2 topics. Their pilot families (supply_demand, break_even) declare no concepts and are linked by hand.

**Approval:** the user's standing approval of 2026-10-14 covers this ("keep on going ... i agree and approve whatever yo do till i get back"). The sheet is published, and scaling follows it.

**Architecture:**
- **Families:** one module each in `scripts/figgen/families/`.
- **Tests:** each family ships with:
  - an answer test over 1,000 seeds, in `scripts/figgen/tests/test_commerce_answers.py`, that recomputes every key from the params: the ledger balanced, the depreciation run, the network's critical path found;
  - the shared tests.
- **Links:** each family declares its own subject's `CONCEPTS` and `NEEDS`. Where its figure teaches another of the three subjects too, it declares `ALSO` (P3n): break-even is Accounting's and Business's; supply and demand is Economics' and Business's.
- **Wording test:** the three subjects join `WORDED_SUBJECTS`.

**Tech Stack:** Python figgen (matplotlib, pytest); the read-only link report; `wave_sheet.py`.

**Spec:** `docs/superpowers/specs/2026-10-10-figure-library-design.md`, sections 5.2 and 9.

## Global Constraints

- **Spend:** $0. Samples only; nothing is written to the store.
- **Exactness:** every key is computed from the figure's params. Every value asked is printed, countable or on a gridline.
- **Money:**
  - Rwandan francs (Frw) for Rwandan contexts, written with a space for thousands ("12 500 Frw");
  - a firm's own accounts in its stated currency.
  - Accepted forms include the number with and without separators and the unit.
- **Conventions stated:** each formula a question depends on is printed or named in the stem:
  - PED as % change in quantity ÷ % change in price;
  - straight-line or reducing-balance depreciation at a stated rate;
  - the current ratio as current assets ÷ current liabilities.
- **Accounts look like accounts:** T-accounts with Dr and Cr sides, "Balance c/d" and "Balance b/d"; a trial balance in two columns.
- **No knowledge-only questions:** "Which side is the debit side?" is not asked.
- **Commits:** local only, on `aws_deploy`. Leave out the three unrelated files, and use the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **A balance on the wrong side.** A T-account whose debits are less than its credits has a credit balance b/d. Expected: the key names the side, and the test balances the account.
2. **Depreciation rounding.** Reducing balance gives decimals. Expected: whole-franc values by choice of rate and cost, or the rounding is stated.
3. **Elasticity sign and method.** Expected: the formula is stated, the key is the absolute value with "elastic" or "inelastic", and the midpoint method is never mixed in.
4. **A critical path with a tie.** Expected: one path is longest, and the test finds it independently.
5. **A break-even point between gridlines.** Expected: the break-even output is a whole number on a gridline.

---

### Task 1: The pilots reworked; the subjects join the wording test

- **supply_demand** (economics; UP): concepts demand-and-supply, market-equilibrium, demand-curve-shifts; `ALSO` business.demand-and-supply-theory and business.market-equilibrium. Named leads.
- **break_even** (business; UP): concepts break-even-analysis and costs-and-revenue; `ALSO` accounting.break-even-analysis. Named leads; the margin of safety at a stated output.
- **Commit:** `feat(figgen): commerce: the pilot families reworked`.

### Task 2: Economics

- **ppc:** a production possibility curve for two goods, with lettered points.
  - **Asks:** the opportunity cost of moving from one point to another; which point is unattainable, or inefficient (MCQ).
  - **ALSO:** business.production-possibility-frontier.
- **elasticity:** a demand schedule, or two points on a demand curve, with the PED formula stated.
  - **Asks:** the PED to two decimals, as an absolute value; elastic or inelastic; the total revenue at a price.
- **cost_revenue:** a table of output and total cost (and price, at AL).
  - **Asks:** the average cost at an output; the marginal cost of a unit; at AL, the profit-maximising output where MC = MR.
- **price_index:** a basket of 3–4 goods with weights and prices in two years.
  - **Asks:** the weighted price index; the inflation rate.
- **national_income:** a table of C, I, G, X and M in billions of Frw.
  - **Asks:** GDP by expenditure; net exports; GDP per head for a stated population.
- **Commit:** `feat(figgen): commerce: economics`.

### Task 3: Accounting

- **t_account:** a ledger account with 3–5 debits and credits, dated.
  - **Asks:** the balance c/d; the side of the balance b/d; the total of the debit side.
- **trial_balance:** a trial balance with one figure missing.
  - **Asks:** the missing figure; the column totals.
- **depreciation:** an asset's cost and a straight-line or reducing-balance rate.
  - **Asks:** the depreciation in a year; the net book value after n years.
  - **ALSO:** business.depreciation-and-asset-valuation.
- **bank_reconciliation:** a cash-book balance, unpresented cheques and lodgements not yet credited.
  - **Asks:** the bank-statement balance; the adjusted cash book (bank charges, credit transfers).
- **income_statement:** sales, opening and closing inventory, purchases and expenses.
  - **Asks:** the cost of sales; the gross profit; the profit for the year.
- **ratio_analysis:** extracts of a statement of financial position and of an income statement.
  - **Asks:** the current ratio; the gross margin %; the profit margin %.
  - **ALSO:** business.financial-ratios-and-analysis.
- **Commit:** `feat(figgen): commerce: accounting`.

### Task 4: Business

- **cash_flow_forecast:** four months of receipts and payments with an opening balance, some cells blank.
  - **Asks:** a month's net cash flow; a closing balance; the first month with a negative balance.
  - **ALSO:** accounting.budget-preparation.
- **critical_path:** an activity network of 6–8 activities with durations.
  - **Asks:** the project's shortest completion time; the critical activities (MCQ); an activity's float.
- **inventory_chart:** a stock-level graph with its saw-tooth, the reorder level, the buffer stock, the lead time and deliveries, on gridlines.
  - **Asks:** the maximum stock; the reorder quantity; the lead time in weeks.
- **pricing:** unit costs and a mark-up or a margin.
  - **Asks:** the cost-plus price; the mark-up % from a price.
- **Commit:** `feat(figgen): commerce: business`.

### Task 5: Link, look, review, sheet and record

- [ ] **Link report** for the three subjects, read by topic name and section. Each AVOID for a misfit is a ruling.
- [ ] **Look** at one PNG of every sub-type.
- [ ] **Probe `agrees`** offline on money with spaces, ratios ("1.5 : 1"), percentages and "credit"/"debit" words.
- [ ] **Fresh review** by an Opus subagent, then one fix pass.
- [ ] **Sheet:** `wave_sheet.py` for each subject, or one combined, published.
- [ ] **Record** a P3p result in the spec and in memory.
