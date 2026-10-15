"""A formatted document (LS, UP; Rwanda ICT S4 "Formatting a document" and "Advanced Word Processing", Cambridge IGCSE
ICT "Layout"), of two kinds.

- page: one page of a word-processed document (a school newsletter, a cooperative's notice, a health centre leaflet,
  a library's rules), its blocks lettered in the margin: a heading, two or three paragraphs, a bulleted or numbered
  list, a table, and sometimes a header and a footer. Paragraphs are left-aligned, centred, right-aligned or
  justified, and one may be double-spaced. A paragraph is indented only where the indent is asked, and then every
  other block starts every line on the margin (list marks always do); the text is real text, drawn line by line so each alignment
  shows as it would on screen (justified lines are spread word by word to both margins). Which letter shows
  centre-aligned (right-aligned, justified, double-spaced, indented) text, or the header or footer: exactly one
  lettered block has it. How many bullet points (numbered items) the list has; how many columns (rows) the table has.
- slides: a presentation program's window, its five parts lettered: the ribbon, the thumbnail pane of numbered slides,
  the slide pane being edited, the notes pane and the status bar. Which letter shows a part (from a fixed table of
  the parts' names and places), how many slides the presentation has, and how many bullet points the slide being
  edited has.
"""
from __future__ import annotations

import random
import textwrap

from matplotlib.patches import Circle, Rectangle

from ..core import FILL, FILL_2, INK, NAMES, Question, count, new_figure

ID = "document_format"
KIND = "business.document"
SUBJECT = "computing"
BANDS = ("LS", "UP")
PAGE = tuple(f"computing.{c}" for c in ("word-processing", "text-alignment", "bullets-numbering", "paragraph-formatting",
                                        "document-formatting-design", "table-formatting-design", "text-indentation",
                                        "page-layout-organization", "header-footer-management", "document-production"))
SLIDES = tuple(f"computing.{c}" for c in ("presentation-software", "presentation-slides", "slide-design-formatting",
                                          "slide-management", "bullets-numbering"))
CONCEPTS = PAGE + tuple(c for c in SLIDES if c not in PAGE)
# A topic whose sections the book lists is reached only if its name or a section names formatting, word processing,
# paragraphs, alignment, lists, layout, tables, headers and footers, or presentations and slides.
NEEDS = (r"word process|format|paragraph|alignment|bullet|layout|document|\btables?\b|header|footer|line spacing|"
         r"indent|page setup|presentation|\bslides?\b|power ?point|\bstyles?\b")
# Spreadsheets, charts, web pages, mail merge and tables of contents format other things.
AVOID = (r"spreadsheet|excel|worksheet|chart|cascading|\bcss\b|website|html|mail merge|table of contents|proofing|"
         r"database|\bgis\b|arcgis|google (docs|sheets|form)|online google|classroom|\bcells?\b|export|protect|"
         r"referencing|objects in a document")

