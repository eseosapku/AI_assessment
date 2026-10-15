"""Web pages (UP, LS, AL): a short HTML snippet in a code panel, a table, a list, a link, an image with alt text, or
CSS setting colours and font sizes, either beside what the browser shows or in place of it, and below them a URL broken
into four lettered parts: protocol, domain name, path and file name. Rwandan sites: a Huye library, a Musanze
cooperative, a Kigali coding club, a Rubavu craft shop and a Nyanza school.

From the code alone: what the browser shows in a table cell, how many rows the table has, the number beside a list item,
how many bullet points, a link's words and the file it opens, an image's alt text and width, and the colour or font size
CSS gives a line. Beside the output: which tag makes what is shown. And which lettered part of the URL is the protocol,
domain name, path or file name, or what its domain name is.

Every key is read from the snippet's own elements; the answer test parses the HTML with Python's html.parser.
"""
from __future__ import annotations

import random

from matplotlib.patches import Polygon, Rectangle

from ..core import INK, NAMES, mcq, new_figure, short

ID = "web_page"
KIND = "cs.code"
SUBJECT = "computing"
BANDS = ("UP", "LS", "AL")
CONCEPTS = tuple(f"computing.{c}" for c in ("web-development-layers", "domain-names", "internet-world-wide-web", "hyperlink"))
# A topic whose sections the book lists is reached only if one names what this figure teaches.
NEEDS = r"web|html|url|uniform resource|hyperlink|css|browser|internet|search"
AVOID = r"security|spyware|hacking|firewall|python|database|spreadsheet|e-safety|safety|ethic|arcgis|document|word processing"
SITES = {
    "library": ("www.huyelibrary.rw", "a Huye library's website", "Huye Library", ["books", "news", "events"],
                "Open Monday to Saturday"),
    "coop": ("www.musanzecoop.rw", "a Musanze cooperative's website", "Musanze Cooperative", ["prices", "news", "members"],
             "Prices change each week"),
    "club": ("www.kigalicodingclub.rw", "a Kigali coding club's website", "Kigali Coding Club", ["events", "clubs", "projects"],
             "We meet on Fridays"),
    "shop": ("shop.rubavucrafts.rw", "a Rubavu craft shop's website", "Rubavu Crafts", ["shop", "baskets", "news"],
             "Baskets made by hand"),
    "school": ("learn.nyanzaschool.ac.rw", "a Nyanza school's learning site", "Nyanza School", ["notes", "clubs", "s4"],
               "Choir practice at four"),
}
FILES = ["index.html", "new.html", "today.html", "list.html", "contact.html", "home.html"]
# Each piece of content, with the sites it belongs on.
TABLES = {
    "prices": ("Prices at Musanze market", ["Crop", "Price (Frw/kg)"], ["coop"]),
    "league": ("School football league", ["Team", "Played", "Points"], ["school"]),
    "hours": ("Library opening hours", ["Day", "Opens", "Closes"], ["library"]),
    "sales": ("Baskets sold this week", ["Basket", "Price (Frw)", "Sold"], ["shop"]),
}
LISTS = {
    "clubs": ("Clubs at our school", ["Coding club", "Debate", "Football", "Choir", "Drama"], ["school"]),
    "borrow": ("How to borrow a book", ["Choose a book", "Show your card", "Sign the form", "Take it home", "Return it on time"],
               ["library"]),
    "trip": ("Bring on the trip", ["Water bottle", "Raincoat", "Lunch", "Notebook", "Pencil"], ["school", "club"]),
    "lunch": ("Lunch this week", ["Rice and beans", "Matoke", "Ugali", "Fruit", "Milk"], ["school"]),
    "projects": ("Our projects", ["Robot car", "Weather app", "Quiz game", "School map", "Music player"], ["club"]),
    "crops": ("Crops we buy", ["Potatoes", "Beans", "Maize", "Wheat", "Peas"], ["coop"]),
    "baskets": ("Our baskets", ["Round basket", "Fruit bowl", "Peace basket", "Bread basket", "Small box"], ["shop"]),
}
LINKS = [("library rules", "rules.html", "Read the", "before you borrow.", ["library"]),
         ("price list", "prices.html", "See the", "for this week.", ["coop", "shop"]),
         ("exam timetable", "timetable.html", "Check the", "for S4.", ["school"]),
         ("photo gallery", "photos.html", "Visit our", "from the trip.", ["club", "school", "shop"]),
         ("sign-up form", "join.html", "Fill in the", "to join the club.", ["club"]),
         ("member list", "members.html", "Find your name on the", "today.", ["coop", "club"])]
