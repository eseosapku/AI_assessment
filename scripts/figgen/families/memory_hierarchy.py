"""Memory and storage (P Stage 6, LS, UP; AS Level by name), of four kinds.

- pyramid (LS, UP): the memory hierarchy as a five-layer pyramid (registers at the top, then cache, RAM, a solid-state
  drive and a hard disk drive at the bottom), each layer lettered in a shuffled order with its access time and its
  capacity printed beside it, and the five names listed in alphabetical order under it. Which letter shows a named
  level (cache, RAM, SSD), which letter shows the fastest level or the largest, and how many times faster one lettered
  level is than another (the ratio of the printed access times, a whole number; 1 ms = 1000 µs and 1 µs = 1000 ns are
  printed).
- devices (LS, UP): a table of four storage devices (type, capacity, read speed, price in Frw) with 1 GB = 1000 MB and
  cost per GB = price ÷ capacity printed. Which device is cheapest per GB, how many photos of a stated
  size fit on one, and how many seconds a stated file takes to read from one.
- laptop (UP): a laptop's memory and storage (two RAM slots, one empty; the most RAM it can take; its SSD and the space
  used) beside a price list of RAM modules. The RAM after adding a module, the largest module it can take in the empty
  slot, and the free space on its SSD.
- p (P Stage 6): three or four storage devices drawn as pictures (a flash drive, a memory card, a hard disk, a DVD),
  lettered, with their capacities. Which letter holds the most, how many films of a stated size fit on one, and how
  many more gigabytes one holds than another.
"""
from __future__ import annotations

import random

from matplotlib.patches import Circle, FancyBboxPatch, Polygon, Rectangle

from ..core import FILL, FILL_2, INK, NAMES, Question, count, mcq, money, new_figure, short

ID = "memory_hierarchy"
KIND = "diagram.template"
SUBJECT = "computing"
BANDS = ("LS", "UP", "P")
# The AS Level chapters named "Hardware", "Hardware and software" and "Components of a computer system" teach the
# memory hierarchy and storage devices as drawn here.
ALSO_BANDS = {"UP": ("AL",)}
PYRAMID = tuple(f"computing.{c}" for c in ("primary-memory", "cache-memory", "computer-capacity-performance",
                                           "solid-state-storage", "magnetic-storage-devices"))
DEVICES = tuple(f"computing.{c}" for c in ("magnetic-storage-devices", "optical-storage-devices", "solid-state-storage",
                                           "data-storage-measurement", "computer-capacity-performance"))
LAPTOP = tuple(f"computing.{c}" for c in ("laptop-memory-upgrade", "laptop-fundamentals", "primary-memory",
                                          "portable-devices"))
PRIMARY = tuple(f"computing.{c}" for c in ("primary-memory", "solid-state-storage"))
CONCEPTS = tuple(dict.fromkeys(PYRAMID + DEVICES + LAPTOP + PRIMARY))
# A topic whose sections the book lists is reached only if its name or a section names memory, storage, hardware, a
# laptop or portable device, RAM, cache, capacity, or the components or inside of a computer; an AS Level topic only
# if its name does.
NEEDS = (r"memory|storage|hardware|laptop|portable|\bRAM\b|cache|capacity|components of (a|the)? ?computer|"
         r"computer components|inside|computer systems?\b|computer fundamentals|computer parts")
# Topics sharing these concepts that teach something else: number systems and file sizes, managing files, the
# operating system's memory management, booting, the CPU's cycle, virtual machines, data, security, networks.
AVOID = (r"binary|hexadecimal|file management|manage files|memory management|system software|boot|^data$|"
         r"data representation|data management|operating system|process management|virtual|role of the cpu|cloud|"
         r"security|network|backup|processor handles|assembly|digital citizenship|keyboard|software and hardware")

LEVELS = ["registers", "cache", "RAM", "SSD", "HDD"]
LABEL = {"registers": "registers", "cache": "cache memory", "RAM": "RAM (main memory)", "SSD": "solid-state drive (SSD)",
         "HDD": "hard disk drive (HDD)"}