CONTEXTS = {
    "school": {
        "header": "Remera Secondary School", "footer": "School newsletter, page 1",
        "heading": "Science Fair 2025",
        "paras": ["Our science fair will take place in the main hall on Friday 14 November. Every class will show a "
                  "project about water, energy or farming.",
                  "Parents and guardians are welcome to visit from 9:00 to 12:00. Students will explain their projects "
                  "and answer questions from visitors.",
                  "Please bring a bottle of water and a hat, because some projects will be shown outside in the school "
                  "garden.",
                  "The three best projects will represent the school at the district science fair in Huye next month."],
        "items": ["Water filters", "Solar cookers", "Biogas from waste", "Drip irrigation", "Rain gauges"],
        "table": [["Class", "Room", "Time", "Teacher"], ["S1", "Lab 1", "9:00", "Mr Gatete"], ["S2", "Lab 2", "10:00", "Ms Uwera"],
                  ["S3", "Hall", "11:00", "Mr Rukundo"], ["S4", "Garden", "11:30", "Ms Mutesi"]],
    },
    "coop": {
        "header": "Musanze Potato Growers' Cooperative", "footer": "Notice to members",
        "heading": "Harvest Meeting",
        "paras": ["All members are invited to the harvest meeting at the cooperative store in Kinigi on Saturday at "
                  "10:00 in the morning.",
                  "We will agree the price of potatoes for this season and plan how the trucks will collect each "
                  "village's bags.",
                  "Members who cannot come should send a family member with their member card, so that their vote can "
                  "be counted.",
                  "Tea and bread will be served after the meeting. Please tell your neighbours about this notice."],
        "items": ["Bring your member card", "Bring last season's receipts", "Pay any fees still owed",
                  "Arrive before 10:00", "Sign the attendance sheet"],
        "table": [["Village", "Members", "Bags", "Truck day"], ["Kinigi", "42", "380", "Monday"],
                  ["Busogo", "35", "290", "Tuesday"], ["Nyange", "28", "240", "Wednesday"], ["Cyuve", "31", "260", "Thursday"]],
    },
    "clinic": {
        "header": "Huye Health Centre", "footer": "Health leaflet, page 1",
        "heading": "Stop Malaria at Home",
        "paras": ["Malaria is spread by mosquitoes that bite at night. Sleeping under a treated net every night is the "
                  "best way to protect your family.",
                  "Empty any water standing in old tins, tyres and pots near your house, because mosquitoes lay their "
                  "eggs in still water.",
                  "If a child has a fever, take the child to the health centre on the same day. Early treatment saves "
                  "lives.",
                  "Community health workers visit every village each month and can test for malaria quickly."],
        "items": ["Sleep under a net", "Empty standing water", "Cut tall grass", "Close windows at dusk",
                  "Visit the clinic early"],
        "table": [["Day", "Service", "Time", "Room"], ["Monday", "Vaccination", "8:00", "Room 2"],
                  ["Tuesday", "Malaria tests", "9:00", "Room 4"], ["Thursday", "Child growth", "8:30", "Room 1"],
                  ["Friday", "Nutrition", "10:00", "Room 3"]],
    },
    "library": {
        "header": "Nyanza Public Library", "footer": "Library rules, page 1",
        "heading": "New Library Rules",
        "paras": ["From next month the library will open from 8:00 to 18:00 every weekday and from 9:00 to 13:00 on "
                  "Saturday.",
                  "Members may borrow up to three books at a time. Books must be returned within two weeks, or a small "
                  "fine will be paid.",
                  "Please keep quiet in the reading room and switch your phone to silent before you come in.",
                  "Computers may be booked for one hour at a time at the front desk with your library card."],
        "items": ["Show your card", "No food or drinks", "Return books on time", "Keep the room quiet",
                  "Book computers early"],
        "table": [["Section", "Floor", "Books", "Opens"], ["Children", "Ground", "1200", "8:00"],
                  ["Science", "First", "850", "8:00"], ["History", "First", "640", "9:00"], ["Novels", "Second", "1500", "9:00"]],
    },
}
WIDTH = 50  # characters a line of a paragraph holds before it wraps
LEFT, RIGHT = 0.95, 5.65  # the page's text margins
SINGLE = 0.24  # one line's height at single spacing
ASKS = ["centre-aligned text", "right-aligned text", "justified text", "text with double line spacing",
        "an indented paragraph", "the header", "the footer"]
SLIDE_DECKS = {
    "school": ["Our Science Fair", ["Science Fair 2025", "Projects", "Timetable", "Our Science Fair", "Judges", "Prizes", "Thank you"],
               ["Water filters", "Solar cookers", "Biogas from waste", "Drip irrigation", "Rain gauges"],
               "Thank the parents for coming."],
    "coop": ["Harvest Plan", ["Welcome", "Last season", "Harvest Plan", "Prices", "Trucks", "Questions", "Close"],
             ["Dig potatoes in week 1", "Sort the bags by size", "Weigh every bag", "Load the trucks on Monday",
              "Pay members on Friday"], "Remind members to bring their cards."],
    "clinic": ["Stop Malaria", ["Malaria facts", "Stop Malaria", "Nets", "Water", "Fever", "Clinic times", "Thank you"],
               ["Sleep under a net", "Empty standing water", "Cut tall grass", "Visit the clinic early"],
               "Show the class a treated net."],
    "library": ["Library Rules", ["Welcome", "Opening times", "Library Rules", "Borrowing", "Computers", "Fines", "Questions"],
                ["Show your card", "No food or drinks", "Return books on time", "Keep the room quiet", "Book computers early"],
                "Hand out the new library cards."],
}
PARTS = ("ribbon", "thumbnail pane", "slide pane", "notes pane", "status bar")


def concepts_for(p: dict) -> tuple[str, ...]:
    return PAGE if p["sub"] == "page" else SLIDES


def avoid_for(p: dict) -> str:
    if p["sub"] == "page":
        return AVOID + r"|presentation|\bslides?\b|power ?point"
    return AVOID + r"|word process|paragraph|document|^layout$|\bstyles?\b|house style|page layout"


