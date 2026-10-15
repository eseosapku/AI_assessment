"""A computer system and its parts (P, LS, UP), of two kinds.

- system: a system unit (a tower) in the middle, and round it four to eight devices drawn as simple pictures, each
  named and lettered and joined to the system unit by a cable. Every device is input, output or storage by a fixed
  table a teacher would agree with (a keyboard is input, a printer output, a flash drive storage); devices that are
  both, or argued about (a touch screen), are never drawn, and no two drawn devices do one job (speakers and
  headphones, two storage devices). P lower (Stages 1 and 2): four or five parts and plain words: which letter shows
  the part that does a job (types words, prints on paper, takes a video), and how many parts are joined to the
  computer. P upper (Stages 3 to 6), LS and UP: six to eight devices with a key of what input, output and storage
  devices do; which letter shows an input (output, storage) device, the other options all of other kinds, and how many
  input (output) devices are shown.
- spec (LS, UP): a computer's specification (processor speed, RAM, 32- or 64-bit, the C: drive's free space) beside the
  minimum system requirements of four programs. Exactly one program cannot be installed, for exactly one reason (too
  little RAM by 2 GB or more, too little free space, too slow a processor, or 64-bit only on a 32-bit computer); the
  others meet every minimum with room to spare, never exactly. Which program cannot be installed, how much free space
  is left after installing two of the others, how much of the disk is used, and how much more RAM or space the one
  program would need.
"""
from __future__ import annotations

import random

from matplotlib.patches import Arc, Circle, Ellipse, FancyBboxPatch, Polygon, Rectangle

from ..core import FILL, FILL_2, INK, NAMES, Question, count, mcq, new_figure, short

ID = "computer_parts"
KIND = "diagram.template"
SUBJECT = "computing"
BANDS = ("P", "LS", "UP")
SYSTEM = tuple(f"computing.{c}" for c in ("computer-hardware", "output-devices", "direct-data-entry-devices",
                                          "computer-system-overview", "computer-hardware-software"))
SPEC = tuple(f"computing.{c}" for c in ("software-installation-configuration", "computer-capacity-performance",
                                        "data-storage-measurement", "primary-memory"))
CONCEPTS = SYSTEM + SPEC
# A topic whose sections the book lists is reached only if its name or a section names computer parts, input and
# output, the system unit, hardware, a computer system, installing software or a computer's capacity.
NEEDS = (r"hardware|computer parts|parts of a computer|physical computer|\binput|\boutput|peripheral|system unit|"
         r"components of (a |the )?computer|computer components|main components|computers can|computers and their functions|"
         r"\binstall|requirement|capacity|definition of a computer|computer fundamentals|computer system")
# Topics that share the broad hardware concepts but teach something else: designing, networks, robots, the history
# and kinds of computers, operating systems, keyboard skills, safety.
AVOID = (r"designer|artist|musician|animator|storyteller|innovator|data (collector|controller|designer|boss|expert|analyst|"
         r"scientist|engineer|storyteller)|network|connected|robot|problem solver|control things|computer scientist|"
         r"keyboard and mouse|citizenship|internet safety|game|evolution|generation|classification|booting|interface|"
         r"know your computer|java|tomcat|graphic|multimedia|\bsafe\b|ethical|operating system|financial|"
         r"microprocessor|processor handles|laptop|memory management|process management|file management|applications|"
         r"^introduction$|memory and storage|code cracker|secret|^data$|data management|data representation")

CLASS = {"keyboard": "input", "mouse": "input", "scanner": "input", "webcam": "input", "microphone": "input",
         "monitor": "output", "printer": "output", "speakers": "output", "headphones": "output", "projector": "output",
         "flash drive": "storage", "external hard disk": "storage"}
# What each part does, in words a Primary 1 child knows; each job names its part alone.
JOB = {"keyboard": "you use to type words", "mouse": "moves the pointer", "monitor": "shows pictures and words on a screen",
       "printer": "puts your work on paper", "speakers": "plays sounds out loud", "headphones": "plays sounds that only you can hear",
       "webcam": "takes a video of you", "microphone": "records your voice", "scanner": "copies a page into the computer"}
