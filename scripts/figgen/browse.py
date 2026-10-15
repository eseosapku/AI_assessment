"""A local browser for the whole figure library: every approved figure with its questions.

Run from the repo root:
    python scripts/figgen/browse.py --open

It serves on 127.0.0.1 only and opens the staging store read-only, so it can run while
drawing, review and approval jobs write to it. Browse by subject, then by curriculum topic
or by figure type (family); click a figure for its questions, with the key marked.
"""
from __future__ import annotations

import argparse
import json
import mimetypes
import sqlite3
import sys
import threading
import time
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

if __package__ in (None, ""):  # run as a script: make "figgen" importable
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from figgen.store import library_dir  # noqa: E402

IMAGES = {".png", ".svg", ".jpg", ".jpeg", ".webp"}
PER_PAGE = 48
APPROVED = "f.status = 'approved'"


def summary(db: sqlite3.Connection) -> dict:
    figs = db.execute(f"SELECT COUNT(*) FROM figures f WHERE {APPROVED}").fetchone()[0]
    real = db.execute(f"SELECT COUNT(*) FROM figures f WHERE {APPROVED} AND f.origin <> 'drawn'").fetchone()[0]
    qs = db.execute(f"SELECT COUNT(*) FROM figure_questions q JOIN figures f ON f.id = q.figure_id WHERE {APPROVED}").fetchone()[0]
    rows = db.execute(f"SELECT f.subject, COUNT(*) FROM figures f WHERE {APPROVED} GROUP BY f.subject ORDER BY 2 DESC, 1").fetchall()
    return {"figures": figs, "questions": qs, "real": real,
            "subjects": [{"subject": s, "figures": n} for s, n in rows]}


def families(db: sqlite3.Connection, subject: str) -> list[dict]:
    """The figure types drawn for a subject; real images count under their source (openstax, wikimedia)."""
    rows = db.execute(f"""SELECT COALESCE(f.family, f.origin), COUNT(*) FROM figures f
                          WHERE {APPROVED} AND f.subject = ? GROUP BY 1 ORDER BY 1""", (subject,)).fetchall()
    return [{"family": fam, "figures": n} for fam, n in rows]


def topic_counts(db: sqlite3.Connection) -> dict[str, int]:
    """Approved figures per curriculum topic, in one pass (figure_topics has no index by topic)."""
    return dict(db.execute(f"""SELECT ft.topic_key, COUNT(*) FROM figure_topics ft JOIN figures f ON f.id = ft.figure_id
                                WHERE {APPROVED} GROUP BY ft.topic_key""").fetchall())


def topics(db: sqlite3.Connection, subject: str, counts: dict[str, int] | None = None) -> list[dict]:
    """Every curriculum topic of a subject, empty ones too, so the gaps show."""
    counts = topic_counts(db) if counts is None else counts
    rows = db.execute("SELECT key, name, book, band, source FROM topics WHERE subject = ? ORDER BY book, name, key",
                      (subject,)).fetchall()
    return [{"key": k, "name": name, "book": book, "band": band, "source": source, "figures": counts.get(k, 0)}
            for k, name, book, band, source in rows]


def figures(db: sqlite3.Connection, *, subject: str | None = None, family: str | None = None, topic: str | None = None,
            band: str | None = None, page: int = 0, per: int = PER_PAGE) -> dict:
    """One page of approved figures. Ordered by seed, so a topic's page mixes its families."""
    where, args = [APPROVED], []
    if subject:
        where.append("f.subject = ?"); args.append(subject)
    if family:
        where.append("(f.family = ? OR (f.family IS NULL AND f.origin = ?))"); args += [family, family]
    if topic:
        where.append("f.id IN (SELECT figure_id FROM figure_topics WHERE topic_key = ?)"); args.append(topic)
    if band:
        where.append("f.band = ?"); args.append(band)
    clause = " AND ".join(where)
    total = db.execute(f"SELECT COUNT(*) FROM figures f WHERE {clause}", args).fetchone()[0]
    rows = db.execute(f"""SELECT f.id, COALESCE(f.family, f.origin), f.subject, f.band, f.preview FROM figures f
                          WHERE {clause} ORDER BY f.seed, f.family, f.id LIMIT ? OFFSET ?""",
                      [*args, per, max(page, 0) * per]).fetchall()
    return {"total": total, "page": max(page, 0), "per": per,
            "items": [{"id": i, "family": fam, "subject": s, "band": b, "preview": p} for i, fam, s, b, p in rows]}