def _ragged(lines: list[str]) -> bool:
    """Lines whose ends differ enough to see that the text is not justified."""
    return len(lines) < 2 or max(map(len, lines)) - min(map(len, lines)) >= 7


def sample(rng: random.Random) -> dict:
    band = rng.choice(BANDS)
    context = rng.choice(sorted(CONTEXTS))
    if rng.random() < 0.4:
        deck = SLIDE_DECKS[context]
        n = rng.randint(4, 7)
        titles = deck[1][:n]
        if deck[0] not in titles:
            titles = titles[:-1] + [deck[0]]
        bullets = rng.sample(deck[2], rng.randint(3, min(5, len(deck[2]))))
        letters = rng.sample("ABCDE", 5)
        return {"band": band, "sub": "slides", "context": context, "titles": titles, "current": titles.index(deck[0]) + 1,
                "bullets": bullets, "notes": deck[3], "parts": dict(zip(PARTS, letters))}
    c = CONTEXTS[context]
    while True:
        ask = rng.choice(ASKS)
        n_paras = rng.randint(2, 3)
        paras = rng.sample(c["paras"], n_paras)
        # Asked for the indent, every other block starts every line at the margin: a centred or right-aligned
        # paragraph, its lines starting right of the margin by different amounts, was read as indented (P3z review).
        flush = ask == "an indented paragraph"
        heading_align = "left" if flush else rng.choice(["center", "left"])
        # each special format on at most one lettered block, and the asked one on exactly one
        specials = {"center": ask == "centre-aligned text", "right": ask == "right-aligned text",
                    "justify": ask == "justified text"}
        aligns = ["left"] * n_paras
        slots = list(range(n_paras))
        rng.shuffle(slots)
        for a in ("center", "right", "justify"):
            want = specials[a] or (rng.random() < 0.35 and not (flush and a != "justify"))
            if a == "center" and heading_align == "center":
                want = False
            if want and slots:
                aligns[slots.pop()] = a
        if ask == "centre-aligned text" and heading_align == "center":
            continue
        if ask in ("centre-aligned text", "right-aligned text", "justified text") and \
                {"centre-aligned text": "center", "right-aligned text": "right", "justified text": "justify"}[ask] not in aligns:
            continue
        spacing = [1] * n_paras
        indent = [False] * n_paras
        if ask == "text with double line spacing" or rng.random() < 0.3:
            spacing[rng.randrange(n_paras)] = 2
        lefts = [i for i, a in enumerate(aligns) if a == "left"]
        if flush:  # only the asked paragraph is indented, and only when the indent is asked
            if not lefts:
                continue
            indent[rng.choice(lefts)] = True
        if ask == "text with double line spacing" and 2 not in spacing:
            continue
        # A justified paragraph wraps nearer the column's full width, so spreading its words leaves ordinary gaps.
        lines = [textwrap.wrap(t, WIDTH + (2 if a == "justify" else 0) - (6 if ind else 0))
                 for t, a, ind in zip(paras, aligns, indent)]
        if not all(_ragged(ls) if a != "justify" else (len(ls) >= 2 and len(ls[-1]) <= WIDTH - 12)
                   for ls, a in zip(lines, aligns)):
            continue
        header = ask == "the header" or rng.random() < 0.3
        footer = ask == "the footer" or rng.random() < 0.3
        kind = rng.choice(["bullets", "numbered"])
        items = rng.sample(c["items"], rng.randint(3, 5))
        cols = [0] + sorted(rng.sample(range(1, 4), rng.randint(1, 3)))  # the first column names each row
        rows = [[r[k] for k in cols] for r in c["table"][:rng.randint(3, 5)]]
        blocks = []
        if header:
            blocks.append({"kind": "header", "text": c["header"]})
        blocks.append({"kind": "heading", "align": heading_align, "lines": [c["heading"]]})
        paragraphs = [{"kind": "text", "align": a, "spacing": sp, "indent": ind, "lines": ls}
                      for a, sp, ind, ls in zip(aligns, spacing, indent, lines)]
        list_block = {"kind": kind, "align": "left", "items": items}
        table = {"kind": "table", "align": "left", "rows": rows}
        order = paragraphs[:1] + [list_block] + paragraphs[1:] + [table] if rng.random() < 0.5 else \
            paragraphs + [list_block, table]
        blocks += order
        if footer:
            blocks.append({"kind": "footer", "text": c["footer"]})
        # lettered in no order, so the top block is not always A nor the bottom one the last letter
        for letter, b in zip(rng.sample("ABCDEFGHIJ"[:len(blocks)], len(blocks)), blocks):
            b["letter"] = letter
        return {"band": band, "sub": "page", "context": context, "blocks": blocks, "ask": ask,
                "margins": [LEFT, RIGHT]}


