"""Gene mutations (UP, AL): the coding strand of a short gene before and after a mutation, its bases in boxes grouped
in triplets and the triplets numbered, beside a table of the amino acid each triplet in the figure codes for (the
standard genetic code, written for the coding strand, so T stands where mRNA has U).

The gene starts with ATG and no complete triplet, before or after, is a stop. One of four mutations: a substitution
(one base changed, which may leave the amino acid the same), an insertion or a deletion of one base (the reading frame
shifts, so the bases left over at the end form no triplet), or an inversion (three bases reversed, the first and last
different).

What type of mutation happened; which amino acid a triplet of the mutated DNA codes for; how many complete triplets of
the mutated DNA code for a different amino acid from the triplet in the same place before.
"""
from __future__ import annotations

import random

from matplotlib.patches import Rectangle

from ..core import INK, NAMES, count, mcq, new_figure, short

ID = "mutation_sequence"
KIND = "bio.genetics"
SUBJECT = "biology"
BANDS = ("UP", "AL")
CONCEPTS = tuple(f"biology.{c}" for c in ("genes-mutations", "nucleic-acids-protein-synthesis"))
# A topic whose sections the book lists is reached only if one names mutations or a change in the genetic code.
NEEDS = r"mutation|mutant|alteration of nucleotide|change in (?:the )?genetic code"
AVOID = (r"sexual|contracept|pregnan|\bstis?\b|\bhiv\b|social factors|glossary|science in context|reproduction system|"
         r"evolution|selection|cell cycle|gametogenesis|variation|^genetics$|gene technology|genetic technology")

CODE = {
    "phenylalanine": ["TTT", "TTC"], "leucine": ["TTA", "TTG", "CTT", "CTC", "CTA", "CTG"],
    "isoleucine": ["ATT", "ATC", "ATA"], "methionine": ["ATG"], "valine": ["GTT", "GTC", "GTA", "GTG"],
    "serine": ["TCT", "TCC", "TCA", "TCG", "AGT", "AGC"], "proline": ["CCT", "CCC", "CCA", "CCG"],
    "threonine": ["ACT", "ACC", "ACA", "ACG"], "alanine": ["GCT", "GCC", "GCA", "GCG"], "tyrosine": ["TAT", "TAC"],
    "histidine": ["CAT", "CAC"], "glutamine": ["CAA", "CAG"], "asparagine": ["AAT", "AAC"], "lysine": ["AAA", "AAG"],
    "aspartic acid": ["GAT", "GAC"], "glutamic acid": ["GAA", "GAG"], "cysteine": ["TGT", "TGC"],
    "tryptophan": ["TGG"], "arginine": ["CGT", "CGC", "CGA", "CGG", "AGA", "AGG"],
    "glycine": ["GGT", "GGC", "GGA", "GGG"], "stop": ["TAA", "TAG", "TGA"],
}
AMINO = {t: a for a, ts in CODE.items() for t in ts}
SHORT = {"phenylalanine": "Phe", "leucine": "Leu", "isoleucine": "Ile", "methionine": "Met", "valine": "Val",
         "serine": "Ser", "proline": "Pro", "threonine": "Thr", "alanine": "Ala", "tyrosine": "Tyr", "histidine": "His",
         "glutamine": "Gln", "asparagine": "Asn", "lysine": "Lys", "aspartic acid": "Asp", "glutamic acid": "Glu",
         "cysteine": "Cys", "tryptophan": "Trp", "arginine": "Arg", "glycine": "Gly"}
TYPES = ["substitution", "insertion", "deletion", "inversion"]


def triplets(seq: str) -> list:
    return [seq[i:i + 3] for i in range(0, len(seq) - 2, 3)]