def _source(spec: str | None) -> str | None:
    try:
        data = json.loads(spec or "{}")
    except ValueError:
        return None
    return data.get("source") if isinstance(data, dict) else None


def figure(db: sqlite3.Connection, figure_id: str) -> dict | None:
    """An approved figure with its questions (key included) and the topics it is linked to."""
    row = db.execute(f"""SELECT f.id, f.origin, COALESCE(f.family, f.origin), f.kind, f.subject, f.band, f.preview, f.asset,
                                f.credit, f.licence, f.author, f.source_url, f.spec FROM figures f
                         WHERE f.id = ? AND {APPROVED}""", (figure_id,)).fetchone()
    if row is None:
        return None
    fid, origin, family, kind, subject, band, preview, asset, credit, licence, author, url, spec = row
    qs = db.execute("""SELECT kind, stem, options, answer, accepted, explanation, tolerance FROM figure_questions
                       WHERE figure_id = ? ORDER BY n""", (fid,)).fetchall()
    linked = db.execute("""SELECT t.key, t.name, t.book FROM figure_topics ft JOIN topics t ON t.key = ft.topic_key
                           WHERE ft.figure_id = ? ORDER BY t.book, t.name""", (fid,)).fetchall()
    return {"id": fid, "origin": origin, "family": family, "kind": kind, "subject": subject, "band": band,
            "preview": preview, "asset": asset, "credit": credit, "licence": licence, "author": author,
            "source_url": url, "source": _source(spec),
            "questions": [{"kind": k, "stem": s, "options": json.loads(o), "answer": a, "accepted": json.loads(acc),
                           "explanation": e, "tolerance": t} for k, s, o, a, acc, e, t in qs],
            "topics": [{"key": k, "name": n, "book": b} for k, n, b in linked]}


def asset_path(root: Path, rel: str) -> Path | None:
    """The file for an asset path, or None when it is missing, not an image, or outside the library."""
    base = Path(root).resolve()
    path = (base / rel).resolve()
    if base not in path.parents or path.suffix.lower() not in IMAGES or not path.is_file():
        return None
    return path


class _Cache:
    """Slow totals (questions, topic counts) kept for a few minutes; jobs keep adding figures."""

    def __init__(self, ttl: float = 300):
        self.ttl, self.items, self.lock = ttl, {}, threading.Lock()

    def get(self, key, make):
        with self.lock:
            hit = self.items.get(key)
            if hit and time.monotonic() - hit[0] < self.ttl:
                return hit[1]
        value = make()
        with self.lock:
            self.items[key] = (time.monotonic(), value)
        return value


def _handler(root: Path, db_file: Path):
    cache = _Cache()

    def connect() -> sqlite3.Connection:
        return sqlite3.connect(f"file:{db_file.as_posix()}?mode=ro", uri=True, timeout=60, check_same_thread=False)

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *args):  # quiet: one line per thumbnail is noise
            pass

        def _send(self, status: int, body: bytes, ctype: str, cache_for: int = 0):
            self.send_response(status)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("X-Content-Type-Options", "nosniff")
            if cache_for:
                self.send_header("Cache-Control", f"max-age={cache_for}")
            self.end_headers()
            self.wfile.write(body)

        def _json(self, data):
            self._send(200, json.dumps(data).encode(), "application/json; charset=utf-8")

        def do_GET(self):
            url = urlparse(self.path)
            q = {k: v[0] for k, v in parse_qs(url.query).items()}
            try:
                if url.path == "/":
                    return self._send(200, PAGE.encode(), "text/html; charset=utf-8")
                if url.path.startswith("/a/"):
                    path = asset_path(root, unquote(url.path[3:]))
                    if path is None:
                        return self._send(404, b"not found", "text/plain")
                    ctype = "image/svg+xml" if path.suffix == ".svg" else (mimetypes.guess_type(path.name)[0] or "image/png")
                    return self._send(200, path.read_bytes(), ctype, cache_for=3600)
                db = connect()
                try:
                    if url.path == "/api/summary":
                        return self._json(cache.get("summary", lambda: summary(db)))
                    if url.path == "/api/families":
                        return self._json(families(db, q.get("subject", "")))
                    if url.path == "/api/topics":
                        counts = cache.get("counts", lambda: topic_counts(db))
                        return self._json(topics(db, q.get("subject", ""), counts))
                    if url.path == "/api/figures":
                        return self._json(figures(db, subject=q.get("subject"), family=q.get("family"), topic=q.get("topic"),
                                                  band=q.get("band"), page=int(q.get("page", 0) or 0)))
                    if url.path == "/api/figure":
                        found = figure(db, q.get("id", ""))
                        return self._json(found) if found else self._send(404, b"not found", "text/plain")
                finally:
                    db.close()
                return self._send(404, b"not found", "text/plain")
            except (BrokenPipeError, ConnectionResetError):
                pass
            except Exception as e:  # a local tool: show the error rather than hang the page
                self._send(500, f"{type(e).__name__}: {e}".encode(), "text/plain; charset=utf-8")

    return Handler


