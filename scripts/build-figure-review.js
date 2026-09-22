/**
 * Build the figure approval console from data/figure-drafts/index.json.
 *
 * The drafts are drawn by scripts/live/bulkFigures.test.ts. This turns them
 * into one page where every one can be kept or dropped, and writes the
 * decisions to the artifact's own store so they can be read back and the kept
 * ones promoted into the figure library.
 *
 *   node scripts/build-figure-review.js
 */
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..')
const INDEX = path.join(ROOT, 'data/figure-drafts/index.json')
const OUT = path.join(ROOT, 'data/figure-drafts/review.html')

const drafts = JSON.parse(fs.readFileSync(INDEX, 'utf8'))

/** The SVGs are ours and already escaped at draw time; the text is not. */
const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')

/**
 * Round-robin the kinds, so the first screen shows the range.
 *
 * Drawn in syllabus order, 487 of the 752 are bar charts — Statistics has
 * the most drawable foci and every setting is data about something. Left in
 * that order the reviewer meets three hundred bar charts before their first
 * triangle, which is a good way to have a library approved without being
 * looked at.
 */
function interleave(rows) {
  const buckets = new Map()
  for (const r of rows) {
    const b = buckets.get(r.kind)
    if (b) b.push(r)
    else buckets.set(r.kind, [r])
  }
  const queues = [...buckets.values()]
  const out = []
  while (out.length < rows.length) {
    for (const q of queues) {
      const next = q.shift()
      if (next) out.push(next)
    }
  }
  return out
}

const payload = interleave(drafts).map((d) => ({
  id: d.id,
  subject: d.subject,
  strand: d.strand,
  focus: d.focus,
  stage: d.stage.replace('Cambridge ', ''),
  kind: d.kind,
  description: d.description,
  svg: d.svg,
}))

const subjects = [...new Set(payload.map((d) => d.subject))].sort()
const kinds = [...new Set(payload.map((d) => d.kind))].sort()
const strands = [...new Set(payload.map((d) => d.strand))].sort()

