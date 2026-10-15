"""The circular flow of income (UP; AL by ALSO_BANDS): households and firms as two tall boxes, with income (Y) flowing
from firms to households along the bottom and consumer spending (C) from households to firms along the top. A two-,
three- or four-sector model sets one, two or three boxes between them, as Cambridge and the Rwanda S5 book draw it:
the financial sector, then government, then the rest of the world. Each withdrawal (savings S, taxes T, imports M)
runs from the households into its box, and each injection (investment I, government spending G, exports X) from its
box into the firms. Every arrow carries its value in billions of francs.

One flow, consumer spending or income, is marked "?": households spend their income on domestic goods or withdraw
it, so Y = C + S + T + M (fewer terms in a smaller model), and the stem says so. Total injections or withdrawals,
each with its sum written out; and whether national income rises, falls or stays the same, with the rule in the
stem. Injections and withdrawals differ plainly (by 30 billion and a twentieth at least) or are exactly equal.
"""
from __future__ import annotations

import random

from ..core import INK, NAMES, mcq, new_figure, short
from .econ_tables import frw

ID = "circular_flow"
KIND = "process.flow"
SUBJECT = "economics"
BANDS = ("UP",)
ALSO_BANDS = {"UP": ("AL",)}  # the same diagram in Cambridge AS Level, whose chapter is named for it
CONCEPTS = ("economics.circular-flow-income", "economics.injections-leakages")
# IGCSE's first unit and WAEC's "Basic economic problems" list the circular flow as a concept without teaching this
# diagram; "Nigerian economy" is another country's economy.
AVOID = r"basic economic problem|nigeria"
# A topic whose sections the book lists is reached only if one names what this figure teaches.
NEEDS = r"circular flow|injection|leakage|withdrawal"

LEAK = {2: "S", 3: "ST", 4: "STM"}
INJECT = {2: "I", 3: "IG", 4: "IGX"}
NAME = {"Y": "Income", "C": "Consumer spending", "S": "Savings", "T": "Taxes", "M": "Imports", "I": "Investment",
        "G": "Government spending", "X": "Exports"}
MIDDLE = ["Financial sector", "Government", "Rest of the world"]  # the box each withdrawal enters and injection leaves
# The share of income each withdrawal takes, and how far an injection strays from its withdrawal.
SHARE = {"S": (0.06, 0.15), "T": (0.08, 0.18), "M": (0.1, 0.2)}

W = 15.0
BOX_W, MID_W, MID_H, ROW = 2.2, 3.2, 1.0, 1.9
Y_ARROW = 1.25