def main(argv: list[str] | None = None) -> None:
    ap = argparse.ArgumentParser(description="Browse the figure library locally (read-only).")
    ap.add_argument("--port", type=int, default=8765)
    ap.add_argument("--open", action="store_true", help="open the page in the default browser")
    args = ap.parse_args(argv)
    root = library_dir()
    db_file = root / "figures.db"
    if not db_file.is_file():
        sys.exit(f"No figure library at {db_file}")
    server = ThreadingHTTPServer(("127.0.0.1", args.port), _handler(root, db_file))
    url = f"http://127.0.0.1:{args.port}/"
    print(f"Figure library browser on {url}  (Ctrl+C to stop)", flush=True)
    if args.open:
        webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


PAGE = r"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Figure Library</title>
<style>
:root{--paper:#f5f4ef;--card:#fff;--ink:#1d1f22;--muted:#5c626a;--rule:#dcd8cd;--key:#1c6a44;--key-bg:#e1f0e6;
--sel:#24456b;--sel-bg:#e4ebf3;--empty:#a3311d;--sheet:#fff;color-scheme:light}
@media (prefers-color-scheme: dark){:root{--paper:#15171a;--card:#1e2125;--ink:#e7e5e0;--muted:#a2a7ad;--rule:#32363b;
--key:#83d3a6;--key-bg:#1b3125;--sel:#a9c6ea;--sel-bg:#1f2b3a;--empty:#ef937f;color-scheme:dark}}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
header{padding-inline:20px;padding-block:18px 14px;border-bottom:1px solid var(--rule);display:flex;flex-wrap:wrap;
align-items:baseline;gap:6px 24px}
h1{font:600 24px/1.2 Georgia,"Times New Roman",serif;margin:0}
.stats{color:var(--muted);font-variant-numeric:tabular-nums;margin:0}
.layout{display:grid;grid-template-columns:minmax(260px,320px) 1fr;min-height:calc(100vh - 64px)}
aside{border-right:1px solid var(--rule);padding:16px;display:flex;flex-direction:column;gap:14px;min-width:0}
main{padding:16px 20px 48px;display:flex;flex-direction:column;gap:14px;min-width:0}
.label{text-transform:uppercase;letter-spacing:.07em;font-size:11px;color:var(--muted);margin:0}
.subjects{display:flex;flex-wrap:wrap;gap:6px}
button{font:inherit;color:inherit;cursor:pointer}
.chip{border:1px solid var(--rule);background:var(--card);border-radius:999px;padding:3px 10px;font-size:13px}
.chip[aria-pressed=true]{background:var(--sel-bg);border-color:var(--sel);color:var(--sel);font-weight:600}
.chip small{color:var(--muted);font-variant-numeric:tabular-nums}
.tabs{display:flex;border:1px solid var(--rule);border-radius:6px;overflow:hidden}
.tabs button{flex:1;border:0;background:var(--card);padding:6px}
.tabs button[aria-pressed=true]{background:var(--sel-bg);color:var(--sel);font-weight:600}
input[type=search]{font:inherit;width:100%;padding:6px 10px;border:1px solid var(--rule);border-radius:6px;
background:var(--card);color:var(--ink)}
.list{list-style:none;margin:0;padding:0;overflow:auto;max-height:calc(100vh - 330px);border:1px solid var(--rule);
border-radius:6px;background:var(--card)}
.list li button{display:flex;justify-content:space-between;gap:10px;width:100%;text-align:left;border:0;
border-bottom:1px solid var(--rule);background:none;padding:7px 10px;font-size:14px}
.list li button[aria-pressed=true]{background:var(--sel-bg);color:var(--sel)}
.list .n{font-variant-numeric:tabular-nums;color:var(--muted);flex:none}
.list .zero .n{color:var(--empty);font-weight:600}
.list .book{position:sticky;top:0;background:var(--paper);padding:5px 10px;font-size:12px;color:var(--muted);
border-bottom:1px solid var(--rule);font-weight:600}
.bar{display:flex;flex-wrap:wrap;gap:8px 16px;align-items:center;justify-content:space-between}
h2{font:600 20px/1.25 Georgia,"Times New Roman",serif;margin:0;text-wrap:balance}
.bands{display:flex;gap:6px;flex-wrap:wrap}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,190px),1fr));gap:12px}
.thumb{border:1px solid var(--rule);border-radius:6px;background:var(--card);padding:8px;display:flex;
flex-direction:column;gap:6px;text-align:left;min-width:0}
.thumb img{width:100%;height:150px;object-fit:contain;background:var(--sheet);border-radius:3px}
.thumb span{font-size:12px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pager{display:flex;gap:10px;align-items:center;justify-content:center;font-variant-numeric:tabular-nums}
.pager button{border:1px solid var(--rule);background:var(--card);border-radius:6px;padding:5px 14px}
.pager button:disabled{opacity:.4;cursor:default}
.hint{color:var(--muted);max-width:60ch}
dialog{border:1px solid var(--rule);border-radius:8px;background:var(--card);color:var(--ink);padding:0;
width:min(1100px,calc(100vw - 24px));max-height:calc(100vh - 24px)}
dialog::backdrop{background:rgba(0,0,0,.45)}
.detail{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,1fr);gap:20px;padding:20px}
.detail img{width:100%;height:auto;background:var(--sheet);border-radius:4px;border:1px solid var(--rule)}
.detail .close{position:sticky;top:0;float:right;border:1px solid var(--rule);background:var(--card);border-radius:6px;
padding:3px 10px}
.meta{font-size:13px;color:var(--muted);display:flex;flex-direction:column;gap:3px;margin-top:10px;overflow-wrap:anywhere}
.qs{margin:0;padding-left:22px;display:flex;flex-direction:column;gap:14px}
.qs ol{list-style:upper-alpha;margin:6px 0 0;padding-left:22px}
.qs .key{color:var(--key);background:var(--key-bg);font-weight:600;border-radius:3px;padding:0 4px}
.ans{margin:4px 0 0;font-size:14px}
.ans b{color:var(--key)}
.why{margin:4px 0 0;font-size:13px;color:var(--muted)}
@media (max-width:760px){.layout{grid-template-columns:1fr}aside{border-right:0;border-bottom:1px solid var(--rule)}
.list{max-height:300px}.detail{grid-template-columns:1fr}}
</style></head><body>
<header><h1>Figure Library</h1><p class="stats" id="stats">Loading…</p></header>
<div class="layout">
<aside>
  <p class="label">Subject</p><div class="subjects" id="subjects"></div>
  <div class="tabs" role="group" aria-label="Browse by">
    <button id="byTopic" aria-pressed="true">Curriculum topics</button><button id="byFamily" aria-pressed="false">Figure types</button>
  </div>
  <input type="search" id="filter" placeholder="Filter the list…" aria-label="Filter the list">
  <ul class="list" id="list"></ul>