KEY = [("Input device", "sends data into the computer"), ("Output device", "gives out information from the computer"),
       ("Storage device", "keeps data and programs to use later")]
PROGRAMS = ["PhotoFix", "MapMaker", "TypeTutor", "SoundLab", "GeoMath", "CodeKids", "BudgetBook", "StarAtlas"]
DISKS = [118, 237, 238, 465, 476]


def stages(p: dict) -> tuple[int, int] | None:
    if p["band"] != "P":
        return None
    return (1, 2) if p["level"] == "lower" else (3, 6)


def concepts_for(p: dict) -> tuple[str, ...]:
    return SYSTEM if p["sub"] == "system" else SPEC + ("computing.computer-hardware",)


def avoid_for(p: dict) -> str:
    # A system's input and output devices are not computer maintenance; a specification is not "computer parts".
    return AVOID + (r"|maintenance" if p["sub"] == "system" else r"|computer parts|everywhere|data detective")


def _devices(rng: random.Random, n: int, lower: bool) -> list[str]:
    pool = ["printer", "webcam", "microphone", "speakers", "headphones"] if lower else \
        [d for d in CLASS if d not in ("monitor", "keyboard", "mouse")]
    while True:
        extra = rng.sample(pool, n - 3)
        devs = ["monitor", "keyboard", "mouse"] + extra
        if {"speakers", "headphones"} <= set(devs) or sum(CLASS[d] == "storage" for d in devs) > 1:
            continue
        kinds = [CLASS[d] for d in devs]
        if not lower and (kinds.count("input") < 2 or len(devs) - kinds.count("input") < 3
                          or len(devs) - kinds.count("output") < 3):
            continue
        rng.shuffle(devs)
        return devs