IMAGES = [("gorilla.jpg", "A gorilla in the forest", "Our trip to the volcanoes", ["school", "club"]),
          ("lake.jpg", "Boats on Lake Kivu", "A day at the lake", ["school", "shop"]),
          ("coffee.jpg", "Coffee beans drying", "Our coffee", ["coop"]),
          ("drums.jpg", "Dancers with drums", "Culture day", ["school"]),
          ("baskets.jpg", "Woven baskets for sale", "New baskets", ["shop"]),
          ("reading.jpg", "Children reading books", "Reading club", ["library"]),
          ("robot.jpg", "Our robot car", "Project day", ["club"])]
COLOURS = ["green", "navy", "red", "purple", "maroon", "teal", "orange", "blue", "brown"]
CODE_PT = 9.0
LINE_IN = 0.21  # inches between code lines


def _url(rng: random.Random, site: str, file: str | None = None) -> list[str]:
    host, _, _, folders, _ = SITES[site]
    scheme = "https" if rng.random() < 0.75 else "http"
    return [f"{scheme}://", host, f"/{rng.choice(folders)}/", file or rng.choice(FILES)]


def _table(rng: random.Random) -> dict:
    key = rng.choice(list(TABLES))
    title, head, sites = TABLES[key]
    n = rng.randint(2, 4)
    if key == "prices":
        crops = rng.sample(["Beans", "Maize", "Potatoes", "Rice", "Bananas", "Cassava", "Sorghum"], n)
        rows = [[c, str(x)] for c, x in zip(crops, rng.sample(range(200, 1501, 50), n))]
    elif key == "league":
        teams = rng.sample(["Huye", "Nyanza", "Rubavu", "Musanze", "Kayonza", "Rusizi"], n)
        played = rng.randint(4, 8)
        rows = [[t, str(played), str(rng.randint(0, 3 * played))] for t in teams]
    elif key == "hours":
        start = rng.randint(0, 6 - n)
        days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][start:start + n]
        rows = [[d, rng.choice(["08:00", "08:30", "09:00"]), rng.choice(["16:00", "17:00", "18:00"])] for d in days]
    else:
        kinds = rng.sample(["Small", "Medium", "Large", "Round", "Fruit bowl"], n)
        rows = [[k, str(x), str(rng.randint(2, 30))] for k, x in zip(kinds, rng.sample(range(3000, 25001, 500), n))]
    html = [f"<h2>{title}</h2>", '<table border="1">',
            "  <tr>" + "".join(f"<th>{h}</th>" for h in head) + "</tr>"]
    html += ["  <tr>" + "".join(f"<td>{x}</td>" for x in r) + "</tr>" for r in rows]
    html.append("</table>")
    return {"site": rng.choice(sites), "html": html, "data": {"title": title, "head": head, "rows": rows},
            "cell": [rng.randint(2, n + 1), rng.randint(1, len(head))]}


def _list(rng: random.Random) -> dict:
    key = rng.choice(list(LISTS))
    title, pool, sites = LISTS[key]
    n = rng.randint(3, 5)
    items = pool[:n] if key == "borrow" else rng.sample(pool, n)
    tag = "ol" if key == "borrow" or rng.random() < 0.5 else "ul"
    start = rng.choice([1, 1, 2, 3, 4, 5]) if tag == "ol" else 1
    html = [f"<h3>{title}</h3>", f'<ol start="{start}">' if tag == "ol" and start != 1 else f"<{tag}>"]
    html += [f"  <li>{x}</li>" for x in items] + [f"</{tag}>"]
    return {"site": rng.choice(sites), "html": html, "data": {"title": title, "tag": tag, "start": start, "items": items},
            "item": rng.randrange(n)}


def _link(rng: random.Random) -> dict:
    words, file, before, after, sites = rng.choice(LINKS)
    site = rng.choice(sites)
    parts = _url(rng, site, file)
    heading = SITES[site][2]
    html = [f"<h2>{heading}</h2>", f"<p>{before}", f'  <a href="{"".join(parts)}">', f"  {words}</a> {after}", "</p>"]
    return {"site": site, "parts": parts, "html": html,
            "data": {"title": heading, "before": before, "words": words, "after": after}}