</aside>
<main>
  <div class="bar"><h2 id="title">Pick a subject</h2><div class="bands" id="bands"></div></div>
  <p class="hint" id="hint">Every approved figure, read live from the staging store. Topics in red have no figure yet.</p>
  <div class="grid" id="grid"></div>
  <div class="pager" id="pager" hidden><button id="prev">← Previous</button><span id="pageno"></span><button id="next">Next →</button></div>
</main>
</div>
<dialog id="dlg"></dialog>
<script>
const LEVELS={P:"Primary",LS:"Lower Secondary",UP:"Upper Secondary",AL:"A Level"};
const st={subject:null,mode:"topic",key:null,band:null,page:0,items:[]};
const $=id=>document.getElementById(id);
function h(tag,attrs,...kids){const e=document.createElement(tag);for(const[k,v]of Object.entries(attrs||{})){
 if(k==="on")for(const[ev,fn]of Object.entries(v))e.addEventListener(ev,fn);else if(v!==null&&v!==undefined)e.setAttribute(k,v)}
 for(const k of kids.flat())if(k!==null&&k!==undefined)e.append(k.nodeType?k:String(k));return e}
const SOURCES={openstax:"OpenStax",wikimedia:"Wikimedia Commons"};
const nice=s=>SOURCES[s]||(s||"").replace(/[-_]/g," ").replace(/^./,c=>c.toUpperCase());
const fmt=n=>n.toLocaleString("en-GB");
const api=async(p,q={})=>{const u=new URLSearchParams(Object.entries(q).filter(([,v])=>v!==null&&v!==""));
 const r=await fetch(p+"?"+u);if(!r.ok)throw new Error(await r.text());return r.json()};
