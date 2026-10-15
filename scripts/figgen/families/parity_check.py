"""Parity block checks (UP, LS): a block of four to six bytes drawn as a Cambridge paper draws it, a bit grid whose
columns are the parity bit and bits 2 to 8, with a parity bit in each byte and a parity byte beneath that gives
each column the same parity too.

Two sub-types. "error": the parity (even or odd) is stated and one bit of a byte was changed on the way: which byte
holds the error (or what the block shows about a given byte), which column the changed bit is in, and the byte as it
was sent. "missing": the parity is not stated; the parity byte and one byte's parity bit are blank: which parity
was used, the missing parity bit, and the parity byte.

Every key is the block checked row by row and column by column. Odd parity comes only with five bytes: with an even
number of bytes the parity byte would have to break its own parity.
"""
from __future__ import annotations

import random

from matplotlib.patches import Rectangle

from ..core import INK, NAMES, mcq, new_figure, short

ID = "parity_check"
KIND = "cs.structure"
SUBJECT = "computing"
BANDS = ("UP", "LS")
CONCEPTS = tuple(f"computing.{c}" for c in ("data-validation-verification", "data-packet-structure", "data-transmission-parallel"))
# A topic whose sections the book lists is reached only if one names error detection or transmission.
NEEDS = r"parity|error detect|detecting error|errors in data|echo check|check digit|checksum|data transmission|transmission mode"
# Topics listed without sections that share the validation concept but teach no transmission checks.
AVOID = r"spreadsheet|database|excel|google|form|mail merge|proofing|program|block|software|data management|data and information|^data$"
RECEIVERS = ["a Kigali school's server", "a Musanze cooperative's office computer", "a Huye greenhouse controller",
             "an online form server in Kigali", "a Rubavu hotel's booking system", "a Nyagatare dairy's laptop"]
LIGHT = "#d9dee3"
SHADE = "#eef1f3"


def sample(rng: random.Random) -> dict:
    mode = rng.choice(["error", "missing"])
    parity = rng.choice(["even", "odd"])
    n = 5 if parity == "odd" else rng.randint(4, 6)
    want = 0 if parity == "even" else 1
    while True:
        rows = []
        for _ in range(n):
            data = [rng.randint(0, 1) for _ in range(7)]
            rows.append([(want - sum(data)) % 2] + data)
        if len({tuple(r) for r in rows}) == n and all(1 <= sum(r[1:]) <= 6 for r in rows):
            break
    pbyte = [(want - sum(r[j] for r in rows)) % 2 for j in range(8)]
    p = {"band": rng.choice(BANDS), "mode": mode, "parity": parity, "rows": rows, "pbyte": pbyte, "blank": None,
         "ask": None, "receiver": rng.choice(RECEIVERS)}
    if mode == "error":
        r, c = rng.randrange(n), rng.randrange(8)
        rows[r][c] = 1 - rows[r][c]
        roll = rng.random()
        p["ask"] = None if roll < 0.5 else r if roll < 0.75 else rng.choice([i for i in range(n) if i != r])
    else:
        p["blank"] = rng.randrange(n)
    return p


def _want(p: dict) -> int:
    return 0 if p["parity"] == "even" else 1


def find_error(p: dict) -> tuple[int, int]:
    """The changed bit: the one byte and the one column whose parity is wrong."""
    want = _want(p)
    r = next(i for i, row in enumerate(p["rows"]) if sum(row) % 2 != want)
    c = next(j for j in range(8) if (sum(row[j] for row in p["rows"]) + p["pbyte"][j]) % 2 != want)
    return r, c