def _image(rng: random.Random) -> dict:
    src, alt, title, sites = rng.choice(IMAGES)
    folder = rng.choice(["images", "photos", "pictures"])
    w = rng.choice(range(200, 481, 20))
    h = rng.choice([x for x in range(160, 361, 20) if x < w])
    html = [f"<h2>{title}</h2>", f'<img src="{folder}/{src}" alt="{alt}"', f'     width="{w}" height="{h}">',
            "<p>Photo by the school club</p>"]
    return {"site": rng.choice(sites), "html": html, "data": {"title": title, "src": src, "alt": alt, "width": w, "height": h}}


def _css(rng: random.Random) -> dict:
    site = rng.choice(list(SITES))
    c1, c2 = rng.sample(COLOURS, 2)
    big, small = rng.choice(range(24, 37, 2)), rng.choice(range(12, 19, 2))
    heading, line = SITES[site][2], SITES[site][4]
    rules = [f"  h1 {{ color: {c1}; font-size: {big}px; }}", f"  p  {{ color: {c2}; font-size: {small}px; }}"]
    if rng.random() < 0.5:
        rules.reverse()
    html = ["<style>", *rules, "</style>", f"<h1>{heading}</h1>", f"<p>{line}</p>"]
    return {"site": site, "html": html, "data": {"h1": [heading, c1, big], "p": [line, c2, small]},
            "colour_of": rng.choice(["h1", "p"]), "size_of": rng.choice(["h1", "p"])}


def sample(rng: random.Random) -> dict:
    kind = rng.choice(["table", "list", "link", "image", "css"])
    body = {"table": _table, "list": _list, "link": _link, "image": _image, "css": _css}[kind](rng)
    parts = body.pop("parts", None) or _url(rng, body["site"])
    mode = "code" if kind == "css" else rng.choice(["code", "both"])
    role = rng.choice(["protocol", "domain name", "path", "file name"])
    return {"band": rng.choice(BANDS), "kind": kind, "mode": mode, "url": "".join(parts), "parts": parts, "role": role,
            "ask_domain": role != "domain name" and rng.random() < 0.5, **body}


# --- drawing: positions in inches, on axes that fill the figure ----------------------------------

def _width(fig, t) -> float:
    return t.get_window_extent(fig.canvas.get_renderer()).width / fig.dpi


def _code(ax, fig, lines: list, x: float, y: float) -> tuple[float, float]:
    """The code panel at (x, y), its top left; its width and height."""
    ax.text(x, y, "HTML", ha="left", va="bottom", fontsize=10, fontweight="bold")
    ts = [ax.text(x + 0.15, y - 0.25 - k * LINE_IN, line, ha="left", va="center", fontsize=CODE_PT, family="monospace", zorder=3)
          for k, line in enumerate(lines)]
    w = max(_width(fig, t) for t in ts) + 0.3
    h = len(lines) * LINE_IN + 0.15
    ax.add_patch(Rectangle((x, y - h - 0.04), w, h, facecolor="#f4f6f8", edgecolor=INK, linewidth=1.0, zorder=1))
    return w, h + 0.3


