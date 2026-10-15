"""A folder tree in a file explorer (LS, UP): a drive, "Local Disk (D:)", opened out as the navigation pane of a file
explorer shows it, every folder expanded, each row a folder or a file with its icon, and dotted guide lines showing
what holds what. Three owners: a student's school work, a Kigali shop's records and a Musanze cooperative's files.

- What is the path to a file two or three folders down? The options are a balanced two-by-two: the right folder or
  the folder beside it, and the full path or one that skips a level, so the key is never the option in the middle.
- How many files are stored directly in a folder (not in its subfolders), or anywhere inside one (with its
  subfolders, which then hold files)?
- Which folder holds a file? The wrong options are the folder above it, a folder beside it and a folder below.

Every folder name and every file name appears once in the tree, so each question has one answer.
"""
from __future__ import annotations

import random

from matplotlib.patches import Polygon, Rectangle

from ..core import FILL_2, INK, NAMES, count, mcq, new_figure

ID = "folder_tree"
KIND = "cs.structure"
SUBJECT = "computing"
BANDS = ("LS", "UP")
CONCEPTS = tuple(f"computing.{c}" for c in ("file-management", "cloud-storage", "desktop"))
# A topic whose sections the book lists is reached only if its name or a section names files, folders or a drive.
NEEDS = r"\bfiles?\b|folder|director|navigation|explorer|\bdrive\b"
# Exporting a spreadsheet, GIS layers, programs that read files, and file compression are other lessons.
AVOID = (r"gis\b|arcgis|export|java|c\+\+|file handling|database|compression|file transfer|spreadsheet|classroom|"
         r"word processing|mail merge|proofing|google (docs|sheets|slides|form)|data management|emerging|productivity")

CONTEXTS = {
    "school": {
        "main": "School",
        "subs": {"Maths": ["fractions.docx", "algebra.pdf", "graphs.xlsx", "shapes.pptx"],
                 "Science": ["plants.docx", "magnets.pptx", "results.xlsx", "cells.pdf"],
                 "English": ["poem.docx", "essay.docx", "story.pdf", "letter.docx"],
                 "Kinyarwanda": ["imigani.docx", "inkuru.pdf", "ibisakuzo.docx"],
                 "ICT": ["budget.xlsx", "website.html", "logo.png", "survey.xlsx"],
                 "Geography": ["rivers.pptx", "climate.xlsx", "map.png", "rocks.docx"]},
        "deep": {"Homework": ["week1.docx", "week2.docx", "week3.docx"], "Tests": ["test1.pdf", "test2.pdf"],
                 "Notes": ["term1.docx", "term2.docx"], "Projects": ["project.pptx", "poster.png"]},
        "others": {"Photos": ["trip.jpg", "family.jpg", "garden.png"], "Music": ["song.mp3", "drums.mp3", "choir.mp3"],
                   "Downloads": ["timetable.pdf", "form.pdf"]},
        "loose": ["cv.docx", "todo.txt"],
    },
    "shop": {
        "main": "Shop",
        "subs": {"Sales": ["daily_sales.xlsx", "receipts.pdf", "customers.xlsx"],
                 "Stock": ["stock_list.xlsx", "orders.docx", "suppliers.xlsx"],
                 "Staff": ["payroll.xlsx", "contracts.docx", "rota.docx"],
                 "Marketing": ["poster.png", "flyer.pdf", "prices.xlsx"],
                 "Accounts": ["ledger.xlsx", "bank.pdf", "budget.xlsx"]},
        "deep": {"January": ["jan_report.docx", "jan_sales.xlsx"], "February": ["feb_report.docx", "feb_sales.xlsx"],
                 "March": ["mar_report.docx", "mar_sales.xlsx"]},
        "others": {"Photos": ["shopfront.jpg", "team.jpg", "opening.jpg"], "Letters": ["rra_letter.pdf", "bank_letter.docx"],
                   "Backup": ["backup_may.zip", "backup_june.zip"]},
        "loose": ["notes.txt", "logo.png"],
    },
    "coop": {
        "main": "Cooperative",
        "subs": {"Members": ["members.xlsx", "fees.xlsx", "rules.pdf"],
                 "Harvest": ["potatoes.xlsx", "maize.xlsx", "prices.docx"],
                 "Meetings": ["agenda.docx", "minutes.docx", "attendance.xlsx"],
                 "Training": ["manure.pptx", "seeds.pdf", "irrigation.docx"],
                 "Loans": ["loans.xlsx", "repayments.xlsx", "forms.pdf"]},
        "deep": {"Kinigi": ["kinigi_farmers.xlsx", "kinigi_yield.xlsx"], "Busogo": ["busogo_farmers.xlsx", "busogo_yield.xlsx"],
                 "Nyange": ["nyange_farmers.xlsx", "nyange_yield.xlsx"]},
        "others": {"Photos": ["field.jpg", "meeting.jpg", "truck.jpg"], "Letters": ["district.pdf", "bank.docx"],
                   "Reports": ["annual.pdf", "audit.pdf"]},
        "loose": ["contacts.xlsx", "readme.txt"],
    },
}
ROOT = "D:"