# Each level's access time choices (number, unit) and capacity choices, as textbooks print them.
TIMES = {"registers": [(1, "ns")], "cache": [(2, "ns"), (4, "ns"), (5, "ns"), (10, "ns")],
         "RAM": [(40, "ns"), (50, "ns"), (60, "ns"), (80, "ns"), (100, "ns")],
         "SSD": [(50, "µs"), (100, "µs"), (200, "µs")], "HDD": [(5, "ms"), (10, "ms"), (20, "ms")]}
CAPS = {"registers": ["256 bytes", "512 bytes", "1 KB"], "cache": ["4 MB", "8 MB", "16 MB", "32 MB"],
        "RAM": ["4 GB", "8 GB", "16 GB", "32 GB"], "SSD": ["256 GB", "512 GB"], "HDD": ["1 TB", "2 TB", "4 TB"]}
NS = {"ns": 1, "µs": 1000, "ms": 1000000}
# Storage devices: type, capacities (GB), read speeds (MB/s), price per GB (Frw).
# Prices per GB overlap from device to device (shops and sales differ), so the table decides which is cheapest.
STORE = {"USB flash drive": ("solid state", [32, 64, 128], [100, 150, 200], [60, 90, 120, 150]),
         "SD memory card": ("solid state", [32, 64, 128], [80, 90, 100], [70, 100, 130]),
         "external hard disk": ("magnetic", [1000, 2000], [120, 150], [40, 60, 80, 100]),
         "portable SSD": ("solid state", [250, 500, 1000], [400, 500], [50, 80, 110]),
         "Blu-ray disc": ("optical", [25, 50], [36, 72], [30, 60, 90])}
MODULES = {4: 20000, 8: 35000, 16: 60000, 32: 110000}
PICTURES = {"flash drive": [8, 16, 32, 64], "memory card": [16, 32, 64, 128], "hard disk": [500, 1000],
            "DVD": ["4.7"]}


def stages(p: dict):
    return (6, 6) if p["band"] == "P" else None


def concepts_for(p: dict) -> tuple[str, ...]:
    return {"pyramid": PYRAMID, "devices": DEVICES, "laptop": LAPTOP, "p": PRIMARY}[p["sub"]]


def ns(t: list) -> int:
    return t[0] * NS[t[1]]


# --- sampling ---------------------------------------------------------------------------------------