def _output(ax, fig, p: dict, x: float, y: float) -> tuple[float, float]:
    """What the browser shows, drawn at (x, y), its top left; its width and height."""
    ax.text(x, y, "What the browser shows", ha="left", va="bottom", fontsize=10, fontweight="bold")
    d, kind = p["data"], p["kind"]
    cx, cy = x + 0.2, y - 0.35
    ax.text(cx, cy, d["title"], ha="left", va="center", fontsize=12 if kind != "list" else 11, fontweight="bold")
    right = cx + _width(fig, ax.texts[-1])
    cy -= 0.45
    if kind == "table":
        rows = [d["head"]] + d["rows"]
        widths = []
        for c in range(len(d["head"])):
            probe = [ax.text(0, 0, r[c], fontsize=10, fontweight="bold" if i == 0 else "normal") for i, r in enumerate(rows)]
            widths.append(max(_width(fig, t) for t in probe) + 0.25)
            for t in probe:
                t.remove()
        rh = 0.32
        for i, r in enumerate(rows):
            xx = cx
            for c, v in enumerate(r):
                ax.add_patch(Rectangle((xx, cy - rh * (i + 1)), widths[c], rh, facecolor="white", edgecolor=INK, linewidth=0.9))
                if i == 0:  # a browser centres heading cells and makes them bold
                    ax.text(xx + widths[c] / 2, cy - rh * (i + 0.5), v, ha="center", va="center", fontsize=10, fontweight="bold")
                else:
                    ax.text(xx + 0.12, cy - rh * (i + 0.5), v, ha="left", va="center", fontsize=10)
                xx += widths[c]
        right = max(right, xx)
        cy -= rh * len(rows)
    elif kind == "list":
        for k, item in enumerate(d["items"]):
            mark = f"{d['start'] + k}." if d["tag"] == "ol" else "•"
            t = ax.text(cx + 0.15, cy - k * 0.3, f"{mark}  {item}", ha="left", va="center", fontsize=10)
            right = max(right, cx + 0.15 + _width(fig, t))
        cy -= len(d["items"]) * 0.3 - 0.1
    elif kind == "link":
        t1 = ax.text(cx, cy, d["before"] + " ", ha="left", va="center", fontsize=10)
        bar = ax.text(0, 0, "|", fontsize=10)
        gap = _width(fig, ax.text(0, 0, d["before"] + " |", fontsize=10)) - _width(fig, bar)
        ax.texts[-1].remove()
        bar.remove()
        t1.set_text(d["before"])
        t2 = ax.text(cx + gap, cy, d["words"], ha="left", va="center", fontsize=10, color="#1a0dab")
        w2 = _width(fig, t2)
        ax.plot([cx + gap, cx + gap + w2], [cy - 0.1, cy - 0.1], color="#1a0dab", linewidth=0.9)
        space = gap - _width(fig, t1)
        t3 = ax.text(cx + gap + w2 + space, cy, d["after"], ha="left", va="center", fontsize=10)
        right = max(right, cx + gap + w2 + space + _width(fig, t3))
        cy -= 0.2
    elif kind == "image":
        scale = 1 / 160  # 160 pixels to the inch on the page
        w, h = d["width"] * scale, d["height"] * scale
        top = cy + 0.15
        ax.add_patch(Rectangle((cx, top - h), w, h, facecolor="#dfe7ee", edgecolor=INK, linewidth=0.9))
        ax.add_patch(Polygon([(cx, top - h), (cx + w * 0.35, top - h * 0.45), (cx + w * 0.55, top - h * 0.7),
                              (cx + w * 0.75, top - h * 0.35), (cx + w, top - h)], closed=True, facecolor="#8a9a8a",
                             edgecolor="none"))
        t = ax.text(cx, top - h - 0.25, "Photo by the school club", ha="left", va="center", fontsize=10)
        right = max(right, cx + w, cx + _width(fig, t))
        cy = top - h - 0.35
    w = right - x + 0.25
    h = y - cy + 0.2
    ax.add_patch(Rectangle((x, y - h), w, h, facecolor="none", edgecolor=INK, linewidth=1.0))
    return w, h


def _address(ax, fig, p: dict, x: float, y: float) -> float:
    """The URL whole, then in four lettered parts; the panel's height."""
    title = "Address the link opens (URL)" if p["kind"] == "link" else "Address of this page (URL)"
    ax.text(x, y, title, ha="left", va="bottom", fontsize=10, fontweight="bold")
    ax.text(x + 0.15, y - 0.27, p["url"], ha="left", va="center", fontsize=10.5, family="monospace")
    ax.text(x + 0.15, y - 0.62, "The same URL in its four parts:", ha="left", va="center", fontsize=9.5, color="#333333")
    xx, uy = x + 0.15, y - 0.97
    for k, part in enumerate(p["parts"]):
        t = ax.text(xx, uy, part, ha="left", va="center", fontsize=10.5, family="monospace")
        w = _width(fig, t)
        ax.plot([xx + 0.02, xx + 0.02, xx + w - 0.02, xx + w - 0.02], [uy - 0.15, uy - 0.22, uy - 0.22, uy - 0.15],
                color=INK, linewidth=1.0)
        ax.text(xx + w / 2, uy - 0.38, "ABCD"[k], ha="center", va="center", fontsize=10.5, fontweight="bold")
        xx += w + 0.12
    return 1.5