def _tens(rng: random.Random, lo: float, hi: float) -> int:
    return 10 * rng.randint(max(1, int(lo) // 10 + 1), max(1, int(hi) // 10))


def sample(rng: random.Random) -> dict:
    n = rng.choice([2, 3, 4])
    while True:
        y = 10 * rng.randint(150, 600)
        f = {"Y": y}
        for k in LEAK[n]:
            lo, hi = SHARE[k]
            f[k] = _tens(rng, y * lo, y * hi)
        wd = sum(f[k] for k in LEAK[n])
        f["C"] = y - wd
        level = n > 2 and rng.random() < 0.15  # injections exactly equal to withdrawals now and then
        for k, w in zip(INJECT[n], LEAK[n]):
            f[k] = _tens(rng, f[w] * 0.6, f[w] * 1.5)
        inj = sum(f[k] for k in INJECT[n])
        if level:
            last = INJECT[n][-1]
            f[last] += wd - inj
            if not 0.5 * f[LEAK[n][-1]] <= f[last] <= 1.6 * f[LEAK[n][-1]]:
                continue
        inj = sum(f[k] for k in INJECT[n])
        if inj != wd and abs(inj - wd) < max(30, wd // 20):
            continue  # no near-tie: income plainly rises or falls
        if f["C"] < y // 2 or len({f[k] for k in f}) < len(f):
            continue
        ask = "difference" if n == 2 else rng.choice(["injections", "withdrawals"])
        return {"band": "UP", "sectors": n, "flows": f, "blank": rng.choice(["C", "Y"]), "ask": ask}


def _label(p: dict, k: str) -> str:
    v = "?" if k == p["blank"] else frw(p["flows"][k])
    return f"{NAME[k]} ({k})\n{v}"


def _arrow(ax, x0: float, x1: float, y: float) -> None:
    ax.annotate("", xy=(x1, y), xytext=(x0, y), zorder=3,
                arrowprops={"arrowstyle": "-|>", "color": INK, "linewidth": 1.5, "mutation_scale": 15, "shrinkA": 0,
                            "shrinkB": 0})


def _box(ax, x0: float, y0: float, w: float, h: float, words: str, bold: bool = False) -> None:
    from matplotlib.patches import FancyBboxPatch
    ax.add_patch(FancyBboxPatch((x0, y0), w, h, boxstyle="round,pad=0,rounding_size=0.12", facecolor="#eef0f2" if bold else "white",
                                edgecolor=INK, linewidth=1.4, zorder=2))
    ax.text(x0 + w / 2, y0 + h / 2, words, ha="center", va="center", fontsize=11 if bold else 10.5,
            fontweight="bold" if bold else "normal", zorder=4)


def draw(p: dict):
    n = p["sectors"]
    mids = [Y_ARROW + ROW * (i + 1) for i in range(n - 1)]
    y_c = mids[-1] + ROW
    top = y_c + 1.05
    fig, ax = new_figure()
    left, right = BOX_W, W - BOX_W
    _box(ax, 0, 0, BOX_W, top, "Households", bold=True)
    _box(ax, right, 0, BOX_W, top, "Firms", bold=True)
    mx0, mx1 = W / 2 - MID_W / 2, W / 2 + MID_W / 2
    for i, (y, w, j) in enumerate(zip(mids, LEAK[n], INJECT[n])):
        _box(ax, mx0, y - MID_H / 2, MID_W, MID_H, MIDDLE[i])
        _arrow(ax, left, mx0, y)
        _arrow(ax, mx1, right, y)
        ax.text((left + mx0) / 2, y + 0.12, _label(p, w), ha="center", va="bottom", fontsize=9.5, linespacing=1.2)
        ax.text((mx1 + right) / 2, y + 0.12, _label(p, j), ha="center", va="bottom", fontsize=9.5, linespacing=1.2)
    _arrow(ax, left, right, y_c)  # spending on domestic goods, households to firms
    ax.text(W / 2, y_c + 0.12, _label(p, "C"), ha="center", va="bottom", fontsize=9.5, linespacing=1.2)
    _arrow(ax, right, left, Y_ARROW)  # incomes for the factors of production, firms to households
    ax.text(W / 2, Y_ARROW - 0.12, _label(p, "Y"), ha="center", va="top", fontsize=9.5, linespacing=1.2)
    ax.text(W / 2, top + 0.45, "Circular flow of income (billion Frw per year)", ha="center", va="center", fontsize=11.5,
            fontweight="bold")
    ax.set_xlim(-0.1, W + 0.1)
    ax.set_ylim(-0.1, top + 0.9)
    ax.set_aspect("equal")
    ax.axis("off")
    scale = 0.52
    fig.set_size_inches(scale * (W + 0.2), scale * (top + 1.0))
    ax.set_position([0, 0, 1, 1])
    return fig


VERBS = ["studies", "is given", "copies", "looks at", "works from"]
SETTINGS = ["in an economics lesson", "for homework", "on a revision card", "for a class test", "at the economics club",
            "before a mock exam", "in a study group in Huye", "while revising in Kigali"]
MODEL = {2: "a two-sector", 3: "a three-sector", 4: "a four-sector (open)"}


def _list(keys: str) -> str:
    words = [f"{NAME[k].lower()} ({k})" for k in keys]
    return words[0] if len(words) == 1 else ", ".join(words[:-1]) + " and " + words[-1]


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    n, f = p["sectors"], p["flows"]
    leak, inject = LEAK[n], INJECT[n]
    wd, inj = sum(f[k] for k in leak), sum(f[k] for k in inject)
    ident = "Y = C + " + " + ".join(leak)
    if p["blank"] == "C":
        what, key = "consumer spending (C)", f["Y"] - wd
    else:
        what, key = "household income (Y)", f["C"] + wd
    qs = [short(f"{who} {rng.choice(VERBS)} this circular flow of income in {MODEL[n]} economy {rng.choice(SETTINGS)}. "
                f"Households spend their income on domestic goods (C) or withdraw it as {_list(leak)}, so {ident}. "
                f"What is {what}, marked ?, in billion Frw?", key, _bn(key))]
    if p["ask"] == "injections":
        qs.append(short(f"Injections into the circular flow are {_list(inject)}: {' + '.join(inject)}. What are total "
                        "injections in this economy, in billion Frw?", inj, _bn(inj)))
    elif p["ask"] == "withdrawals":
        qs.append(short(f"Withdrawals (leakages) from the circular flow are {_list(leak)}: {' + '.join(leak)}. What are "
                        "total withdrawals in this economy, in billion Frw?", wd, _bn(wd)))
    else:
        gap = abs(inj - wd)
        qs.append(short("In this two-sector economy, investment (I) is the only injection and savings (S) the only "
                        "withdrawal. What is the difference between them, in billion Frw?", gap, _bn(gap)))
    key = "It rises" if inj > wd else "It falls" if inj < wd else "It stays the same"
    qs.append(mcq("National income rises when total injections are greater than total withdrawals, and falls when they "
                  "are smaller. What happens to national income in this economy?", key,
                  ["It rises", "It falls", "It stays the same"], rng))
    return qs


def _bn(v: int) -> list[str]:
    """A number of billions of francs in the forms a student may write."""
    out = []
    for n in (str(v), frw(v), f"{v:,}"):
        for unit in ("", " billion", " billion Frw", " bn", " billion francs", " Frw"):
            if n + unit not in out:
                out.append(n + unit)
    return out