def draw(p: dict):
    rows = p["rows"]
    n = len(rows)
    lw, cw, rh, hh = 1.9, 0.86, 0.52, 0.8  # label column, bit column, row and heading heights
    width = lw + 8 * cw
    top = hh + rh * (n + 1)
    k = 0.62
    fig, ax = new_figure((width + 0.4) * k, (top + 1.9) * k)
    ax.set_position([0, 0, 1, 1])
    ax.text(width / 2, top + 1.15, "Parity block check", ha="center", va="center", fontsize=12.5, fontweight="bold")
    ax.text(width / 2, top + 0.6, f"Block received by {p['receiver']}", ha="center", va="center", fontsize=10)
    if p["mode"] == "error":
        ax.text(width / 2, -0.4, f"{p['parity'].capitalize()} parity is used.", ha="center", va="center", fontsize=10.5,
                fontweight="bold", gid="parity")
    heads = ["Parity\nbit"] + [f"Bit {j}" for j in range(2, 9)]
    ax.add_patch(Rectangle((0, top - hh), lw, hh, facecolor="white", edgecolor=INK, linewidth=1.0))
    for j, h in enumerate(heads):
        x = lw + j * cw
        ax.add_patch(Rectangle((x, top - hh), cw, hh, facecolor=LIGHT, edgecolor=INK, linewidth=1.0))
        ax.text(x + cw / 2, top - hh / 2, h, ha="center", va="center", fontsize=9, fontweight="bold", linespacing=1.05)
    missing = p["mode"] == "missing"
    for i, row in enumerate(rows + [p["pbyte"]]):
        last = i == n
        y = top - hh - rh * (i + 1)
        ax.add_patch(Rectangle((0, y), lw, rh, facecolor=SHADE if last else "white", edgecolor=INK, linewidth=1.0))
        ax.text(0.15, y + rh / 2, "Parity byte" if last else f"Byte {i + 1}", ha="left", va="center", fontsize=10,
                fontweight="bold" if last else "normal")
        for j, b in enumerate(row):
            x = lw + j * cw
            ax.add_patch(Rectangle((x, y), cw, rh, facecolor=SHADE if last else "white", edgecolor=INK,
                                   linewidth=1.0))
            blank = (last and missing) or (missing and i == p["blank"] and j == 0)
            ax.text(x + cw / 2, y + rh / 2, "?" if blank else str(b), ha="center", va="center", fontsize=11,
                    fontweight="bold" if blank else "normal", family="monospace", gid=f"bit:{'P' if last else i}:{j}")
    # the parity column set off from the data bits, as papers draw it
    ax.plot([lw + cw, lw + cw], [top - hh - rh * (n + 1), top], color=INK, linewidth=2.2)
    ax.plot([0, width], [top - hh - rh * n] * 2, color=INK, linewidth=2.2)
    ax.set_xlim(-0.2, width + 0.2)
    ax.set_ylim(-0.8 if p["mode"] == "error" else -0.3, top + 1.6)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


VERBS = ["receives", "checks", "is checking", "looks over", "examines", "inspects"]
SETTINGS = ["in a computer science lesson", "for homework", "on a revision card", "at the coding club", "for a class test",
            "during revision", "in a networking lesson"]
WAYS = ["changed on the way", "flipped during transmission", "corrupted in transmission", "altered in transit"]


def _byte_forms(bits: str) -> list[str]:
    return [bits, f"{bits[:4]} {bits[4:]}"]


def questions(p: dict, rng: random.Random) -> list:
    who, friend = rng.sample(NAMES, 2)
    verb, setting = rng.choice(VERBS), rng.choice(SETTINGS)
    rows, n = p["rows"], len(p["rows"])
    if p["mode"] == "missing":
        want = _want(p)
        k = p["blank"]
        bit = (want - sum(rows[k][1:])) % 2
        byte = "".join(str((want - sum(r[j] for r in rows)) % 2) for j in range(8))
        parity = p["parity"]
        return [short(f"{who} {verb} this block {setting}. The parity byte and one parity bit are missing. "
                      f"Was it sent using even or odd parity?", parity,
                      [parity.capitalize(), f"{parity} parity", f"{parity.capitalize()} parity"]),
                short(f"What is the missing parity bit of byte {k + 1}?", bit, [str(bit)]),
                short(f"{friend} fills in the parity byte. What are its 8 bits, from the parity bit to bit 8?", byte,
                      _byte_forms(byte))]
    r, c = find_error(p)
    fixed = list(rows[r])
    fixed[c] = 1 - fixed[c]
    sent = "".join(map(str, fixed))
    opening = f"{who} {verb} this block {setting}. It was sent using {p['parity']} parity, and one bit was {rng.choice(WAYS)}."
    k = p["ask"]
    if k is None:
        first = short(f"{opening} Which byte contains the error?", f"Byte {r + 1}",
                      [f"byte {r + 1}", str(r + 1), f"Byte{r + 1}", f"byte{r + 1}"])
    else:
        ok = f"Byte {k + 1} was received correctly"
        parity_bit = f"Byte {k + 1} has an error in its parity bit"
        data_bit = f"Byte {k + 1} has an error in one of bits 2 to 8"
        key = ok if k != r else parity_bit if c == 0 else data_bit
        first = mcq(f"{opening} What does the block show about byte {k + 1}?", key, [ok, parity_bit, data_bit], rng)
    column = (short("Which column holds the changed bit?", "Parity bit",
                    ["parity bit", "the parity bit", "Bit 1", "bit 1", "1"]) if c == 0 else
              short("Which column holds the changed bit?", f"Bit {c + 1}", [f"bit {c + 1}", str(c + 1)]))
    return [first, column,
            short(f"{friend} corrects the error. Write the byte that held it as it was sent, all 8 bits from the parity bit "
                  f"to bit 8.", sent, _byte_forms(sent))]