# --- drawing: the page -----------------------------------------------------------------------------

def _measure(ax, renderer, text: str, size: float, bold: bool = False) -> float:
    """A piece of text's width in data units, as the renderer draws it."""
    t = ax.text(0, 0, text, fontsize=size, fontweight="bold" if bold else "normal")
    box = t.get_window_extent(renderer)
    t.remove()
    inv = ax.transData.inverted()
    return inv.transform((box.x1, 0))[0] - inv.transform((box.x0, 0))[0]


def _letter(ax, letter: str, y: float) -> None:
    ax.add_patch(Circle((0.42, y), 0.17, facecolor="white", edgecolor=INK, linewidth=1.1))
    ax.text(0.42, y, letter, ha="center", va="center", fontsize=10.5, fontweight="bold")


def _height(blocks: list) -> float:
    h = 0.6
    for b in blocks:
        if b["kind"] in ("header", "footer"):
            h += 0.5
        elif b["kind"] == "heading":
            h += 0.55
        elif b["kind"] == "text":
            h += SINGLE * b["spacing"] * (len(b["lines"]) - 1) + 0.24 + 0.22
        elif b["kind"] in ("bullets", "numbered"):
            h += len(b["items"]) * 0.27 + 0.22
        else:
            h += len(b["rows"]) * 0.3 + 0.25
    return h


def _draw_page(p: dict):
    blocks = p["blocks"]
    height = _height(blocks)
    fig, ax = new_figure(6.6, 6.6 * (height + 0.1) / 6.5)
    ax.set_xlim(-0.05, 6.45)
    ax.set_ylim(-0.05, height + 0.05)
    ax.set_aspect("equal")
    fig.canvas.draw()
    renderer = fig.canvas.get_renderer()
    ax.add_patch(Rectangle((0.0, 0.0), 6.4, height, facecolor="white", edgecolor=INK, linewidth=1.3))
    for x in (LEFT, RIGHT):  # the margins, faint, as a page view shows them
        ax.plot([x, x], [0.12, height - 0.12], color="#dddddd", linewidth=0.6, linestyle=(0, (2, 3)), zorder=0)
    y = height - 0.35
    size = 9.5
    for b in blocks:
        k = b["kind"]
        if k in ("header", "footer"):
            yy = y if k == "header" else 0.3
            ax.text(LEFT, yy, b["text"], ha="left", va="center", fontsize=8.5, color="#333333", gid=f"{b['letter']}:line0")
            ax.plot([LEFT, RIGHT], [yy - 0.16, yy - 0.16] if k == "header" else [yy + 0.16, yy + 0.16], color="#999999",
                    linewidth=0.6)
            _letter(ax, b["letter"], yy)
            if k == "header":
                y -= 0.5
            continue
        if k == "heading":
            y -= 0.12
            x, ha = ((LEFT + RIGHT) / 2, "center") if b["align"] == "center" else (LEFT, "left")
            ax.text(x, y, b["lines"][0], ha=ha, va="center", fontsize=13, fontweight="bold", gid=f"{b['letter']}:line0")
            _letter(ax, b["letter"], y)
            y -= 0.43
            continue
        if k == "text":
            left = LEFT + (0.55 if b["indent"] else 0)
            step = SINGLE * b["spacing"]
            first = y
            for i, line in enumerate(b["lines"]):
                gid = f"{b['letter']}:line{i}"
                if b["align"] == "justify" and i < len(b["lines"]) - 1:
                    words = line.split()
                    widths = [_measure(ax, renderer, w, size) for w in words]
                    gap = (RIGHT - left - sum(widths)) / (len(words) - 1)
                    x = left
                    for j, (w, wd) in enumerate(zip(words, widths)):
                        ax.text(x, y, w, ha="left", va="center", fontsize=size, gid=f"{gid}:w{j}")
                        x += wd + gap
                else:
                    x, ha = {"left": (left, "left"), "justify": (left, "left"), "center": ((LEFT + RIGHT) / 2, "center"),
                             "right": (RIGHT, "right")}[b["align"]]
                    ax.text(x, y, line, ha=ha, va="center", fontsize=size, gid=gid)
                if i < len(b["lines"]) - 1:
                    y -= step
            _letter(ax, b["letter"], first)
            y -= 0.46
            continue
        if k in ("bullets", "numbered"):
            first = y
            for i, item in enumerate(b["items"]):
                mark = "•" if k == "bullets" else f"{i + 1}."
                # the mark on the margin, so a list never reads as an indented paragraph
                ax.text(LEFT, y, mark, ha="left", va="center", fontsize=size, gid=f"{b['letter']}:mark{i}")
                ax.text(LEFT + 0.3, y, item, ha="left", va="center", fontsize=size)
                y -= 0.27
            _letter(ax, b["letter"], first)
            y -= 0.22
            continue
        rows = b["rows"]  # the table
        cols = len(rows[0])
        w = (RIGHT - LEFT) / cols
        top = y + 0.15
        for r, row in enumerate(rows):
            for cidx, cell in enumerate(row):
                ax.add_patch(Rectangle((LEFT + cidx * w, top - (r + 1) * 0.3), w, 0.3, facecolor=FILL_2 if r == 0 else "white",
                                       edgecolor=INK, linewidth=0.8, gid=f"{b['letter']}:r{r}:col{cidx}"))
                ax.text(LEFT + cidx * w + 0.08, top - (r + 0.5) * 0.3, cell, ha="left", va="center", fontsize=9,
                        fontweight="bold" if r == 0 else "normal")
        _letter(ax, b["letter"], top - 0.15)
        y = top - len(rows) * 0.3 - 0.3
    ax.axis("off")
    return fig


