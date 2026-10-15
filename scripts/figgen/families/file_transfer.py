"""File sizes and transfer times (UP, LS): three files on spec cards, an uncompressed bitmap image (width, height and
colour depth) with a sound file (sample rate, resolution, length and channels), a text file (characters and bytes per
character) or another image, a connection speed in Mbps, and the formulae printed under them with the units' convention:
1 KiB = 1024 bytes in some figures, 1 kB = 1000 bytes in others, and 1 Mbps = 1 000 000 bits per second in all.

A file's size in the stated units, the time to send a file over the connection in seconds, and which file is the
largest.

Every key is the formula worked on the card's numbers. Values are drawn until each answer is exact to one decimal place
at most, and the largest file is at least a quarter larger than the next.
"""
from __future__ import annotations

import random
from fractions import Fraction

from matplotlib.patches import FancyBboxPatch, Rectangle

from ..core import INK, NAMES, exact, mcq, measure, new_figure, short

ID = "file_transfer"
KIND = "table.data"
SUBJECT = "computing"
BANDS = ("UP", "LS")
CONCEPTS = tuple(f"computing.{c}" for c in ("data-storage-measurement", "image-resolution-color-depth"))
# A topic whose sections the book lists is reached only if one names what this figure teaches.
NEEDS = r"storage|file size|measur|transmission|transfer|compress|data representation|bandwidth|calculating size|reduc"
AVOID = r"role of the cpu|spreadsheet|database|security|presentation|python|html|programming|word processing|^data$|data management|software and hardware"
IMAGES = ["volcano.bmp", "gorilla.bmp", "classroom.bmp", "market.bmp", "logo.bmp", "lake.bmp", "team.bmp", "map.bmp"]
SOUNDS = ["anthem.wav", "drums.wav", "interview.wav", "lesson.wav", "choir.wav", "advert.wav"]
TEXTS = ["essay.txt", "minutes.txt", "notes.txt", "report.txt", "story.txt"]
DIMENSIONS = [(640, 480), (800, 600), (1024, 768), (1280, 1024), (1600, 1200), (2048, 1536), (512, 512), (256, 256),
              (1000, 800), (1200, 900), (1500, 1000), (2000, 1500), (800, 500), (500, 400), (1250, 1000), (3000, 2000),
              (4000, 3000), (1920, 1080), (1280, 720)]
DEPTHS = [1, 4, 8, 16, 24]
RATES = [8000, 16000, 22050, 32000, 44100, 48000]
SECONDS = [5, 8, 10, 15, 16, 20, 25, 30, 32, 40, 45, 50, 60, 64, 75, 90, 120, 128]
CHARS = [2048, 4096, 10240, 20480, 25600, 51200, 102400, 3000, 5000, 12000, 25000, 40000, 75000, 150000, 250000]
SPEEDS = [2, 4, 5, 8, 10, 16, 20, 25, 40, 50, 80, 100]
UNITS = {"binary": [("MiB", 1024 ** 2), ("KiB", 1024)], "decimal": [("MB", 1000 ** 2), ("kB", 1000)]}


def bits(f: dict) -> int:
    if f["kind"] == "image":
        return f["width"] * f["height"] * f["depth"]
    if f["kind"] == "sound":
        return f["rate"] * f["bits"] * f["seconds"] * f["channels"]
    return f["chars"] * f["bytes_per_char"] * 8


def _file(kind: str, name: str, rng: random.Random) -> dict:
    if kind == "image":
        w, h = rng.choice(DIMENSIONS)
        return {"name": name, "kind": kind, "width": w, "height": h, "depth": rng.choice(DEPTHS)}
    if kind == "sound":
        return {"name": name, "kind": kind, "rate": rng.choice(RATES), "bits": rng.choice([8, 16, 24]),
                "seconds": rng.choice(SECONDS), "channels": rng.choice([1, 2])}
    return {"name": name, "kind": kind, "chars": rng.choice(CHARS), "bytes_per_char": rng.choice([1, 2])}