def _mutate(rng: random.Random, a: str, kind: str) -> tuple[str, int]:
    # a frame shift early in the gene, so it changes several triplets after it
    at = rng.randrange(3, len(a) // 2 + 2) if kind in ("insertion", "deletion") else rng.randrange(3, len(a) - 2)
    if kind == "substitution":
        return a[:at] + rng.choice([b for b in "ATGC" if b != a[at]]) + a[at + 1:], at
    if kind == "insertion":
        return a[:at] + rng.choice("ATGC") + a[at:], at
    if kind == "deletion":
        return a[:at] + a[at + 1:], at
    return a[:at] + a[at:at + 3][::-1] + a[at + 3:], at


def sample(rng: random.Random) -> dict:
    kind = rng.choice(TYPES)
    n = rng.choice([5, 6])
    sense = [t for t in AMINO if AMINO[t] != "stop"]
    while True:
        a = "ATG" + "".join(rng.choice(sense) for _ in range(n - 1))
        b, at = _mutate(rng, a, kind)
        if kind == "inversion" and a[at] == a[at + 2]:
            continue
        if any(AMINO[t] == "stop" for t in triplets(b)):
            continue
        break
    tb, ta = triplets(b), triplets(a)
    hit = at // 3
    if kind in ("substitution", "inversion"):
        ask = hit + 1 if hit < len(tb) else len(tb)
        if kind == "inversion" and (at + 2) // 3 != hit and rng.random() < 0.5:
            ask = (at + 2) // 3 + 1
    else:
        ask = rng.randint(min(hit + 1, len(tb)), len(tb))
    return {"band": rng.choice(BANDS), "original": a, "mutated": b, "type": kind, "at": at, "ask": ask}


# --- drawing ------------------------------------------------------------------------------------------------------

W, GAP = 0.42, 0.22  # a base's box, and the extra gap between triplets


def _row(ax, seq: str, y: float, x0: float, numbers: bool):
    whole = len(seq) // 3
    for i, base in enumerate(seq):
        x = x0 + i * W + (i // 3) * GAP
        spare = i >= 3 * whole
        ax.add_patch(Rectangle((x, y), W, 0.5, facecolor="white" if spare else "#eef1f3", edgecolor=INK,
                               linewidth=1.0, linestyle="--" if spare else "-"))
        ax.text(x + W / 2, y + 0.25, base, ha="center", va="center", fontsize=12, fontweight="bold")
    if numbers:
        for k in range(whole):
            x = x0 + 3 * k * W + k * GAP + 1.5 * W
            ax.text(x, y + 0.72, str(k + 1), ha="center", va="center", fontsize=9)


def draw(p: dict):
    a, b = p["original"], p["mutated"]
    fig, ax = new_figure()
    x0 = 2.3
    ax.text(0, 4.95, "Coding strand of a gene, read in triplets from left to right", ha="left", va="center",
            fontsize=10.5, fontweight="bold")
    ax.text(0, 3.75, "Original DNA", ha="left", va="center", fontsize=10.5)
    _row(ax, a, 3.5, x0, True)
    ax.text(0, 2.05, "Mutated DNA", ha="left", va="center", fontsize=10.5)
    _row(ax, b, 1.8, x0, True)
    right = x0 + max(len(a), len(b)) * W + (max(len(a), len(b)) // 3) * GAP
    if len(b) % 3:
        ax.text(x0, 1.45, "dashed boxes: bases left over, not a complete triplet", ha="left", va="top", fontsize=8.5)
    # the table of the triplets in the figure
    seen = sorted(set(triplets(a)) | set(triplets(b)))
    tx = right + 0.7
    ax.text(tx, 4.95, "Triplet – amino acid", ha="left", va="center", fontsize=10, fontweight="bold")
    per = 7
    cols = (len(seen) + per - 1) // per
    for i, t in enumerate(seen):
        c, r = i // per, i % per
        ax.text(tx + c * 2.65, 4.45 - r * 0.46, f"{t} – {AMINO[t]}", ha="left", va="center", fontsize=9.5)
    ax.set_xlim(-0.1, tx + cols * 2.65 + 0.1)
    ax.set_ylim(min(4.45 - (per - 1) * 0.46, 1.0) - 0.35, 5.25)
    ax.set_aspect("equal")
    ax.axis("off")
    xr, yr = ax.get_xlim(), ax.get_ylim()
    fig.set_size_inches(0.78 * (xr[1] - xr[0]), 0.78 * (yr[1] - yr[0]))
    ax.set_position([0, 0, 1, 1])
    return fig


# --- questions ----------------------------------------------------------------------------------------------------

SETTINGS = ["in a biology lesson", "for revision", "for a class test", "at the science club in Huye",
            "for homework", "while revising in Kigali"]
VERBS = ["compares", "looks at", "studies"]


def questions(p: dict, rng: random.Random) -> list:
    a, b = p["original"], p["mutated"]
    ta, tb = triplets(a), triplets(b)
    k = p["ask"]
    amino = AMINO[tb[k - 1]]
    changed = sum(AMINO[x] != AMINO[y] for x, y in zip(ta, tb))
    who = rng.choice(NAMES)
    return [mcq(f"{who} {rng.choice(VERBS)} the original and the mutated DNA {rng.choice(SETTINGS)}. What type of gene "
                f"mutation has happened?", p["type"], [t for t in TYPES if t != p["type"]], rng),
            short(f"Use the table. Which amino acid does triplet {k} of the mutated DNA code for?", amino,
                  [amino.capitalize(), SHORT[amino], SHORT[amino].upper()]),
            count("Compare each complete triplet of the mutated DNA with the original triplet in the same place. How "
                  "many of them code for a different amino acid?", changed, "triplets")]