# --- drawing: the presentation window --------------------------------------------------------------

def _draw_slides(p: dict):
    W, H = 10.0, 6.6
    fig, ax = new_figure(9.4, 9.4 * (H + 0.1) / (W + 0.7))
    parts = p["parts"]
    tag = lambda part, x, y: (ax.add_patch(Circle((x, y), 0.2, facecolor="white", edgecolor=INK, linewidth=1.2, zorder=5)),  # noqa: E731
                              ax.text(x, y, parts[part], ha="center", va="center", fontsize=11, fontweight="bold", zorder=6))
    ax.add_patch(Rectangle((0, 0), W, H, facecolor="white", edgecolor=INK, linewidth=1.3))
    # the ribbon: its tabs, and a row of buttons under them
    ax.add_patch(Rectangle((0, H - 1.0), W, 1.0, facecolor=FILL_2, edgecolor=INK, linewidth=1.0))
    x = 0.25
    for tab in ("File", "Home", "Insert", "Design", "Transitions", "Animations", "Slide Show", "View"):
        ax.text(x, H - 0.25, tab, ha="left", va="center", fontsize=9, fontweight="bold" if tab == "Home" else "normal")
        x += 0.25 + 0.085 * len(tab) + 0.3
    for k in range(14):
        ax.add_patch(Rectangle((0.3 + k * 0.62, H - 0.85), 0.42, 0.38, facecolor="white", edgecolor="#777777", linewidth=0.7))
    tag("ribbon", W + 0.35, H - 0.5)
    # the thumbnail pane: every slide, small and numbered, the one being edited outlined thick
    n = len(p["titles"])
    pane_top, pane_bottom = H - 1.1, 0.6
    ax.add_patch(Rectangle((0, pane_bottom), 2.0, pane_top - pane_bottom, facecolor="#f4f6f8", edgecolor=INK, linewidth=0.9))
    th = (pane_top - pane_bottom - 0.1) / 7
    for i in range(n):
        ty = pane_top - 0.08 - (i + 1) * th
        current = i + 1 == p["current"]
        ax.add_patch(Rectangle((0.55, ty + 0.06), 1.25, th - 0.12, facecolor="white", edgecolor=INK,
                               linewidth=2.0 if current else 0.8))
        ax.add_patch(Rectangle((0.7, ty + th - 0.22), 0.95, 0.06, facecolor=FILL, edgecolor="none"))
        for k in range(2):
            ax.add_patch(Rectangle((0.7, ty + 0.16 + k * 0.1), 0.7 - 0.2 * k, 0.03, facecolor="#aaaaaa", edgecolor="none"))
        ax.text(0.3, ty + th / 2, str(i + 1), ha="center", va="center", fontsize=9)
    tag("thumbnail pane", -0.35, (pane_top + pane_bottom) / 2)
    # the slide pane: the slide being edited
    sx0, sx1, sy0, sy1 = 2.4, W - 0.4, 1.75, H - 1.3
    ax.add_patch(Rectangle((sx0, sy0), sx1 - sx0, sy1 - sy0, facecolor="white", edgecolor=INK, linewidth=1.3))
    title = p["titles"][p["current"] - 1]
    ax.text((sx0 + sx1) / 2, sy1 - 0.45, title, ha="center", va="center", fontsize=14, fontweight="bold")
    for i, b in enumerate(p["bullets"]):
        yy = sy1 - 1.0 - i * 0.42
        ax.text(sx0 + 0.6, yy, "•", ha="left", va="center", fontsize=12)
        ax.text(sx0 + 0.9, yy, b, ha="left", va="center", fontsize=11.5)
    ax.plot([sx1, W + 0.15], [(sy0 + sy1) / 2] * 2, color=INK, linewidth=1.0)  # a leader from the letter to the slide
    tag("slide pane", W + 0.35, (sy0 + sy1) / 2)
    # the notes pane
    ax.add_patch(Rectangle((2.2, 0.6), W - 2.2, 0.9, facecolor="white", edgecolor=INK, linewidth=0.9))
    ax.text(2.4, 1.05, p["notes"], ha="left", va="center", fontsize=9.5, color="#333333")
    tag("notes pane", W + 0.35, 1.05)
    # the status bar
    ax.add_patch(Rectangle((0, 0), W, 0.45, facecolor=FILL_2, edgecolor=INK, linewidth=0.9))
    ax.text(0.25, 0.225, f"Slide {p['current']} of {n}", ha="left", va="center", fontsize=9)
    ax.text(W - 0.25, 0.225, "English (Rwanda)", ha="right", va="center", fontsize=9)
    tag("status bar", -0.35, 0.225)
    ax.set_xlim(-0.65, W + 0.65)
    ax.set_ylim(-0.05, H + 0.05)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def draw(p: dict):
    return _draw_page(p) if p["sub"] == "page" else _draw_slides(p)