def draw(p: dict):
    fig, ax = new_figure(9.0, 5.0)
    ax.set_position([0, 0, 1, 1])
    ax.axis("off")
    cw, ch = _code(ax, fig, p["html"], 0.0, 0.0)
    width, height = cw, ch
    if p["mode"] == "both":
        ow, oh = _output(ax, fig, p, cw + 0.35, 0.0)
        width, height = cw + 0.35 + ow, max(ch, oh)
    height += _address(ax, fig, p, 0.0, -height - 0.3) + 0.3
    width = max(width, 5.2)
    fig.set_size_inches(width + 0.2, height + 0.45)
    ax.set_xlim(-0.1, width + 0.1)
    ax.set_ylim(-height - 0.1, 0.35)
    return fig


SETTINGS = ["in an ICT lesson", "for homework", "for a class test", "at the coding club", "on a revision card"]
VERBS = ["writes this HTML for", "builds this page of", "tests this page of", "checks this code for"]


def _html_questions(p: dict, rng: random.Random) -> list:
    d, kind, both = p["data"], p["kind"], p["mode"] == "both"
    if kind == "table":
        rows = [d["head"]] + d["rows"]
        n = len(rows)
        count = short("How many rows does the table have, counting the heading row?", n, [f"{n} rows"])
        if both:
            return [mcq("Which tag makes the bold cells in the first row of the table?", "<th>", ["<td>", "<tr>", "<h2>"], rng),
                    count]
        r, c = p["cell"]
        v = rows[r - 1][c - 1]
        return [short(f"What does the browser show in row {r}, column {c} of the table, counting the heading row as row 1?", v,
                      [v, v.lower()]), count]
    if kind == "list":
        if d["tag"] == "ol":
            item = d["items"][p["item"]]
            n = d["start"] + p["item"]
            q = short(f"What number does the browser show beside '{item}'?", n, [f"{n}."])
        else:
            n = len(d["items"])
            q = short("How many bullet points does the browser show?", n, [f"{n} bullet points", f"{n} items"])
        if both:
            way = "numbered" if d["tag"] == "ol" else "bulleted"
            return [mcq(f"Which tag makes the {way} list?", f"<{d['tag']}>",
                        ["<ul>" if d["tag"] == "ol" else "<ol>", "<li>", "<h3>"], rng), q]
        return [q]
    if kind == "link":
        file = p["parts"][3]
        opens = short("Which file does the link open?", file, [file])
        if both:
            return [mcq(f"Which tag turns '{d['words']}' into a link?", "<a>", ["<p>", "<link>", "<href>"], rng), opens]
        return [short("Which words does the browser show as the link?", d["words"], [d["words"], d["words"].lower()]), opens]
    if kind == "image":
        w = d["width"]
        wide = short("How wide is the picture on the page, in pixels?", w, [f"{w} pixels", f"{w}px", f"{w} px"])
        if both:
            return [mcq("Which tag puts the picture on the page?", "<img>", ["<src>", "<alt>", "<p>"], rng), wide]
        return [short(f"If {d['src']} cannot be found, what text does the browser show in its place?", d["alt"],
                      [d["alt"], d["alt"].lower()]), wide]
    text, colour, _ = d[p["colour_of"]]
    stext, _, size = d[p["size_of"]]
    return [short(f"What colour does the browser show '{text}' in?", colour, [colour, colour.capitalize()]),
            short(f"What font size, in pixels, does the browser use for '{stext}'?", size, [f"{size}px", f"{size} px",
                                                                                          f"{size} pixels"])]


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    qs = _html_questions(p, rng)
    first = f"{who} {rng.choice(VERBS)} {SITES[p['site']][1]} {rng.choice(SETTINGS)}. "
    q0 = qs[0]
    q0.stem = first + q0.stem
    role = p["role"]
    letter = "ABCD"[["protocol", "domain name", "path", "file name"].index(role)]
    q = mcq(f"Which labelled part of the URL is the {role}?", letter, [x for x in "ABCD" if x != letter], rng)
    q.options, q.answer = list("ABCD"), str("ABCD".index(letter))  # the letters in their order, as on a paper
    qs.append(q)
    if p["ask_domain"]:
        host = p["parts"][1]
        qs.append(short("What is the domain name in the URL?", host, [host, host.removeprefix("www.")]))
    return qs