const html = `<title>Figure Approvals</title>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,600;1,6..72,400&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
:root {
  --ink: #16181d;
  --ink-soft: #5a6270;
  --ink-faint: #8b94a3;
  --ground: #f2f1ed;
  --sheet: #ffffff;
  --rule: #d9d8d2;
  --rule-firm: #b9bbc2;
  --accent: #27496d;
  --keep: #2f6b45;
  --keep-wash: #e3efe7;
  --drop: #9c3535;
  --drop-wash: #f5e4e3;
  --shadow: 0 1px 2px rgba(22,24,29,.07), 0 6px 16px -10px rgba(22,24,29,.22);
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --ink: #e8e9ec;
    --ink-soft: #a2a9b6;
    --ink-faint: #767e8d;
    --ground: #15171b;
    --sheet: #1d2026;
    --rule: #2c3038;
    --rule-firm: #3b414b;
    --accent: #8fb3d9;
    --keep: #6fbf8e;
    --keep-wash: #1c2f24;
    --drop: #e08a86;
    --drop-wash: #2f1e1e;
    --shadow: 0 1px 2px rgba(0,0,0,.4), 0 6px 18px -12px rgba(0,0,0,.7);
  }
}
:root[data-theme="dark"] {
  --ink: #e8e9ec;
  --ink-soft: #a2a9b6;
  --ink-faint: #767e8d;
  --ground: #15171b;
  --sheet: #1d2026;
  --rule: #2c3038;
  --rule-firm: #3b414b;
  --accent: #8fb3d9;
  --keep: #6fbf8e;
  --keep-wash: #1c2f24;
  --drop: #e08a86;
  --drop-wash: #2f1e1e;
  --shadow: 0 1px 2px rgba(0,0,0,.4), 0 6px 18px -12px rgba(0,0,0,.7);
}

* { box-sizing: border-box; }
body {
  margin: 0;
  background: var(--ground);
  color: var(--ink);
  font: 400 15px/1.5 "IBM Plex Sans", system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
}
.wrap { max-width: 1240px; margin: 0 auto; padding-inline: 20px; padding-block: 0 72px; }

header { border-bottom: 1px solid var(--rule); background: var(--ground); }
.head { display: flex; flex-wrap: wrap; gap: 18px 28px; align-items: flex-end; padding-block: 30px 22px; }
h1 {
  font: 600 30px/1.1 "Newsreader", Georgia, serif;
  letter-spacing: -.012em; margin: 0; text-wrap: balance;
}
.sub { margin: 6px 0 0; color: var(--ink-soft); max-width: 60ch; font-size: 14.5px; }
.tally { margin-left: auto; display: flex; gap: 24px; }
.tally div { text-align: right; }
.tally b {
  display: block; font: 500 26px/1 "IBM Plex Mono", monospace;
  font-variant-numeric: tabular-nums; letter-spacing: -.02em;
}
.tally span {
  font-size: 10.5px; letter-spacing: .1em; text-transform: uppercase;
  color: var(--ink-faint);
}
.t-keep b { color: var(--keep); }
.t-drop b { color: var(--drop); }

.meter { height: 3px; background: var(--rule); display: flex; }
.meter i { display: block; height: 100%; transition: width .25s ease; }
.meter .m-keep { background: var(--keep); }
.meter .m-drop { background: var(--drop); }

.bar {
  position: sticky; top: 0; z-index: 5;
  background: color-mix(in srgb, var(--ground) 92%, transparent);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid var(--rule);
}
.bar-in { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; padding-block: 12px; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; }
button.chip {
  font: 500 12.5px/1 "IBM Plex Sans", sans-serif;
  padding: 7px 12px; border-radius: 999px; cursor: pointer;
  border: 1px solid var(--rule-firm); background: transparent; color: var(--ink-soft);
}
button.chip[aria-pressed="true"] {
  background: var(--accent); border-color: var(--accent);
  color: var(--ground);
}
button.chip:focus-visible, .act:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.sep { width: 1px; align-self: stretch; background: var(--rule); margin-inline: 4px; }
.note {
  margin-left: auto; font: 400 12px/1.4 "IBM Plex Mono", monospace;
  color: var(--ink-faint);
}

.grid {
  display: grid; gap: 16px; padding-block: 22px;
  grid-template-columns: repeat(auto-fill, minmax(268px, 1fr));
}
.card {
  background: var(--sheet); border: 1px solid var(--rule);
  border-left: 3px solid var(--rule-firm);
  border-radius: 3px; box-shadow: var(--shadow);
  display: flex; flex-direction: column; overflow: hidden;
}
.card[data-verdict="keep"] { border-left-color: var(--keep); }
.card[data-verdict="drop"] { border-left-color: var(--drop); opacity: .5; }
.plate {
  background: #fff; border-bottom: 1px solid var(--rule);
  padding: 12px; display: flex; align-items: center; justify-content: center;
  min-height: 176px;
}
.plate svg { max-width: 100%; height: auto; }
.meta { padding: 11px 13px 4px; flex: 1; }
.focus { font: 600 14px/1.3 "IBM Plex Sans", sans-serif; margin: 0 0 4px; }
.desc { margin: 0; font-size: 12.5px; color: var(--ink-soft); line-height: 1.45; }
.tags {
  display: flex; flex-wrap: wrap; gap: 5px; padding: 9px 13px 0;
  font: 500 10px/1 "IBM Plex Mono", monospace; letter-spacing: .06em;
  text-transform: uppercase; color: var(--ink-faint);
}
.tags span { border: 1px solid var(--rule); border-radius: 2px; padding: 3px 5px; }
.acts { display: flex; gap: 1px; background: var(--rule); margin-top: 11px; }
.act {
  flex: 1; border: 0; cursor: pointer; padding: 11px 4px;
  font: 500 12.5px/1 "IBM Plex Sans", sans-serif;
  background: var(--sheet); color: var(--ink-soft);
}
.act:hover { background: var(--ground); }
.act.keep[aria-pressed="true"] { background: var(--keep-wash); color: var(--keep); }
.act.drop[aria-pressed="true"] { background: var(--drop-wash); color: var(--drop); }

.empty { padding: 60px 0; text-align: center; color: var(--ink-faint); }
.gap {
  margin-block: 22px 0; padding: 16px 18px; border-radius: 3px;
  border: 1px solid var(--rule); border-left: 3px solid var(--accent);
  background: var(--sheet); font-size: 13.5px; color: var(--ink-soft);
  max-width: 78ch;
}
.gap b { color: var(--ink); font-weight: 600; }
@media (max-width: 560px) { .tally { margin-left: 0; } h1 { font-size: 25px; } }
@media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
</style>

<header>
  <div class="wrap">
    <div class="head">
      <div>
        <h1>Figure Approvals</h1>
        <p class="sub">Every diagram below was drawn from a spec, not scavenged from a textbook. Keep the ones that belong on a Checkpoint paper; drop the rest. Nothing reaches a learner until it is kept.</p>
      </div>
      <div class="tally">
        <div><b id="n-total">${payload.length}</b><span>drawn</span></div>
        <div class="t-keep"><b id="n-keep">0</b><span>kept</span></div>
        <div class="t-drop"><b id="n-drop">0</b><span>dropped</span></div>
        <div><b id="n-left">${payload.length}</b><span>to go</span></div>
      </div>
    </div>
  </div>
  <div class="meter"><i class="m-keep" id="m-keep" style="width:0"></i><i class="m-drop" id="m-drop" style="width:0"></i></div>
</header>

<div class="bar">
  <div class="wrap">
    <div class="bar-in">
      <div class="chips" id="f-subject"></div>
      <div class="sep"></div>
      <div class="chips" id="f-kind"></div>
      <div class="sep"></div>
      <div class="chips"><button class="chip" id="f-undecided" aria-pressed="false">Undecided only</button></div>
      <div class="note" id="status">saved as you click · <b>K</b> keep · <b>D</b> drop · ← → move</div>
    </div>
  </div>
</div>

<div class="wrap">
  <div class="grid" id="grid"></div>
  <div class="empty" id="empty" hidden>Nothing matches those filters.</div>
  <p class="gap"><b>What is here now.</b> Fourteen shapes rather than six: circuits and force diagrams for Physics, food chains for Biology, a pie chart and a real results table for Statistics, a coordinate grid and an angle diagram for Geometry, and the apparatus drawing — the marble, the tray of sand, the crater, the ruler. That takes the reach from 25 of the 189 Checkpoint topics to 70. Still out of reach: cells, the rock cycle, the water cycle, and anything in English, where a figure has to belong to the passage and a drawn one never can.</p>
</div>

<script>
const DRAFTS = ${JSON.stringify(payload)};
const SUBJECTS = ${JSON.stringify(subjects)};
const KINDS = ${JSON.stringify(kinds)};

const KIND_NAME = {
  polygon: 'shape', spinners: 'spinner', graph: 'graph',
  barchart: 'bar chart', numberline: 'number line', choice: 'which one',
};

const verdicts = new Map();
let db = null;
let filterSubject = null, filterKind = null, undecidedOnly = false;

const $ = (id) => document.getElementById(id);

function chip(label, pressed, onClick) {
  const b = document.createElement('button');
  b.className = 'chip';
  b.textContent = label;
  b.setAttribute('aria-pressed', String(pressed));
  b.addEventListener('click', onClick);
  return b;
}

function renderFilters() {
  const s = $('f-subject'); s.textContent = '';
  s.append(chip('All subjects', filterSubject === null, () => { filterSubject = null; renderFilters(); renderGrid(); }));
  for (const subj of SUBJECTS) {
    s.append(chip(subj, filterSubject === subj, () => { filterSubject = subj; renderFilters(); renderGrid(); }));
  }
  const k = $('f-kind'); k.textContent = '';
  k.append(chip('All kinds', filterKind === null, () => { filterKind = null; renderFilters(); renderGrid(); }));
  for (const kind of KINDS) {
    // The count on the chip is the point: "these are all the same thing" is
    // answered by showing how many of each thing there are.
    const total = DRAFTS.filter((d) => d.kind === kind).length;
    const done = DRAFTS.filter((d) => d.kind === kind && verdicts.has(d.id)).length;
    // Concatenation, not a template literal: this file is itself a template
    // literal, so a \${...} here is interpolated at BUILD time against the
    // builder's scope, where KIND_NAME does not exist.
    const label = (KIND_NAME[kind] || kind) + ' ' + done + '/' + total;
    k.append(chip(label, filterKind === kind, () => { filterKind = kind; renderFilters(); renderGrid(); }));
  }
  $('f-undecided').setAttribute('aria-pressed', String(undecidedOnly));
}

function visible() {
  return DRAFTS.filter((d) =>
    (filterSubject === null || d.subject === filterSubject) &&
    (filterKind === null || d.kind === filterKind) &&
    (!undecidedOnly || !verdicts.has(d.id)));
}

function card(d) {
  const el = document.createElement('article');
  el.className = 'card';
  el.id = 'c-' + d.id;
  const v = verdicts.get(d.id);
  if (v) el.dataset.verdict = v;

  const plate = document.createElement('div');
  plate.className = 'plate';
  plate.innerHTML = d.svg;
  el.append(plate);

  const meta = document.createElement('div');
  meta.className = 'meta';
  const h = document.createElement('p');
  h.className = 'focus'; h.textContent = d.focus;
  const p = document.createElement('p');
  p.className = 'desc'; p.textContent = d.description;
  meta.append(h, p);
  el.append(meta);

  const tags = document.createElement('div');
  tags.className = 'tags';
  for (const t of [d.subject, KIND_NAME[d.kind] || d.kind, d.stage]) {
    const s = document.createElement('span'); s.textContent = t; tags.append(s);
  }
  el.append(tags);

  const acts = document.createElement('div');
  acts.className = 'acts';
  const keep = document.createElement('button');
  keep.className = 'act keep'; keep.textContent = 'Keep';
  keep.setAttribute('aria-pressed', String(v === 'keep'));
  keep.addEventListener('click', () => decide(d.id, 'keep'));
  const drop = document.createElement('button');
  drop.className = 'act drop'; drop.textContent = 'Drop';
  drop.setAttribute('aria-pressed', String(v === 'drop'));
  drop.addEventListener('click', () => decide(d.id, 'drop'));
  acts.append(keep, drop);
  el.append(acts);
  return el;
}

function renderGrid() {
  const list = visible();
  const grid = $('grid');
  grid.textContent = '';
  for (const d of list) grid.append(card(d));
  $('empty').hidden = list.length > 0;
  renderTally();
}

function renderTally() {
  let keep = 0, drop = 0;
  for (const v of verdicts.values()) v === 'keep' ? keep++ : drop++;
  const n = DRAFTS.length || 1;
  $('n-keep').textContent = keep;
  $('n-drop').textContent = drop;
  $('n-left').textContent = DRAFTS.length - keep - drop;
  $('m-keep').style.width = (keep / n * 100) + '%';
  $('m-drop').style.width = (drop / n * 100) + '%';
}

function paintCard(id) {
  const el = document.getElementById('c-' + id);
  if (!el) return;
  const v = verdicts.get(id);
  if (v) el.dataset.verdict = v; else delete el.dataset.verdict;
  el.querySelector('.act.keep').setAttribute('aria-pressed', String(v === 'keep'));
  el.querySelector('.act.drop').setAttribute('aria-pressed', String(v === 'drop'));
}

async function decide(id, verdict) {
  const was = verdicts.get(id);
  const next = was === verdict ? null : verdict;
  if (next) verdicts.set(id, next); else verdicts.delete(id);
  paintCard(id);
  renderTally();
  renderFilters();
  if (undecidedOnly) renderGrid();

  if (!db) return;
  try {
    const ref = db.doc('decisions/' + id);
    if (next) await ref.set({ verdict: next, at: Date.now() });
    else await ref.delete();
  } catch (err) {
    $('status').textContent = 'could not save that one — it is still marked here';
  }
}

renderFilters();
renderGrid();

$('f-undecided').addEventListener('click', () => {
  undecidedOnly = !undecidedOnly; renderFilters(); renderGrid();
});

// Keyboard, because seven hundred decisions is a lot of mousing. K and D act
// on the card under the pointer or the one holding focus; the arrows walk.
let hovered = null;
$('grid').addEventListener('mouseover', (e) => {
  const card = e.target.closest('.card');
  if (card) hovered = card;
});
document.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const tag = document.activeElement?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;

  const focused = document.activeElement?.closest?.('.card');
  const card = focused || hovered;
  const key = e.key.toLowerCase();

  if ((key === 'k' || key === 'd') && card) {
    e.preventDefault();
    decide(card.id.slice(2), key === 'k' ? 'keep' : 'drop');
    return;
  }
  if (key === 'arrowright' || key === 'arrowleft') {
    const cards = [...$('grid').children];
    if (!cards.length) return;
    const i = card ? cards.indexOf(card) : -1;
    const next = cards[Math.max(0, Math.min(cards.length - 1, i + (key === 'arrowright' ? 1 : -1)))];
    if (next) {
      e.preventDefault();
      hovered = next;
      next.querySelector('.act.keep')?.focus();
    }
  }
});

(async () => {
  db = await window.claude?.use?.('db');
  if (!db) {
    $('status').textContent = 'decisions are not being saved in this view';
    return;
  }
  let firstSnapshot = true;
  db.collection('decisions').onSnapshot((snap) => {
    const next = new Map();
    snap.forEach((doc) => {
      const v = doc.data()?.verdict;
      if (v === 'keep' || v === 'drop') next.set(doc.id, v);
    });

    // Repaint only what changed. Every click writes a document, which comes
    // straight back as a snapshot, and rebuilding seven hundred cards and
    // their SVGs on each one is a visible stutter on the way to a decision.
    const touched = new Set([...verdicts.keys(), ...next.keys()]);
    verdicts.clear();
    for (const [k, v] of next) verdicts.set(k, v);

    if (firstSnapshot || undecidedOnly) {
      firstSnapshot = false;
      renderGrid();
      return;
    }
    for (const id of touched) paintCard(id);
    renderTally();
  }, () => { $('status').textContent = 'lost the connection to saved decisions'; });
})();
</script>
`

fs.writeFileSync(OUT, html, 'utf8')
console.log(`wrote ${OUT}  (${(html.length / 1024).toFixed(0)} KB, ${payload.length} drafts)`)