# --- questions --------------------------------------------------------------------------------------

TALK = {"school": "about the science fair", "coop": "about the harvest plan", "clinic": "about malaria",
        "library": "about the library rules"}
WHAT = {"school": "the school newsletter", "coop": "the cooperative's notice", "clinic": "the health centre's leaflet",
        "library": "the library's rules"}
VERBS = ["typed", "formatted", "laid out", "designed"]
SETTINGS = ["in an ICT lesson", "for homework", "for a class test", "at the computer club", "on the office computer"]


def _has(b: dict, ask: str) -> bool:
    return {"centre-aligned text": b.get("align") == "center", "right-aligned text": b.get("align") == "right",
            "justified text": b.get("align") == "justify", "text with double line spacing": b.get("spacing") == 2,
            "an indented paragraph": b.get("indent", False), "the header": b["kind"] == "header",
            "the footer": b["kind"] == "footer"}[ask]


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    if p["sub"] == "slides":
        part = rng.choice(PARTS)
        letters = sorted(p["parts"].values())
        key = p["parts"][part]
        options = sorted([key] + rng.sample([x for x in letters if x != key], 3))
        return [Question("mcq", f"{who} made a presentation {TALK[p['context']]} {rng.choice(SETTINGS)}. Which letter shows "
                                f"the {part}?", str(options.index(key)), options),
                count("How many slides are in the presentation?", len(p["titles"]), "slides"),
                count("How many bullet points are on the slide being edited?", len(p["bullets"]), "bullet points")]
    blocks = p["blocks"]
    ask = p["ask"]
    key = next(b["letter"] for b in blocks if _has(b, ask))
    others = rng.sample([b["letter"] for b in blocks if b["letter"] != key], 3)
    options = sorted([key] + others)
    out = [Question("mcq", f"{who} {rng.choice(VERBS)} {WHAT[p['context']]} {rng.choice(SETTINGS)}. Which letter shows "
                           f"{ask}?", str(options.index(key)), options)]
    lst = next(b for b in blocks if b["kind"] in ("bullets", "numbered"))
    if lst["kind"] == "bullets":
        out.append(count("How many bullet points are in the list?", len(lst["items"]), "bullet points"))
    else:
        out.append(count("How many items are in the numbered list?", len(lst["items"]), "items"))
    table = next(b for b in blocks if b["kind"] == "table")
    if rng.random() < 0.5:
        out.append(count("How many columns does the table have?", len(table["rows"][0]), "columns"))
    else:
        out.append(count("How many rows does the table have, including its heading row?", len(table["rows"]), "rows"))
    return out