def size_in(f: dict, convention: str) -> tuple[str, Fraction] | None:
    """The file's size in the larger unit that gives a whole number or one decimal place, at least 1."""
    for unit, factor in UNITS[convention]:
        v = Fraction(bits(f) // 8, factor)
        if bits(f) % 8 == 0 and v >= 1 and (v * 10).denominator == 1:
            return unit, v
    return None


def seconds(f: dict, speed: int) -> Fraction:
    return Fraction(bits(f), speed * 1_000_000)


def sample(rng: random.Random) -> dict:
    while True:
        kinds = ["image", rng.choice(["sound", "text"]), rng.choice(["image", "sound", "text"])]
        rng.shuffle(kinds)
        pools = {"image": rng.sample(IMAGES, 3), "sound": rng.sample(SOUNDS, 2), "text": rng.sample(TEXTS, 2)}
        files = [_file(k, pools[k].pop(), rng) for k in kinds]
        sizes = sorted((bits(f) for f in files), reverse=True)
        if sizes[0] * 4 < sizes[1] * 5:
            continue
        convention = rng.choice(["binary", "decimal"])
        sized = [i for i, f in enumerate(files) if size_in(f, convention)]
        sends = [(i, s) for i, f in enumerate(files) for s in SPEEDS
                 if (seconds(f, s) * 10).denominator == 1 and 1 <= seconds(f, s) <= 600]
        if not sized or not sends:
            continue
        send, speed = rng.choice(sends)
        return {"band": rng.choice(BANDS), "convention": convention, "files": files, "speed": speed,
                "size_of": rng.choice(sized), "send": send}


def _n(v: int) -> str:
    """A number as the paper prints it: 44 100, a space between thousands from five digits up."""
    return f"{v:,}".replace(",", " ") if v >= 10000 else str(v)


def card_lines(f: dict) -> list[str]:
    if f["kind"] == "image":
        return ["Type: bitmap image", f"Width: {_n(f['width'])} pixels", f"Height: {_n(f['height'])} pixels",
                f"Colour depth: {f['depth']} bit{'s' if f['depth'] > 1 else ''}"]
    if f["kind"] == "sound":
        return ["Type: sound", f"Sample rate: {_n(f['rate'])} Hz", f"Sample resolution: {f['bits']} bits",
                f"Length: {f['seconds']} seconds", f"Channels: {f['channels']} ({'stereo' if f['channels'] == 2 else 'mono'})"]
    return ["Type: text", f"Characters: {_n(f['chars'])}",
            f"Character set: {'8-bit ASCII' if f['bytes_per_char'] == 1 else 'Unicode'}",
            f"Bytes per character: {f['bytes_per_char']}"]


def formula_lines(p: dict) -> list[str]:
    kinds = {f["kind"] for f in p["files"]}
    out = []
    if "image" in kinds:
        out.append("Image file size (bits) = width × height × colour depth")
    if "sound" in kinds:
        out.append("Sound file size (bits) = sample rate × sample resolution × length (s) × channels")
    if "text" in kinds:
        out.append("Text file size (bytes) = characters × bytes per character")
    out.append("8 bits = 1 byte     1 KiB = 1024 bytes     1 MiB = 1024 KiB" if p["convention"] == "binary"
               else "8 bits = 1 byte     1 kB = 1000 bytes     1 MB = 1000 kB")
    out.append("Transfer time (s) = file size (bits) ÷ speed (bits per second)")
    out.append("1 Mbps = 1 000 000 bits per second")
    return out


def draw(p: dict):
    files = p["files"]
    fig, ax = new_figure(8.8, 5.4)
    cw, ch, gap = 2.75, 1.95, 0.2
    top = 5.0
    right = 3 * cw + 2 * gap
    ax.text(0, top + 0.12, "Three files (uncompressed, with no headers)", ha="left", va="bottom", fontsize=10, fontweight="bold")
    ax.text(right, top + 0.12, f"Connection speed: {p['speed']} Mbps", ha="right", va="bottom", fontsize=10, fontweight="bold")
    for i, f in enumerate(files):
        x = i * (cw + gap)
        ax.add_patch(FancyBboxPatch((x + 0.04, top - ch + 0.04), cw - 0.08, ch - 0.08, boxstyle="round,pad=0.04",
                                    facecolor="white", edgecolor=INK, linewidth=1.2))
        ax.add_patch(Rectangle((x + 0.04, top - 0.46), cw - 0.08, 0.42, facecolor="#d9dee3", edgecolor="none"))
        ax.text(x + 0.18, top - 0.25, f["name"], ha="left", va="center", fontsize=10.5, fontweight="bold")
        for k, line in enumerate(card_lines(f)):
            ax.text(x + 0.18, top - 0.72 - k * 0.27, line, ha="left", va="center", fontsize=9.5)
    lines = formula_lines(p)
    fy = top - ch - 0.45
    box_h = len(lines) * 0.3 + 0.25
    ax.add_patch(Rectangle((0, fy - box_h), 3 * cw + 2 * gap, box_h, facecolor="#f4f6f8", edgecolor=INK, linewidth=1.0))
    ax.text(0.15, fy + 0.06, "Formulae", ha="left", va="bottom", fontsize=10, fontweight="bold")
    for k, line in enumerate(lines):
        ax.text(0.2, fy - 0.27 - k * 0.3, line, ha="left", va="center", fontsize=9.5)
    ax.set_xlim(-0.1, 3 * cw + 2 * gap + 0.1)
    ax.set_ylim(fy - box_h - 0.1, top + 0.5)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


KEEPS = ["saves these files on the school computer", "stores these files in a shared folder", "copies these files to a memory stick",
         "keeps these files on a laptop"]
SETTINGS = ["for an ICT lesson", "for a class test", "for homework", "for the school club"]
SENDS = ["send", "upload", "download", "email"]
UNIT_WORDS = {"KiB": ["KB", "kibibytes"], "MiB": ["MB", "mebibytes"], "kB": ["KB", "kilobytes"], "MB": ["megabytes"]}


def questions(p: dict, rng: random.Random) -> list:
    who, friend = rng.sample(NAMES, 2)
    files = p["files"]
    f = files[p["size_of"]]
    unit, v = size_in(f, p["convention"])
    value = exact(v)
    forms = short("_", value).accepted
    forms += [f"{x} {u}" for x in list(forms) for u in [unit, *UNIT_WORDS[unit]]] + [f"{x}{unit}" for x in list(forms)]
    q1 = short(f"{who} {rng.choice(KEEPS)} {rng.choice(SETTINGS)}. What is the size of "
               f"{f['name']} in {unit}?", value, forms)
    g = files[p["send"]]
    t = exact(seconds(g, p["speed"]))
    q2 = short(f"How long does it take to {rng.choice(SENDS)} {g['name']} over the {p['speed']} Mbps connection, in seconds?",
               t, measure(t, "s"))
    big = max(files, key=bits)["name"]
    q3 = mcq(rng.choice(["Which of the three files is the largest?", f"{friend} needs space on the disk. Which file is the largest?",
                         "Which file is the largest, uncompressed?"]), big, [x["name"] for x in files], rng)
    return [q1, q2, q3]
