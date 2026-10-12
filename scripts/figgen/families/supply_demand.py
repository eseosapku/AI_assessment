"""Supply and demand with one curve shifted. Both equilibria fall on gridline crossings."""
from __future__ import annotations

import random

from ..core import GRID, mcq, new_figure, short

ID = "supply_demand"
KIND = "econ.curve"
SUBJECT = "economics"
BANDS = ("UP",)

GOODS = ["maize", "rice", "cement", "school uniforms", "mobile phones", "coffee"]
CHANGES = {
    "demand_up": ("Incomes rise, so demand for {g} increases (D1 to D2).", "D"),
    "demand_down": ("A cheaper substitute appears, so demand for {g} falls (D1 to D2).", "D"),
    "supply_up": ("A good harvest or new technology increases the supply of {g} (S1 to S2).", "S"),
    "supply_down": ("A rise in production costs reduces the supply of {g} (S1 to S2).", "S"),
}


def sample(rng: random.Random) -> dict:
    while True:
        b, d = rng.choice([1, 2]), rng.choice([1, 2])  # slopes, price per unit of quantity
        qe, pe = rng.randint(4, 8), rng.randint(8, 14)
        a, c = pe + b * qe, pe - d * qe  # demand P = a - bQ, supply P = c + dQ
        change = rng.choice(sorted(CHANGES))
        k = rng.choice([1, 2])
        if change.startswith("demand"):
            s = k * (b + d) * (1 if change.endswith("up") else -1)  # horizontal shift keeping the new equilibrium on the grid
            q2 = qe + b * s // (b + d)
            p2 = c + d * q2
        else:
            s = k * (b + d) * (1 if change.endswith("up") else -1)
            q2 = qe + d * s // (b + d)
            p2 = a - b * q2
        if c >= 0 and 1 <= q2 <= 14 and 1 <= p2 <= 24:
            return {"good": rng.choice(GOODS), "a": a, "b": b, "c": c, "d": d, "qe": qe, "pe": pe,
                    "change": change, "shift": s, "q2": q2, "p2": p2}


def draw(p: dict):
    fig, ax = new_figure(5.6, 5.0)
    qs = [q / 10 for q in range(0, 161)]
    a, b, c, d, s = p["a"], p["b"], p["c"], p["d"], p["shift"]

    def line(f, label, style="-"):
        pts = [(q, f(q)) for q in qs if 0 <= f(q) <= 26]
        ax.plot([x for x, _ in pts], [y for _, y in pts], color="#111111", linestyle=style)
        x, y = pts[-1] if label.startswith("S") else pts[-1]
        ax.text(x + 0.2, y, label, fontsize=11, fontweight="bold")

    line(lambda q: a - b * q, "D1")
    line(lambda q: c + d * q, "S1")
    if p["change"].startswith("demand"):
        line(lambda q: a - b * (q - s), "D2", "--")
    else:
        line(lambda q: c + d * (q - s), "S2", "--")
    ax.set_xticks(range(0, 17))
    # A gridline on every dollar: equilibrium prices can be odd.
    ax.set_yticks(range(0, 27))
    ax.tick_params(axis="y", labelsize=8)
    ax.set_xlim(0, 16)
    ax.set_ylim(0, 26)
    ax.grid(True, color=GRID, linewidth=0.5)
    ax.set_axisbelow(True)
    ax.set_xlabel("Quantity (thousand units)")
    ax.set_ylabel("Price ($)")
    ax.set_title(f"The market for {p['good']}")
    return fig


def questions(p: dict, rng: random.Random) -> list:
    text = CHANGES[p["change"]][0].format(g=p["good"])
    moved = "rises" if p["p2"] > p["pe"] else "falls"
    return [
        short("What is the equilibrium price before the change, in $?", p["pe"], [f"${p['pe']}", f"{p['pe']} dollars"]),
        short("What is the equilibrium quantity before the change, in thousand units?", p["qe"],
              [f"{p['qe']} thousand", f"{p['qe']}000", f"{p['qe']},000"]),
        mcq(f"{text} What happens to the equilibrium price?", f"It {moved}",
            [f"It {'falls' if moved == 'rises' else 'rises'}", "It stays the same"], rng),
        short(f"{text} What is the new equilibrium price, in $?", p["p2"], [f"${p['p2']}"]),
    ]