const asset=p=>"/a/"+p.split("/").map(encodeURIComponent).join("/");
function save(){location.hash=new URLSearchParams(Object.entries({s:st.subject,m:st.mode,k:st.key,b:st.band,p:st.page})
 .filter(([,v])=>v!==null&&v!==""&&v!==0)).toString()}
async function boot(){
 const s=await api("/api/summary");
 $("stats").textContent=`${fmt(s.figures)} approved figures · ${fmt(s.questions)} questions · ${fmt(s.real)} real images`;
 const hp=new URLSearchParams(location.hash.slice(1));
 Object.assign(st,{subject:hp.get("s"),mode:hp.get("m")||"topic",key:hp.get("k"),band:hp.get("b"),page:+(hp.get("p")||0)});
 $("subjects").replaceChildren(...s.subjects.map(x=>h("button",{class:"chip","aria-pressed":String(x.subject===st.subject),
  on:{click:()=>{st.subject=x.subject;st.key=null;st.page=0;boot2()}}},nice(x.subject)," ",h("small",{},fmt(x.figures)))));
 $("bands").replaceChildren(...[null,"P","LS","UP","AL"].map(b=>h("button",{class:"chip","data-b":b??"",
  "aria-pressed":String(st.band===b),on:{click:()=>{st.band=b;st.page=0;marks();loadGrid()}}},b?LEVELS[b]:"All levels")));
 if(st.subject)boot2();
}
function marks(){
 for(const b of $("subjects").children)b.setAttribute("aria-pressed",String(b.firstChild.textContent===nice(st.subject)));
 for(const b of $("bands").children)b.setAttribute("aria-pressed",String((b.dataset.b||null)===st.band));
 $("byTopic").setAttribute("aria-pressed",String(st.mode==="topic"));$("byFamily").setAttribute("aria-pressed",String(st.mode==="family"));
}
async function boot2(){marks();await loadList();loadGrid()}
async function loadList(){
 $("list").replaceChildren(h("li",{class:"book"},"Loading…"));
 st.items=st.mode==="topic"?await api("/api/topics",{subject:st.subject}):await api("/api/families",{subject:st.subject});
 drawList();
}
function drawList(){
 const f=$("filter").value.trim().toLowerCase();let book=null;const out=[];
 const all=h("button",{"aria-pressed":String(!st.key),on:{click:()=>pick(null)}},h("span",{},"Everything in "+nice(st.subject)));
 out.push(h("li",{},all));
 for(const it of st.items){
  const name=st.mode==="topic"?it.name:nice(it.family);
  if(f&&!(name.toLowerCase().includes(f)||(it.book||"").toLowerCase().includes(f)))continue;
  if(st.mode==="topic"&&it.book!==book){book=it.book;out.push(h("li",{class:"book"},`${it.book} · ${LEVELS[it.band]||it.band}`))}
  const key=st.mode==="topic"?it.key:it.family;
  out.push(h("li",{class:it.figures?"":"zero"},h("button",{"aria-pressed":String(st.key===key),title:name,
   on:{click:()=>pick(key,name)}},h("span",{},name),h("span",{class:"n"},fmt(it.figures)))));
 }
 $("list").replaceChildren(...out);
}
function pick(key){st.key=key;st.page=0;drawList();loadGrid()}
async function loadGrid(){
 if(!st.subject)return;save();
 const sel=st.items.find(it=>(st.mode==="topic"?it.key:it.family)===st.key);
 $("title").textContent=sel?(st.mode==="topic"?sel.name:nice(sel.family)):"Everything in "+nice(st.subject);
 $("grid").replaceChildren(h("p",{class:"hint"},"Loading…"));
 const q={band:st.band,page:st.page};
 if(st.mode==="topic"&&st.key)q.topic=st.key;else{q.subject=st.subject;if(st.key)q.family=st.key}
 const r=await api("/api/figures",q);const pages=Math.max(1,Math.ceil(r.total/r.per));
 $("hint").textContent=r.total?`${fmt(r.total)} figures${sel&&st.mode==="topic"?" · "+sel.book:""}. Click one for its questions and answers.`
  :"No approved figure here yet.";
 $("grid").replaceChildren(...r.items.map(it=>h("button",{class:"thumb",on:{click:()=>show(it.id)}},
  h("img",{src:asset(it.preview),alt:nice(it.family)+" figure",loading:"lazy"}),h("span",{},`${nice(it.family)} · ${LEVELS[it.band]||it.band}`))));
 $("pager").hidden=pages<2;$("pageno").textContent=`Page ${fmt(r.page+1)} of ${fmt(pages)}`;
 $("prev").disabled=r.page<=0;$("next").disabled=r.page+1>=pages;
}
async function show(id){
 const f=await api("/api/figure",{id});const d=$("dlg");
 const qs=h("ol",{class:"qs"},...f.questions.map(q=>{
  const li=h("li",{},h("div",{},q.stem));
  if(q.kind==="mcq")li.append(h("ol",{},...q.options.map((o,i)=>h("li",{},i===+q.answer?h("span",{class:"key"},o):o))));
  else li.append(h("p",{class:"ans"},"Answer: ",h("b",{},q.answer),q.tolerance?` (within ${q.tolerance})`:"",
   q.accepted.length>1?" · also accepted: "+q.accepted.filter(a=>a!==q.answer).join(", "):""));
  if(q.explanation)li.append(h("p",{class:"why"},q.explanation));return li}));
 const meta=h("div",{class:"meta"},h("span",{},`${nice(f.family)} · ${nice(f.subject)} · ${LEVELS[f.band]||f.band}`),
  f.source?h("span",{},"Source: "+f.source):null,f.credit?h("span",{},f.credit):null,
  ...f.topics.map(t=>h("span",{},`Topic: ${t.name} (${t.book})`)),h("span",{},f.id));
 d.replaceChildren(h("div",{class:"detail"},h("div",{},h("img",{src:asset(f.preview||f.asset),alt:nice(f.family)+" figure"}),meta),
  h("div",{},h("button",{class:"close",on:{click:()=>d.close()}},"Close"),h("p",{class:"label"},`${f.questions.length} questions`),qs)));
 d.showModal();
}
$("byTopic").onclick=()=>{st.mode="topic";st.key=null;st.page=0;boot2()};
$("byFamily").onclick=()=>{st.mode="family";st.key=null;st.page=0;boot2()};
$("filter").oninput=drawList;
$("prev").onclick=()=>{st.page--;loadGrid();scrollTo(0,0)};$("next").onclick=()=>{st.page++;loadGrid();scrollTo(0,0)};
$("dlg").addEventListener("click",e=>{if(e.target.id==="dlg")e.target.close()});
boot().catch(e=>{$("stats").textContent="Could not read the library: "+e.message});
</script></body></html>
"""

if __name__ == "__main__":
    main()