def sample(rng: random.Random) -> dict:
    band = rng.choice(["P", "P", "LS", "UP"])
    sub = "system" if band == "P" or rng.random() < 0.5 else "spec"
    if sub == "system":
        level = rng.choice(["lower", "upper"]) if band == "P" else "upper"
        n = rng.randint(4, 5) if level == "lower" else rng.randint(6, 8)
        devs = _devices(rng, n, level == "lower")
        slots = sorted(rng.sample(range(8), n)) if n < 8 else list(range(8))
        letters = "ABCDEFGH"[:n]
        out = {"band": band, "sub": sub, "level": level, "devices": [[k, d] for k, d in zip(letters, devs)],
               "slots": slots}
        if level != "lower":
            present = {CLASS[d] for d in devs}
            out["ask"] = rng.choice(["input", "output"] + (["storage"] if "storage" in present else []))
            out["count"] = rng.choice(["input", "output"])
        return out
    while True:
        bits = rng.choice([64, 64, 64, 32])
        ram = rng.choice([2, 4]) if bits == 32 else rng.choice([4, 8, 16])
        ghz = round(rng.choice(range(16, 37, 2)) / 10, 1)
        disk = rng.choice(DISKS)
        free = rng.randint(18, 90)
        reasons = (["ram"] if ram <= 8 else []) + ["space", "ghz"] + (["bits"] if bits == 32 else [])
        why = rng.choice(reasons)
        names = rng.sample(PROGRAMS, 4)
        progs = []
        for name in names[:3]:  # these meet every minimum with room to spare
            progs.append([name, rng.choice([r for r in (1, 2, 4, 8) if r < ram]),
                          rng.randint(1, max(1, free // 3)), round(rng.randint(10, int(ghz * 10) - 2) / 10, 1),
                          rng.choice([32, 32, 64]) if bits == 64 else 32])
        bad = [names[3], rng.choice([r for r in (1, 2, 4) if r < ram]), rng.randint(1, max(1, free // 3)),
               round(rng.randint(10, int(ghz * 10) - 2) / 10, 1), 32]
        if why == "ram":
            bad[1] = min(r for r in (4, 8, 16) if r >= ram + 2)  # the next size of memory up
        elif why == "space":
            bad[2] = free + rng.randint(5, 40)
        elif why == "ghz":
            bad[3] = round(ghz + rng.randint(3, 8) / 10, 1)
        else:
            bad[4] = 64
        progs.append(bad)
        rng.shuffle(progs)
        good = [x for x in progs if x[0] != bad[0]]
        a, b = rng.sample(good, 2)
        if a[2] + b[2] >= free or len({x[2] for x in progs}) < 3:
            continue
        return {"band": band, "sub": sub, "computer": {"ram": ram, "ghz": ghz, "bits": bits, "disk": disk, "free": free},
                "programs": progs, "pair": [a[0], b[0]], "why": why}


# --- drawing: the system ----------------------------------------------------------------------------

# Each picture's half-width, and how far it reaches below and above its centre.
EXTENT = {"monitor": (0.6, 0.45, 0.45), "keyboard": (0.75, 0.22, 0.22), "mouse": (0.25, 0.38, 0.38),
          "printer": (0.6, 0.4, 0.45), "speakers": (0.65, 0.4, 0.4), "headphones": (0.45, 0.35, 0.42),
          "webcam": (0.35, 0.45, 0.35), "scanner": (0.7, 0.2, 0.22), "microphone": (0.2, 0.45, 0.42),
          "projector": (0.6, 0.25, 0.25), "flash drive": (0.55, 0.15, 0.15), "external hard disk": (0.45, 0.32, 0.32)}
SLOT_X = [1.3, 3.75, 6.25, 8.7]
TOP_Y, BOTTOM_Y = 6.0, 1.5
TOWER = (5.0, 3.75, 0.9, 1.5)  # centre x, centre y, width, height


def _picture(ax, kind: str, x: float, y: float) -> None:
    lw = 1.3
    P = lambda pts, fc="white", **k: ax.add_patch(Polygon(pts, closed=True, facecolor=fc, edgecolor=INK, linewidth=k.get("lw", lw)))  # noqa: E731
    R = lambda x0, y0, w, h, fc="white", lw_=lw: ax.add_patch(Rectangle((x0, y0), w, h, facecolor=fc, edgecolor=INK, linewidth=lw_))  # noqa: E731
    if kind == "monitor":
        R(x - 0.6, y - 0.12, 1.2, 0.57, FILL_2)
        R(x - 0.08, y - 0.32, 0.16, 0.2, INK)
        R(x - 0.35, y - 0.45, 0.7, 0.13, "white")
    elif kind == "keyboard":
        R(x - 0.75, y - 0.22, 1.5, 0.44)
        for row in range(3):
            for col in range(10):
                R(x - 0.69 + col * 0.139, y + 0.08 - row * 0.12, 0.1, 0.08, FILL_2, 0.6)
        R(x - 0.35, y - 0.19, 0.7, 0.06, FILL_2, 0.6)
    elif kind == "mouse":
        ax.add_patch(Ellipse((x, y), 0.46, 0.74, facecolor="white", edgecolor=INK, linewidth=lw))
        P([(x, y + 0.37), (x, y + 0.08)], lw=1.0)
        P([(x - 0.22, y + 0.08), (x + 0.22, y + 0.08)], lw=1.0)
    elif kind == "printer":
        R(x - 0.3, y + 0.1, 0.6, 0.35)
        R(x - 0.6, y - 0.28, 1.2, 0.42, FILL)
        R(x - 0.36, y - 0.4, 0.72, 0.14)
    elif kind == "speakers":
        for dx in (-0.4, 0.4):
            R(x + dx - 0.25, y - 0.4, 0.5, 0.8, FILL_2)
            ax.add_patch(Circle((x + dx, y - 0.12), 0.15, facecolor="white", edgecolor=INK, linewidth=1.0))
            ax.add_patch(Circle((x + dx, y + 0.22), 0.07, facecolor="white", edgecolor=INK, linewidth=1.0))
    elif kind == "headphones":
        ax.add_patch(Arc((x, y), 0.8, 0.84, theta1=0, theta2=180, edgecolor=INK, linewidth=3.0))
        for dx in (-0.4, 0.4):
            ax.add_patch(FancyBboxPatch((x + dx - 0.07, y - 0.33), 0.14, 0.38, boxstyle="round,pad=0.02",
                                        facecolor=FILL, edgecolor=INK, linewidth=lw))
    elif kind == "webcam":
        ax.add_patch(Circle((x, y + 0.05), 0.3, facecolor=FILL_2, edgecolor=INK, linewidth=lw))
        ax.add_patch(Circle((x, y + 0.05), 0.14, facecolor="white", edgecolor=INK, linewidth=lw))
        ax.add_patch(Circle((x, y + 0.05), 0.06, facecolor=INK, edgecolor=INK))
        P([(x - 0.06, y - 0.25), (x + 0.06, y - 0.25), (x + 0.1, y - 0.38), (x - 0.1, y - 0.38)], INK)
        R(x - 0.3, y - 0.45, 0.6, 0.07, INK)
    elif kind == "scanner":
        R(x - 0.7, y - 0.2, 1.4, 0.3, FILL)
        R(x - 0.7, y + 0.1, 1.4, 0.12, "white")
        R(x - 0.5, y - 0.12, 1.0, 0.1, "white", 0.8)
    elif kind == "microphone":
        ax.add_patch(FancyBboxPatch((x - 0.13, y - 0.02), 0.26, 0.4, boxstyle="round,pad=0.04,rounding_size=0.13",
                                    facecolor=FILL_2, edgecolor=INK, linewidth=lw))
        R(x - 0.025, y - 0.35, 0.05, 0.3, INK)
        R(x - 0.2, y - 0.45, 0.4, 0.08, INK)
    elif kind == "projector":
        R(x - 0.6, y - 0.25, 1.2, 0.5, FILL)
        ax.add_patch(Circle((x + 0.3, y), 0.16, facecolor="white", edgecolor=INK, linewidth=lw))
        ax.add_patch(Circle((x + 0.3, y), 0.07, facecolor=FILL_2, edgecolor=INK, linewidth=0.8))
    elif kind == "flash drive":
        ax.add_patch(FancyBboxPatch((x - 0.55, y - 0.13), 0.75, 0.26, boxstyle="round,pad=0.02", facecolor=FILL,
                                    edgecolor=INK, linewidth=lw))
        R(x + 0.22, y - 0.09, 0.33, 0.18, "white")
    else:  # an external hard disk
        ax.add_patch(FancyBboxPatch((x - 0.43, y - 0.3), 0.86, 0.6, boxstyle="round,pad=0.02", facecolor=FILL_2,
                                    edgecolor=INK, linewidth=lw))
        ax.add_patch(Circle((x + 0.28, y - 0.17), 0.04, facecolor=INK, edgecolor=INK))


def _tower(ax, label: str) -> None:
    x, y, w, h = TOWER
    ax.add_patch(FancyBboxPatch((x - w / 2, y - h / 2), w, h, boxstyle="round,pad=0.02", facecolor=FILL, edgecolor=INK,
                                linewidth=1.6, zorder=2))
    for k in range(2):
        ax.add_patch(Rectangle((x - 0.32, y + 0.42 - k * 0.22), 0.64, 0.14, facecolor="white", edgecolor=INK,
                               linewidth=0.9, zorder=3))
    ax.add_patch(Circle((x, y - 0.35), 0.09, facecolor="white", edgecolor=INK, linewidth=1.0, zorder=3))
    ax.text(x + w / 2 + 0.15, y, label, ha="left", va="center", fontsize=12, fontweight="bold", gid="hub")


def _draw_system(p: dict):
    lower = p["level"] == "lower"
    fig, ax = new_figure(9.6, 6.6 if lower else 8.4)
    _tower(ax, "computer" if lower else "system unit")
    tx, ty, tw, th = TOWER
    for (letter, kind), slot in zip(p["devices"], p["slots"]):
        x, top = SLOT_X[slot % 4], slot < 4
        y = TOP_Y if top else BOTTOM_Y
        half, below, above = EXTENT[kind]
        _picture(ax, kind, x, y)
        ax.text(x, y + above + 0.3 if top else y - below - 0.3, kind, ha="center", va="center", fontsize=12,
                gid=f"name:{kind}")
        ax.add_patch(Circle((x - half - 0.32, y), 0.22, facecolor="white", edgecolor=INK, linewidth=1.2))
        ax.text(x - half - 0.32, y, letter, ha="center", va="center", fontsize=12, fontweight="bold", gid=f"letter:{letter}")
        sx = tx + (x - tx) * 0.1
        start = (sx, ty + th / 2) if top else (sx, ty - th / 2)
        end = (x, y - below) if top else (x, y + above)
        near = -1 if x > tx else 1  # the side of the picture nearer the system unit
        if kind == "speakers":  # into the nearer speaker, not the gap between them
            end = (x + near * 0.4, end[1])
        elif kind == "headphones":  # into a cup, not the band
            end = (x + near * 0.4, y - 0.37) if top else (x + near * 0.49, y - 0.1)
        ax.plot([start[0], end[0]], [start[1], end[1]], color=INK, linewidth=1.5, zorder=1, gid=f"cable:{letter}")
    bottom = 0.25
    if not lower:  # the key: what input, output and storage devices do
        top = 0.3
        ax.text(0.0, top, "Key", ha="left", va="center", fontsize=11, fontweight="bold")
        for i, (name, does) in enumerate(KEY):
            yy = top - 0.5 - i * 0.48
            ax.add_patch(Rectangle((0.0, yy - 0.24), 2.6, 0.48, facecolor=FILL_2, edgecolor=INK, linewidth=0.9))
            ax.add_patch(Rectangle((2.6, yy - 0.24), 7.4, 0.48, facecolor="white", edgecolor=INK, linewidth=0.9))
            ax.text(0.12, yy, name, ha="left", va="center", fontsize=11, fontweight="bold")
            ax.text(2.75, yy, does, ha="left", va="center", fontsize=11)
        bottom = top - 0.5 - 2 * 0.48 - 0.3
    ax.set_xlim(-0.05, 10.05)
    ax.set_ylim(bottom, TOP_Y + 1.2)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


# --- drawing: the specification ---------------------------------------------------------------------

def _draw_spec(p: dict):
    pc = p["computer"]
    fig, ax = new_figure(10.4, 4.6)
    # the computer's specification, as its settings window shows it
    ax.add_patch(Rectangle((0, 0.2), 4.95, 4.2, facecolor="white", edgecolor=INK, linewidth=1.3))
    ax.add_patch(Rectangle((0, 3.85), 4.95, 0.55, facecolor=FILL_2, edgecolor=INK, linewidth=1.3))
    ax.text(0.15, 4.12, "This computer", ha="left", va="center", fontsize=11, fontweight="bold")
    rows = [("Processor", f"{pc['ghz']} GHz"), ("Installed RAM", f"{pc['ram']} GB"),
            ("System type", f"{pc['bits']}-bit operating system")]
    for i, (k, v) in enumerate(rows):
        yy = 3.45 - i * 0.48
        ax.text(0.15, yy, k, ha="left", va="center", fontsize=10, color="#333333")
        ax.text(1.9, yy, v, ha="left", va="center", fontsize=10, fontweight="bold")
    ax.text(0.15, 1.75, "Local Disk (C:)", ha="left", va="center", fontsize=10, fontweight="bold")
    used = (pc["disk"] - pc["free"]) / pc["disk"]
    ax.add_patch(Rectangle((0.15, 1.08), 4.45, 0.36, facecolor="white", edgecolor=INK, linewidth=1.0))
    ax.add_patch(Rectangle((0.15, 1.08), 4.45 * used, 0.36, facecolor=FILL, edgecolor=INK, linewidth=1.0))
    ax.text(0.15, 0.68, f"{pc['free']} GB free of {pc['disk']} GB", ha="left", va="center", fontsize=10)
    # the programs' minimum system requirements
    cols = [("Program", 1.7), ("RAM", 0.95), ("Free disk\nspace", 1.35), ("Processor", 1.4), ("System type", 1.85)]
    x0 = 5.35
    ax.text(x0, 4.12, "Minimum system requirements", ha="left", va="center", fontsize=11, fontweight="bold")
    x = x0
    for head, w in cols:
        ax.add_patch(Rectangle((x, 3.0), w, 0.75, facecolor=FILL_2, edgecolor=INK, linewidth=0.9))
        ax.text(x + 0.1, 3.375, head, ha="left", va="center", fontsize=10, fontweight="bold")
        x += w
    for r, (name, ram, space, ghz, bits) in enumerate(p["programs"]):
        yy = 3.0 - (r + 1) * 0.6
        cells = [name, f"{ram} GB", f"{space} GB", f"{ghz} GHz", "64-bit only" if bits == 64 else "32-bit or 64-bit"]
        x = x0
        for (head, w), c in zip(cols, cells):
            ax.add_patch(Rectangle((x, yy), w, 0.6, facecolor="white", edgecolor=INK, linewidth=0.9))
            ax.text(x + 0.1, yy + 0.3, c, ha="left", va="center", fontsize=10)
            x += w
    ax.set_xlim(-0.05, x0 + sum(w for _, w in cols) + 0.05)
    ax.set_ylim(0.15, 4.45)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def draw(p: dict):
    return _draw_system(p) if p["sub"] == "system" else _draw_spec(p)


# --- questions --------------------------------------------------------------------------------------

LOWER = ["at school", "in the computer room", "at home in Rubavu", "in the library in Huye", "in class",
         "at the ICT club"]
SETTINGS = ["in an ICT lesson", "for homework", "on a revision card", "for a class test", "at the computer club",
            "in the school office in Kigali"]
ARTICLE = {"input": "an input", "output": "an output", "storage": "a storage"}


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    if p["sub"] == "spec":
        return _spec_questions(p, rng, who)
    devices = {k: d for k, d in p["devices"]}
    if p["level"] == "lower":
        doers = [k for k, d in devices.items() if d in JOB]
        key = rng.choice(doers)
        letters = sorted(devices)
        options = [key] + rng.sample([k for k in letters if k != key], min(3, len(letters) - 1))
        options.sort()
        return [Question("mcq", f"{who} looks at this computer {rng.choice(LOWER)}. Which letter shows the part that "
                                f"{JOB[devices[key]]}?", str(options.index(key)), options),
                count("How many parts are joined to the computer?", len(devices), "parts")]
    cls = p["ask"]
    of = sorted(k for k, d in devices.items() if CLASS[d] == cls)
    key = rng.choice(of)
    others = rng.sample(sorted(k for k, d in devices.items() if CLASS[d] != cls), 3)
    options = sorted([key] + others)
    n = sum(CLASS[d] == p["count"] for d in devices.values())
    verb = rng.choice(["labelled", "drew", "sketched"])
    return [Question("mcq", f"{who} {verb} this computer system {rng.choice(SETTINGS)}. Which letter shows "
                            f"{ARTICLE[cls]} device?", str(options.index(key)), options),
            count(f"How many {p['count']} devices are shown?", n, f"{p['count']} devices", "devices")]


def _spec_questions(p: dict, rng: random.Random, who: str) -> list:
    pc, progs = p["computer"], p["programs"]
    by = {x[0]: x for x in progs}
    bad = next(x for x in progs if not (x[1] <= pc["ram"] and x[2] <= pc["free"] and x[3] <= pc["ghz"]
                                        and (x[4] == 32 or pc["bits"] == 64)))
    a, b = p["pair"]
    left = pc["free"] - by[a][2] - by[b][2]
    used = pc["disk"] - pc["free"]
    gb = lambda n: [f"{n} GB", f"{n}GB", f"{n} gigabytes"]  # noqa: E731
    out = [mcq(f"{who} wants to install these programs on this computer {rng.choice(SETTINGS)}. Which program cannot be "
               f"installed on this computer?", bad[0], [x[0] for x in progs if x[0] != bad[0]], rng),
           short(f"{who} installs {a} and {b}. How much free disk space is left on the C: drive, in GB?", left, gb(left)),
           short("How many gigabytes of the disk are already used?", used, gb(used))]
    if p["why"] == "ram":
        out.append(short(f"How much more RAM would the computer need to run {bad[0]}, in GB?", bad[1] - pc["ram"],
                         gb(bad[1] - pc["ram"])))
    elif p["why"] == "space":
        out.append(short(f"How much more free disk space is needed to install {bad[0]}, in GB?", bad[2] - pc["free"],
                         gb(bad[2] - pc["free"])))
    return out