def _folder(name: str, files=(), folders=()) -> dict:
    return {"name": name, "folders": list(folders), "files": list(files)}


def walk(node: dict, trail: tuple = ()):
    """Every folder with its path from the drive, the drive first."""
    here = trail + (node["name"],)
    yield here, node
    for f in node["folders"]:
        yield from walk(f, here)


def every_file(node: dict) -> list[str]:
    return list(node["files"]) + [x for f in node["folders"] for x in every_file(f)]


def sample(rng: random.Random) -> dict:
    band = rng.choice(BANDS)
    while True:
        context = rng.choice(sorted(CONTEXTS))
        c = CONTEXTS[context]
        subs = rng.sample(sorted(c["subs"]), rng.randint(2, 3))
        holder = rng.choice(subs)
        deep = rng.sample(sorted(c["deep"]), 2)
        sub_nodes = []
        for s in subs:
            pool = c["subs"][s]
            if s == holder:
                kids = [_folder(d, rng.sample(c["deep"][d], rng.randint(1, 2))) for d in deep]
                sub_nodes.append(_folder(s, rng.sample(pool, rng.randint(0, 2)), kids))
            else:
                sub_nodes.append(_folder(s, rng.sample(pool, rng.randint(1, 3))))
        main = _folder(c["main"], rng.sample(c["loose"], rng.randint(0, 1)), sub_nodes)
        others = [_folder(o, rng.sample(c["others"][o], rng.randint(1, 2))) for o in rng.sample(sorted(c["others"]),
                                                                                                rng.randint(1, 2))]
        tops = [main] + others
        rng.shuffle(tops)
        tree = _folder(ROOT, [], tops)
        files = every_file(tree)
        rows = sum(1 + len(n["files"]) for _, n in walk(tree))
        if len(set(files)) != len(files) or rows > 19:
            continue
        where = {f: path for path, n in walk(tree) for f in n["files"]}
        # the path asked: a file two or three folders below the drive, in a folder with a folder beside it
        deep_files = [f for f, path in where.items() if len(path) >= 3]
        target = rng.choice(deep_files)
        # the folder counted: directly, or with its subfolders where they hold files
        scope = rng.choice(["direct", "all"])
        if scope == "all":
            counted = rng.choice([n["name"] for _, n in walk(tree) if n["folders"] and n["name"] != ROOT
                                  and every_file(n) != n["files"]])
        else:
            counted = rng.choice([n["name"] for _, n in walk(tree) if n["files"] and n["name"] != ROOT])
        held = rng.choice([f for f, path in where.items() if f != target and path[-1] != ROOT])
        return {"band": band, "context": context, "tree": tree, "file": target, "folder": counted, "scope": scope,
                "held": held}


# --- drawing ----------------------------------------------------------------------------------------

ROW, STEP = 0.42, 0.5  # a row's height; how far each level is indented
FOLDER_FILL = "#f2d58a"


def _folder_icon(ax, x: float, y: float) -> None:
    ax.add_patch(Polygon([(x, y - 0.12), (x, y + 0.1), (x + 0.1, y + 0.1), (x + 0.14, y + 0.06), (x + 0.32, y + 0.06),
                          (x + 0.32, y - 0.12)], closed=True, facecolor=FOLDER_FILL, edgecolor=INK, linewidth=0.9))


def _file_icon(ax, x: float, y: float) -> None:
    ax.add_patch(Polygon([(x + 0.04, y - 0.14), (x + 0.04, y + 0.14), (x + 0.19, y + 0.14), (x + 0.27, y + 0.06),
                          (x + 0.27, y - 0.14)], closed=True, facecolor="white", edgecolor=INK, linewidth=0.9))
    ax.add_patch(Polygon([(x + 0.19, y + 0.14), (x + 0.19, y + 0.06), (x + 0.27, y + 0.06)], closed=True,
                         facecolor=FILL_2, edgecolor=INK, linewidth=0.7))


def _drive_icon(ax, x: float, y: float) -> None:
    ax.add_patch(Rectangle((x, y - 0.1), 0.34, 0.2, facecolor=FILL_2, edgecolor=INK, linewidth=0.9))
    ax.add_patch(Rectangle((x + 0.24, y - 0.04), 0.05, 0.05, facecolor=INK, edgecolor=INK))


def _chevron(ax, x: float, y: float) -> None:
    """The small "opened" mark before an expanded folder."""
    ax.add_patch(Polygon([(x - 0.07, y + 0.04), (x + 0.07, y + 0.04), (x, y - 0.05)], closed=True, facecolor=INK,
                         edgecolor=INK))