def _sample_pyramid(rng: random.Random, band: str) -> dict:
    while True:
        times = {lv: list(rng.choice(TIMES[lv])) for lv in LEVELS}
        caps = {lv: rng.choice(CAPS[lv]) for lv in LEVELS}
        pairs = [(a, b) for a, b in (("registers", "cache"), ("cache", "RAM"), ("registers", "RAM"), ("SSD", "HDD"),
                                     ("RAM", "SSD"))
                 if ns(times[b]) % ns(times[a]) == 0 and ns(times[b]) // ns(times[a]) > 1]
        if not pairs:
            continue
        letters = list("ABCDE")
        rng.shuffle(letters)
        fast, slow = rng.choice(pairs)
        return {"band": band, "sub": "pyramid", "times": times, "caps": caps, "letters": dict(zip(LEVELS, letters)),
                "name": rng.choice(["cache", "RAM", "SSD"]), "extreme": rng.choice(["fastest", "largest"]),
                "pair": [fast, slow]}


def _sample_devices(rng: random.Random, band: str) -> dict:
    while True:
        names = rng.sample(list(STORE), 4)
        rows = []
        for nm in names:
            kind, caps, speeds, cpgs = STORE[nm]
            cap, cpg = rng.choice(caps), rng.choice(cpgs)
            rows.append([nm, kind, cap, rng.choice(speeds), cap * cpg])
        cpg = sorted(r[4] // r[2] for r in rows)
        if cpg[1] - cpg[0] < 10:
            continue
        photo = rng.choice(rows)[0]
        read = rng.choice(rows)
        return {"band": band, "sub": "devices", "rows": rows,
                "photo": [photo, rng.choice([2, 4, 5, 8])], "read": [read[0], read[3] * rng.randint(4, 30)]}


def _sample_laptop(rng: random.Random, band: str) -> dict:
    while True:
        slot1 = rng.choice([4, 8])
        most = rng.choice([16, 32])
        room = most - slot1
        sizes = sorted(rng.sample(sorted(MODULES), 3))
        fits = [m for m in sizes if m <= room]
        if not fits or len(fits) == len(sizes):  # one module at least is too big for the empty slot
            continue
        disk = rng.choice([256, 512])
        used = rng.randint(disk // 4, disk - 20)
        return {"band": band, "sub": "laptop", "slot1": slot1, "max": most, "modules": sizes, "disk": disk,
                "used": used, "add": rng.choice(fits)}


def _sample_p(rng: random.Random) -> dict:
    while True:
        kinds = rng.sample(list(PICTURES), rng.randint(3, 4))
        caps = {k: rng.choice(PICTURES[k]) for k in kinds}
        whole = {k: c for k, c in caps.items() if k != "DVD"}
        if len(whole) < 2 or len(set(float(c) for c in caps.values())) < len(caps):
            continue
        holds = [k for k in kinds if k in ("flash drive", "memory card")]
        if not holds:
            continue
        film_on = rng.choice(holds)
        sizes = [k for k in (2, 4, 8) if caps[film_on] % k == 0 and caps[film_on] // k <= 32]
        if not sizes:
            continue
        a, b = sorted(whole, key=lambda k: -whole[k])[:2]
        letters = list("ABCD"[:len(kinds)])
        rng.shuffle(letters)
        return {"band": "P", "sub": "p", "devices": [[letters[i], k, caps[k]] for i, k in enumerate(kinds)],
                "film": [film_on, rng.choice(sizes)], "compare": [a, b]}


def sample(rng: random.Random) -> dict:
    band = rng.choice(["LS", "UP", "UP", "P"])
    if band == "P":
        return _sample_p(rng)
    sub = rng.choice(["pyramid", "devices"] + (["laptop"] if band == "UP" else []))
    return {"pyramid": _sample_pyramid, "devices": _sample_devices, "laptop": _sample_laptop}[sub](rng, band)


# --- drawing ----------------------------------------------------------------------------------------

def _frame(w: float, h: float):
    fig, ax = new_figure(w, h)
    fig.subplots_adjust(left=0, right=1, bottom=0, top=1)
    ax.set_xlim(0, w)
    ax.set_ylim(0, h)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig, ax


def _draw_pyramid(p: dict):
    fig, ax = _frame(10.4, 6.2)
    top, base, h = 5.6, 1.35, 0.8
    cx, half = 2.9, 2.6
    for i, lv in enumerate(LEVELS):
        y1, y0 = top - i * h, top - (i + 1) * h
        w1, w0 = half * i / 5, half * (i + 1) / 5
        shade = ["#5f6b75", FILL, "#b9c1c8", FILL_2, "#eef0f2"][i]
        ax.add_patch(Polygon([(cx - w0, y0), (cx + w0, y0), (cx + w1, y1), (cx - w1, y1)], closed=True,
                             facecolor=shade, edgecolor=INK, linewidth=1.3))
        yc = y0 + 0.26 if i == 0 else (y0 + y1) / 2  # the narrow tip holds its letter low down
        ax.add_patch(Circle((cx, yc), 0.2 if i == 0 else 0.24, facecolor="white", edgecolor=INK, linewidth=1.2, zorder=3))
        ax.text(cx, yc, p["letters"][lv], ha="center", va="center", fontsize=12, fontweight="bold", zorder=4,
                gid=f"letter:{lv}")
        t = p["times"][lv]
        ax.plot([cx + w0 / 2 + w1 / 2 + 0.15, 6.0], [(y0 + y1) / 2] * 2, color="#999999", linewidth=0.8, linestyle=":")
        ax.text(6.1, (y0 + y1) / 2, f"access time {t[0]} {t[1]}   |   capacity {p['caps'][lv]}", ha="left", va="center",
                fontsize=10.5)
    ax.text(6.1, top + 0.3, "Typical figures for each level", ha="left", va="center", fontsize=11, fontweight="bold")
    names = ", ".join(sorted((LABEL[lv] for lv in LEVELS), key=str.lower))
    ax.text(0.2, 0.9, "The five levels, in alphabetical order:", ha="left", va="center", fontsize=10.5, fontweight="bold")
    ax.text(0.2, 0.5, names, ha="left", va="center", fontsize=10.5)
    ax.text(0.2, 0.12, "1 ms = 1000 µs      1 µs = 1000 ns      (ms = millisecond, µs = microsecond, ns = nanosecond)",
            ha="left", va="center", fontsize=9.5)
    return fig


def _draw_devices(p: dict):
    fig, ax = _frame(10.6, 4.2)
    cols = [("Device", 2.6), ("Type", 1.7), ("Capacity", 1.5), ("Read speed", 1.7), ("Price", 1.6)]
    x0, ytop, rh = 0.2, 3.8, 0.5
    x = x0
    for head, w in cols:
        ax.add_patch(Rectangle((x, ytop - rh), w, rh, facecolor=FILL_2, edgecolor=INK, linewidth=1.0))
        ax.text(x + 0.1, ytop - rh / 2, head, ha="left", va="center", fontsize=10.5, fontweight="bold")
        x += w
    for r, (nm, kind, cap, speed, price) in enumerate(p["rows"]):
        y = ytop - (r + 2) * rh
        cells = [nm, kind, f"{cap} GB", f"{speed} MB/s", f"{price:,}".replace(",", " ") + " Frw"]
        x = x0
        for (head, w), c in zip(cols, cells):
            ax.add_patch(Rectangle((x, y), w, rh, facecolor="white", edgecolor=INK, linewidth=0.8))
            ax.text(x + 0.1, y + rh / 2, c, ha="left", va="center", fontsize=10.5)
            x += w
    ax.text(x0, 0.75, "1 GB = 1000 MB", ha="left", va="center", fontsize=10.5)
    ax.text(x0, 0.35, "cost per GB = price ÷ capacity in GB        time to read a file = file size ÷ read speed",
            ha="left", va="center", fontsize=10.5)
    return fig


def _draw_laptop(p: dict):
    fig, ax = _frame(10.6, 5.0)
    # the laptop, open
    ax.add_patch(FancyBboxPatch((0.5, 2.3), 3.2, 2.1, boxstyle="round,pad=0.03", facecolor=FILL, edgecolor=INK, linewidth=1.4))
    ax.add_patch(Rectangle((0.7, 2.5), 2.8, 1.7, facecolor=FILL_2, edgecolor=INK, linewidth=1.0))
    ax.add_patch(Polygon([(0.2, 1.7), (4.0, 1.7), (3.7, 2.3), (0.5, 2.3)], closed=True, facecolor=FILL, edgecolor=INK,
                         linewidth=1.4))
    ax.add_patch(Rectangle((1.6, 1.8), 1.0, 0.25, facecolor=FILL_2, edgecolor=INK, linewidth=0.8))
    # its memory and storage
    rows = [("RAM slot 1", f"{p['slot1']} GB module"), ("RAM slot 2", "empty"),
            ("Most RAM it can take", f"{p['max']} GB in total"), ("Storage", f"{p['disk']} GB SSD, {p['used']} GB used")]
    ytop = 4.6
    ax.text(4.5, ytop, "This laptop's memory and storage", ha="left", va="center", fontsize=11, fontweight="bold")
    for i, (k, v) in enumerate(rows):
        y = ytop - 0.55 - i * 0.5
        ax.add_patch(Rectangle((4.5, y - 0.25), 2.6, 0.5, facecolor=FILL_2, edgecolor=INK, linewidth=0.8))
        ax.add_patch(Rectangle((7.1, y - 0.25), 3.3, 0.5, facecolor="white", edgecolor=INK, linewidth=0.8))
        ax.text(4.6, y, k, ha="left", va="center", fontsize=10.5, fontweight="bold")
        ax.text(7.2, y, v, ha="left", va="center", fontsize=10.5)
    ly = ytop - 0.55 - 4 * 0.5 - 0.35
    ax.text(4.5, ly, "RAM modules for this laptop", ha="left", va="center", fontsize=11, fontweight="bold")
    for i, m in enumerate(p["modules"]):
        x = 4.5 + i * 2.0
        ax.add_patch(Rectangle((x, ly - 0.95), 1.85, 0.6, facecolor="white", edgecolor=INK, linewidth=0.8))
        ax.text(x + 0.1, ly - 0.65, f"{m} GB: " + f"{MODULES[m]:,}".replace(",", " ") + " Frw", ha="left", va="center",
                fontsize=10)
    return fig


def _picture(ax, kind: str, x: float, y: float) -> None:
    if kind == "flash drive":
        ax.add_patch(FancyBboxPatch((x - 0.75, y - 0.3), 1.1, 0.6, boxstyle="round,pad=0.04", facecolor=FILL, edgecolor=INK,
                                    linewidth=1.5))
        ax.add_patch(Rectangle((x + 0.39, y - 0.2), 0.42, 0.4, facecolor="white", edgecolor=INK, linewidth=1.5))
    elif kind == "memory card":
        ax.add_patch(Polygon([(x - 0.45, y - 0.6), (x + 0.45, y - 0.6), (x + 0.45, y + 0.6), (x - 0.15, y + 0.6),
                              (x - 0.45, y + 0.3)], closed=True, facecolor=FILL_2, edgecolor=INK, linewidth=1.5))
        for k in range(4):
            ax.add_patch(Rectangle((x - 0.3 + k * 0.17, y + 0.32), 0.1, 0.2, facecolor="#c9a227", edgecolor=INK, linewidth=0.6))
    elif kind == "hard disk":
        ax.add_patch(FancyBboxPatch((x - 0.7, y - 0.6), 1.4, 1.2, boxstyle="round,pad=0.03", facecolor=FILL_2,
                                    edgecolor=INK, linewidth=1.5))
        ax.add_patch(Circle((x - 0.05, y + 0.05), 0.45, facecolor="white", edgecolor=INK, linewidth=1.2))
        ax.add_patch(Circle((x - 0.05, y + 0.05), 0.08, facecolor=INK, edgecolor=INK))
        ax.plot([x + 0.5, x + 0.05], [y - 0.45, y + 0.0], color=INK, linewidth=2.0)
    else:  # a DVD
        ax.add_patch(Circle((x, y), 0.62, facecolor=FILL_2, edgecolor=INK, linewidth=1.5))
        ax.add_patch(Circle((x, y), 0.2, facecolor="white", edgecolor=INK, linewidth=1.2))
        ax.add_patch(Circle((x, y), 0.07, facecolor=INK, edgecolor=INK))


def _draw_p(p: dict):
    n = len(p["devices"])
    fig, ax = _frame(2.6 * n + 0.4, 3.4)
    for i, (letter, kind, cap) in enumerate(p["devices"]):
        x = 1.5 + i * 2.6
        _picture(ax, kind, x, 2.0)
        ax.add_patch(Circle((x - 1.0, 2.95), 0.26, facecolor="white", edgecolor=INK, linewidth=1.4))
        ax.text(x - 1.0, 2.95, letter, ha="center", va="center", fontsize=13, fontweight="bold", gid=f"letter:{kind}")
        ax.text(x, 1.0, kind, ha="center", va="center", fontsize=12)
        ax.text(x, 0.5, f"{cap} GB", ha="center", va="center", fontsize=13, fontweight="bold")
    return fig


def draw(p: dict):
    return {"pyramid": _draw_pyramid, "devices": _draw_devices, "laptop": _draw_laptop, "p": _draw_p}[p["sub"]](p)


# --- questions --------------------------------------------------------------------------------------

SETTINGS = ["in an ICT lesson", "for homework", "on a revision card", "for a class test", "at the computer club",
            "in a Computer Science lesson"]
P_SETTINGS = ["at school", "in the computer room", "at home in Musanze", "in class", "at the ICT club"]


def _letters(stem: str, key: str, letters) -> Question:
    options = sorted(letters)
    return Question("mcq", stem, str(options.index(key)), options)


def _gb(n) -> list:
    return [str(n), f"{n} GB", f"{n}GB", f"{n} gigabytes"]


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    sub = p["sub"]
    if sub == "pyramid":
        letters = p["letters"]
        name = p["name"]
        others = rng.sample([letters[lv] for lv in LEVELS if lv != name], 3)
        ext = LEVELS[0] if p["extreme"] == "fastest" else LEVELS[-1]
        ext_others = rng.sample([letters[lv] for lv in LEVELS if lv != ext], 3)
        fast, slow = p["pair"]
        ratio = ns(p["times"][slow]) // ns(p["times"][fast])
        what = "the fastest level" if p["extreme"] == "fastest" else "the level with the largest capacity"
        return [_letters(f"{who} labelled this memory pyramid {rng.choice(SETTINGS)}. Which letter shows "
                         f"{LABEL[name]}?", letters[name], [letters[name]] + others),
                _letters(f"Using the figures printed beside the pyramid, which letter shows {what}?", letters[ext],
                         [letters[ext]] + ext_others),
                short(f"Using the access times printed, how many times faster is level {letters[fast]} than level "
                      f"{letters[slow]}?", ratio, [str(ratio), f"{ratio} times"])]
    if sub == "devices":
        rows = p["rows"]
        key = min(rows, key=lambda r: r[4] // r[2])[0]
        q1 = mcq(f"{who} compares these storage devices {rng.choice(SETTINGS)}. Which device is the cheapest per "
                 f"gigabyte?", key, [r[0] for r in rows], rng)
        dev, size = p["photo"]
        cap = next(r[2] for r in rows if r[0] == dev)
        photos = cap * 1000 // size
        rdev, mb = p["read"]
        speed = next(r[3] for r in rows if r[0] == rdev)
        secs = mb // speed
        return [q1,
                count(f"Each photo is {size} MB. How many photos can be stored on the {dev} in the table?", photos,
                      "photos"),
                short(f"How many seconds does it take to read a {mb} MB video file from the {rdev} in the table?", secs,
                      [str(secs), f"{secs} s", f"{secs} seconds"])]
    if sub == "laptop":
        room = p["max"] - p["slot1"]
        best = max(m for m in p["modules"] if m <= room)
        total = p["slot1"] + p["add"]
        free = p["disk"] - p["used"]
        return [short(f"{who} puts the {p['add']} GB module from the price list into the laptop's empty RAM slot. How "
                      f"much RAM will the laptop have then, in GB?", total, _gb(total)),
                Question("mcq", "Which is the largest RAM module in the price list that this laptop can take in its "
                         "empty slot without going over the most RAM it can take?",
                         str(p["modules"].index(best)), [f"{m} GB" for m in p["modules"]]),
                short("How much free space is left on this laptop's SSD, in GB?", free, _gb(free))]
    devices = {k: (letter, cap) for letter, k, cap in p["devices"]}
    most = max(devices, key=lambda k: float(devices[k][1]))
    film_on, size = p["film"]
    films = devices[film_on][1] // size
    a, b = p["compare"]
    diff = devices[a][1] - devices[b][1]
    return [_letters(f"{who} looks at these storage devices {rng.choice(P_SETTINGS)}. Which letter shows the device "
                     f"that can hold the most?", devices[most][0], [v[0] for v in devices.values()]),
            count(f"A film is {size} GB. How many films can the {film_on} hold?", films, "films"),
            short(f"How many more gigabytes can the {a} hold than the {b}?", diff, _gb(diff))]
