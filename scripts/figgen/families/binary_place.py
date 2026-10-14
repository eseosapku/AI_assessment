"""Binary place value (LS, UP): an 8-bit place-value table, 128 down to 1, with a byte written in it. The byte's
denary value, its hexadecimal, and its denary value after a logical left shift of one or two places.

Every key is the byte read; a byte to be shifted has zeros in the places shifted out, so no overflow rule is needed.
"""
from __future__ import annotations

import random

from matplotlib.patches import Rectangle

from ..core import INK, NAMES, new_figure, short

ID = "binary_place"
KIND = "cs.structure"
SUBJECT = "computing"
BANDS = ("LS", "UP")
CONCEPTS = tuple(f"computing.{c}" for c in ("number-systems", "data-representation-structure-management"))
AVOID = r"spreadsheet|database|network|internet|security|graphic|document|presentation|email|python|html|animation|expert system|monitoring and control|modelling|mail merge|data, information, knowledge|data processing and information|project management|computer applications|data management"
# A topic whose sections the book lists is reached only if one names what this figure teaches.
NEEDS = r"binary|denary|hexadecimal|number system|number base|bits?\b|bytes?\b|data representation|conversion"
PLACES = [128, 64, 32, 16, 8, 4, 2, 1]
FILL = "#eef1f3"


def sample(rng: random.Random) -> dict:
    shift = rng.choice([1, 2])
    v = rng.randint(3, (256 >> shift) - 1)  # the top `shift` bits are 0
    return {"band": rng.choice(BANDS), "bits": [int(b) for b in format(v, "08b")], "shift": shift}


def draw(p: dict):
    fig, ax = new_figure(7.2, 2.2)
    w = 1.0
    for i, (place, bit) in enumerate(zip(PLACES, p["bits"])):
        ax.add_patch(Rectangle((i * w, 1.0), w, 0.7, facecolor="#d9dee3", edgecolor=INK, linewidth=1.2))
        ax.text(i * w + w / 2, 1.35, str(place), ha="center", va="center", fontsize=12, fontweight="bold")
        ax.add_patch(Rectangle((i * w, 0.3), w, 0.7, facecolor="white", edgecolor=INK, linewidth=1.2))
        ax.text(i * w + w / 2, 0.65, str(bit), ha="center", va="center", fontsize=15, family="monospace")
    ax.text(-0.15, 1.35, "Place value", ha="right", va="center", fontsize=10)
    ax.text(-0.15, 0.65, "Bit", ha="right", va="center", fontsize=10)
    ax.set_xlim(-2.0, 8 * w + 0.2)
    ax.set_ylim(0.1, 1.9)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def _hex_forms(v: int) -> list[str]:
    """Each way of writing the hexadecimal, with and without the leading zero of a byte under 16 (P3k review)."""
    out = []
    for h in dict.fromkeys([format(v, "02X"), format(v, "X")]):
        out += [h, f"{h}h", f"0x{h}", f"{h}₁₆"]
    return out


SETTINGS = ["in a computing lesson", "for homework", "on a revision card", "at the coding club", "for a class test"]


def questions(p: dict, rng: random.Random) -> list:
    who, friend = rng.sample(NAMES, 2)
    byte = "".join(map(str, p["bits"]))
    v = int(byte, 2)
    hx = format(v, "02X")
    k = p["shift"]
    shifted = v << k
    place = "place" if k == 1 else "places"
    return [short(f"{who} writes a byte in this table {rng.choice(SETTINGS)}. What is the denary value of this byte?", v, [str(v)]),
            short(f"{friend} converts the byte in the table to hexadecimal. What does {friend} write?", hx, _hex_forms(v)),
            short(f"{who} then does a logical left shift of {k} {place} on the byte in the table. What is the denary value after the shift?",
                  shifted, [str(shifted)])]