def _rows(node: dict, depth: int = 0) -> list[tuple[int, str, str]]:
    """The tree as the explorer lists it: a folder, then its folders, then its files."""
    out = [(depth, "folder", node["name"])]
    for f in node["folders"]:
        out += _rows(f, depth + 1)
    out += [(depth + 1, "file", x) for x in node["files"]]
    return out


def draw(p: dict):
    rows = _rows(p["tree"])
    height = len(rows) * ROW + 0.95
    fig, ax = new_figure(6.0, 0.62 * height + 0.4)
    top = height - 0.05
    # the window's title bar
    ax.add_patch(Rectangle((0, top - 0.5), 6.6, 0.5, facecolor=FILL_2, edgecolor=INK, linewidth=1.2))
    ax.text(0.15, top - 0.25, "File Explorer: Local Disk (D:)", ha="left", va="center", fontsize=10.5, fontweight="bold")
    ax.add_patch(Rectangle((0, 0), 6.6, top - 0.5, facecolor="white", edgecolor=INK, linewidth=1.2))
    y0 = top - 0.5 - 0.35
    ys = {}
    stack: list[tuple[int, float]] = []  # the open folders above the current row, with the y of their row
    for i, (depth, kind, name) in enumerate(rows):
        y = y0 - i * ROW
        x = 0.25 + depth * STEP
        ys[i] = y
        if depth:  # a guide from the folder above: down its line, then across to this row's icon
            parent_y = next(py for d, py in reversed(stack) if d == depth - 1)
            gx = 0.25 + (depth - 1) * STEP + 0.12
            ax.plot([gx, gx], [parent_y - 0.16, y], color="#888888", linewidth=0.8, linestyle=(0, (1, 1.5)), gid="guide")
            ax.plot([gx, x - 0.02], [y, y], color="#888888", linewidth=0.8, linestyle=(0, (1, 1.5)), gid="guide")
        if kind == "folder":
            while stack and stack[-1][0] >= depth:
                stack.pop()
            stack.append((depth, y))
            if depth == 0:
                _drive_icon(ax, x, y)
                ax.text(x + 0.45, y, "Local Disk (D:)", ha="left", va="center", fontsize=10.5, fontweight="bold")
            else:
                _folder_icon(ax, x, y)
                ax.text(x + 0.42, y, name, ha="left", va="center", fontsize=10.5)
        else:
            _file_icon(ax, x, y)
            ax.text(x + 0.42, y, name, ha="left", va="center", fontsize=10.5)
    ax.set_xlim(-0.05, 6.65)
    ax.set_ylim(-0.05, height + 0.05)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


# --- questions --------------------------------------------------------------------------------------

OWNER = {"school": ["keeps school work on a computer", "saved schoolwork on the school computer",
                    "organised a laptop for school"],
         "shop": ["keeps the shop's records on a computer in Kigali", "organised the files of a shop in Kigali",
                  "manages the computer of a shop in Kigali"],
         "coop": ["keeps the cooperative's files on a computer in Musanze", "organised the files of a Musanze cooperative",
                  "manages the cooperative's computer in Musanze"]}
SETTINGS = ["for an ICT lesson", "for homework", "for a class test", "at the computer club", "on a revision card"]


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    tree = p["tree"]
    where = {f: path for path, n in walk(tree) for f in n["files"]}
    nodes = {n["name"]: (path, n) for path, n in walk(tree)}
    f = p["file"]
    path = where[f]
    parent, above = path[-1], path[-2]
    beside = rng.choice([x["name"] for x in nodes[above][1]["folders"] if x["name"] != parent])
    join = lambda parts: "\\".join(parts)  # noqa: E731
    key = join(path + (f,))
    wrong = [join(path[:-1] + (beside, f)), join(path[:-2] + (parent, f)), join(path[:-2] + (beside, f))]
    # how many files a folder holds
    name = p["folder"]
    node = nodes[name][1]
    if p["scope"] == "direct":
        stem = f"How many files are stored directly in the {name} folder" + (
            ", not counting its subfolders?" if node["folders"] else "?")
        n = len(node["files"])
    else:
        stem = f"How many files are kept anywhere inside the {name} folder, including its subfolders?"
        n = len(every_file(node))
    # which folder holds a file: the folder above it, one beside it, one below it are the slips
    g = p["held"]
    home = where[g]
    holder = home[-1]
    slips = []
    if len(home) >= 3:
        slips.append(home[-2])
    up = nodes[home[-2]][1]
    slips += [x["name"] for x in up["folders"] if x["name"] != holder]
    slips += [x["name"] for x in nodes[holder][1]["folders"]]
    slips += [x for x in nodes if x not in (ROOT, holder) and x not in slips]  # any other folder, last
    seen = []
    for s in slips:
        if s not in seen and s != ROOT:
            seen.append(s)
    return [mcq(f"{who} {rng.choice(OWNER[p['context']])} {rng.choice(SETTINGS)}. What is the path to the file {f}?",
                key, wrong, rng),
            count(stem, n, "files"),
            mcq(f"Which folder holds the file {g}?", holder, seen[:3], rng)]
