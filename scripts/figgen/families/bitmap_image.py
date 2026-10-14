"""Bitmap images (LS, UP, AL): a small pixel grid, black and white at a colour depth of 1 bit or four colours at
2 bits, with its key of colours and codes and its rows numbered. The binary code of a row, the file size in bits or
bytes with no header, and how many pixels are a colour.

Every key is counted off the grid: a row's code is its pixels' codes left to right, the size is width x height x
depth, and bytes are asked only when the bits make whole bytes.
"""
from __future__ import annotations

import random

from matplotlib.patches import Rectangle

from ..core import INK, NAMES, new_figure, short

ID = "bitmap_image"
KIND = "cs.structure"
SUBJECT = "computing"
BANDS = ("LS", "UP", "AL")
CONCEPTS = tuple(f"computing.{c}" for c in ("data-representation-structure-management", "data-storage-measurement", "file-compression"))
AVOID = r"spreadsheet|database|network|internet|security|document|presentation|email|python|html|animation|expert system|monitoring and control|modelling|mail merge|data, information, knowledge|data processing and information|project management|sound and video|operating systems|magnetic media|storage devices|role of the cpu|computer applications|data management|software and hardware|^storage$"
# A topic whose sections the book lists is reached only if one names what this figure teaches.
NEEDS = r"bitmap|image|pixel|graphic|colour depth|color depth|resolution|file size|data representation|storage|compression"
PALETTES = {1: ["white", "black"], 2: ["white", "black", "red", "blue"]}
COLOURS = {"white": "#ffffff", "black": "#1a1a1a", "red": "#d62728", "blue": "#1f77b4"}


def sample(rng: random.Random) -> dict:
    depth = rng.choice([1, 2])
    while True:
        h, w = rng.randint(4, 6), rng.randint(4, 8)
        grid = [[rng.randrange(2 ** depth) for _ in range(w)] for _ in range(h)]
        used = {c for row in grid for c in row}
        if len(used) == 2 ** depth:  # every colour in the key appears
            break
    return {"band": rng.choice(BANDS), "depth": depth, "palette": PALETTES[depth], "grid": grid,
            "row": rng.randrange(h), "count": rng.randrange(2 ** depth)}


def draw(p: dict):
    grid, depth, palette = p["grid"], p["depth"], p["palette"]
    h, w = len(grid), len(grid[0])
    fig, ax = new_figure(7.4, 3.6)
    s = 0.6
    top = h * s
    for r, row in enumerate(grid):
        y = top - (r + 1) * s
        ax.text(-0.15, y + s / 2, f"row {r + 1}", ha="right", va="center", fontsize=9.5)
        for c, colour in enumerate(row):
            ax.add_patch(Rectangle((c * s, y), s, s, facecolor=COLOURS[palette[colour]], edgecolor="#777777", linewidth=0.8))
    ax.add_patch(Rectangle((0, 0), w * s, h * s, facecolor="none", edgecolor=INK, linewidth=1.5))
    # the key
    kx = w * s + 0.9
    ax.text(kx, top + 0.05, f"Key (colour depth {depth} bit{'s' if depth > 1 else ''})", ha="left", va="bottom", fontsize=10,
            fontweight="bold")
    for i, name in enumerate(palette):
        y = top - (i + 1) * 0.55
        ax.add_patch(Rectangle((kx, y), 0.4, 0.4, facecolor=COLOURS[name], edgecolor=INK, linewidth=1.0))
        ax.text(kx + 0.55, y + 0.2, f"{format(i, f'0{depth}b')} = {name}", ha="left", va="center", fontsize=10, family="monospace")
    ax.set_xlim(-1.2, kx + 3.4)
    ax.set_ylim(min(-0.2, top - len(palette) * 0.55 - 0.2), top + 0.5)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


SETTINGS = ["in a computing lesson", "for homework", "on a revision card", "at the coding club", "for a class test"]


def questions(p: dict, rng: random.Random) -> list:
    who, friend = rng.sample(NAMES, 2)
    grid, depth, palette = p["grid"], p["depth"], p["palette"]
    h, w = len(grid), len(grid[0])
    r = p["row"]
    codes = [format(c, f"0{depth}b") for c in grid[r]]
    code = "".join(codes)
    bits = w * h * depth
    unit = "bytes" if bits % 8 == 0 and rng.random() < 0.5 else "bits"
    size = bits // 8 if unit == "bytes" else bits
    name = palette[p["count"]]
    n = sum(row.count(p["count"]) for row in grid)
    return [short(f"{who} drew this bitmap {rng.choice(SETTINGS)}. Using the key, write the binary code for row {r + 1}, left to right.",
                  code, [code, " ".join(codes)] + [" ".join(code[i:i + g] for i in range(0, len(code), g)) for g in (4, 8) if len(code) > g]),
            short(f"What is the file size in {unit} of {friend}'s image, with no header?" + (" (8 bits = 1 byte)" if unit == "bytes" else ""),
                  size, [str(size), f"{size} {unit}"]),
            short(f"How many pixels are {name} in this bitmap?", n, [str(n), f"{n} pixels"])]
