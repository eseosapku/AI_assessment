"""DNA strands (UP, AL): a ladder of 10 base pairs, numbered, the upper strand lettered and the lower strand
lettered only in places (the rest shown "?"). The base hidden at a numbered place, how many of one base the
section holds, the percentage of a base, at AL the mRNA made from the lower (template) strand, and the hydrogen
bonds in a pair.

Every pair is complementary (A with T, G with C); a hidden base is asked only where it is hidden.
"""
from __future__ import annotations

import random

from matplotlib.patches import Rectangle

from ..core import INK, NAMES, exact, new_figure, short

ID = "dna_strand"
KIND = "bio.genetics"
SUBJECT = "biology"
BANDS = ("UP", "AL")
CONCEPTS = tuple(f"biology.{c}" for c in ("dna-structure", "nucleic-acids-protein-synthesis", "dna-replication"))
AVOID = r"plant|photosynth|ecolog|population|enzyme|immun|digest|respiration|transport|pedigree|selection|technology|inherited|mitotic|division"
# A topic whose sections the book lists is reached only if one names what this figure teaches.
NEEDS = r"\bdna\b|nucleic|base pair|replication|protein synthesis|transcription|genetic code"
PAIR = {"A": "T", "T": "A", "G": "C", "C": "G"}
WORD = {"A": "adenine", "T": "thymine", "G": "guanine", "C": "cytosine"}
N = 10


def sample(rng: random.Random) -> dict:
    top = "".join(rng.choice("ATGC") for _ in range(N))
    bottom = "".join(PAIR[b] for b in top)
    hidden = sorted(rng.sample(range(N), rng.randint(4, 6)))
    shown = [i for i in range(N) if i not in hidden]
    return {"band": rng.choice(BANDS), "top": top, "bottom": bottom, "shown": shown, "ask": rng.choice(hidden),
            "count": rng.choice("ATGC"), "pct": rng.choice("ATGC"), "codon": rng.randrange(N - 2), "bonds": rng.randrange(N)}


def draw(p: dict):
    fig, ax = new_figure(7.4, 2.9)
    w = 0.62
    for i in range(N):
        x = i * 0.75
        ax.text(x + w / 2, 2.55, str(i + 1), ha="center", va="center", fontsize=9)
        for y, base, show in ((1.65, p["top"][i], True), (0.15, p["bottom"][i], i in p["shown"])):
            ax.add_patch(Rectangle((x, y), w, 0.55, facecolor="#eef1f3", edgecolor=INK, linewidth=1.1))
            ax.text(x + w / 2, y + 0.275, base if show else "?", ha="center", va="center", fontsize=13, fontweight="bold")
        ax.plot([x + w / 2, x + w / 2], [0.7, 1.65], color=INK, linewidth=1.0, linestyle=(0, (2, 2)))
    end = (N - 1) * 0.75 + w
    ax.plot([0, end], [2.25, 2.25], color=INK, linewidth=2.2)  # the sugar-phosphate backbones
    ax.plot([0, end], [0.05, 0.05], color=INK, linewidth=2.2)
    ax.text(end + 0.5, 1.92, "upper strand", ha="left", va="center", fontsize=9)
    ax.text(end + 0.5, 0.42, "lower strand", ha="left", va="center", fontsize=9)
    # The ends, so the codon's direction is fixed: upper strand 5′ to 3′ left to right, the lower antiparallel (P3j review)
    for y, left, right in ((1.92, "5′", "3′"), (0.42, "3′", "5′")):
        ax.text(-0.12, y, left, ha="right", va="center", fontsize=10, fontweight="bold")
        ax.text(end + 0.12, y, right, ha="left", va="center", fontsize=10, fontweight="bold")
    ax.set_xlim(-0.6, end + 2.0)
    ax.set_ylim(-0.15, 2.8)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


SETTINGS = ["in a biology lesson", "on a revision card", "for homework", "at the science club", "in a genetics class"]


def questions(p: dict, rng: random.Random) -> list:
    who, friend = rng.sample(NAMES, 2)
    top, bottom = p["top"], p["bottom"]
    k = p["ask"] + 1
    hid = bottom[k - 1]
    both = top + bottom
    c = p["count"]
    n_c = both.count(c)
    pct = p["pct"]
    v = exact(100 * both.count(pct) / (2 * N))
    qs = [short(f"{who} drew this section of DNA {rng.choice(SETTINGS)}. Which base goes at position {k} on the lower strand?",
                hid, [hid, WORD[hid], WORD[hid].capitalize()]),
          short(f"How many {WORD[c]} bases are there in this section, on both strands?", n_c, [str(n_c), f"{n_c} bases"]),
          short(f"{friend} counts the bases in both strands. What percentage of the bases in this section are {WORD[pct]}?",
                v, [v, f"{v}%", f"{v} %"])]
    if p["band"] == "AL":
        i = p["codon"] + 1
        codon = top[i - 1:i + 2].replace("T", "U")
        # "left to right": reviewers read the template backwards one time in six (P3j fix review)
        qs.append(short(f"The lower strand is the template. Give the mRNA codon made from bases {i} to {i + 2} of the lower strand, written 5′ to 3′ (left to right).",
                        codon, [codon, "-".join(codon), " ".join(codon), f"5′-{codon}-3′", f"5'-{codon}-3'"]))
        j = p["bonds"] + 1
        h = 2 if top[j - 1] in "AT" else 3
        qs.append(short(f"How many hydrogen bonds hold base pair {j} together?", h, [str(h), f"{h} hydrogen bonds"]))
    return qs
