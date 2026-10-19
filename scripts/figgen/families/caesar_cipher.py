"""Caesar ciphers (LS, UP, AL): the plain alphabet over the cipher alphabet shifted along by 1 to 25 places, the shift
stated. A word to encrypt, and a coded word to decrypt.

Primary (Cambridge Primary Computing Stages 3 to 6, "Sending secret messages", "Be a code cracker"): a big code wheel
(plain letters round the outside, secret letters round the inside, turned by the shift) or two big alphabet strips, a
shift of 1 to 5 printed, and short words of three or four letters: encrypt a word, decrypt a word, and the secret
letter for one letter.

Every key is the shift applied: each letter moves the stated number of places along the alphabet, Z wrapping to A.
Keys are in capitals; the app's marker ignores case, so a lowercase answer is the same word.
"""
from __future__ import annotations

import random
import string

import math

from matplotlib.patches import Circle, Rectangle

from ..core import INK, NAMES, new_figure, short

ID = "caesar_cipher"
KIND = "cs.structure"
SUBJECT = "computing"
BANDS = ("LS", "UP", "AL", "P")  # AL: the security chapters' encryption; P: Primary secret messages
CONCEPTS = tuple(f"computing.{c}" for c in ("cipher-encryption", "computer-security-terms"))
AVOID = r"spreadsheet|database|graphic|presentation|html|logic gate|boolean|word processing|protecting a document|internet and email|searching the internet|e-safety|health and safety|in society|using networks|internet safety|citizenship"
# A topic whose sections the book lists is reached only if one names what this figure teaches.
NEEDS = r"encrypt|cipher|cypher|security|cryptograph|caesar|protect|secret"
WORDS = ["SCHOOL", "RIVER", "MANGO", "BANANA", "VOLCANO", "MARKET", "LAKE", "COFFEE", "GORILLA", "HILLS", "DRUM", "BREAD",
         "PLANET", "WATER", "GARDEN", "TEACHER", "BOOK", "CLOUD", "RAIN", "FOREST", "BICYCLE", "MILK", "HONEY", "ZEBRA",
         "KIGALI", "MUSANZE", "HUYE", "RUBAVU", "NYUNGWE", "AKAGERA"]
# Primary words: short, and every letter plain to a child reading aloud
P_WORDS = ["CAT", "DOG", "SUN", "BALL", "FISH", "BIRD", "TREE", "MILK", "GOAT", "COW", "BOOK", "CUP", "HAT", "BUS",
           "EGG", "RAIN", "STAR", "MOON", "DRUM", "FROG", "BEAN", "LION", "DUCK", "KITE"]
ABC = string.ascii_uppercase


def caesar(word: str, shift: int) -> str:
    return "".join(ABC[(ABC.index(c) + shift) % 26] for c in word)


def stages(p: dict) -> tuple[int, int] | None:
    return (3, 6) if p["band"] == "P" else None


def sample(rng: random.Random) -> dict:
    if rng.random() < 0.3:
        words = rng.sample(P_WORDS, 2)
        letter = rng.choice(sorted(set(ABC) - set("".join(words))))
        return {"band": "P", "style": rng.choice(["wheel", "strips"]), "shift": rng.randint(1, 5), "words": words,
                "letter": letter}
    return {"band": rng.choice(BANDS[:3]), "shift": rng.randint(1, 25), "words": rng.sample(WORDS, 2)}


def _draw_wheel(p: dict):
    k = p["shift"]
    fig, ax = new_figure(6.8, 7.4)
    ax.set_position([0, 0, 1, 1])
    r_out, r_mid, r_in = 2.75, 2.0, 1.25
    for r, fill in ((r_out, "#d9dee3"), (r_mid, "#ffffff"), (r_in, "#f2f3f4")):
        ax.add_patch(Circle((0, 0), r, facecolor=fill, edgecolor=INK, linewidth=1.4))
    for i in range(26):
        a = math.pi / 2 - (i + 0.5) * 2 * math.pi / 26
        ax.plot([r_in * math.cos(a), r_out * math.cos(a)], [r_in * math.sin(a), r_out * math.sin(a)], color=INK,
                linewidth=0.8)
    for i, c in enumerate(ABC):
        a = math.pi / 2 - i * 2 * math.pi / 26
        ax.text(2.38 * math.cos(a), 2.38 * math.sin(a), c, ha="center", va="center", fontsize=13, fontweight="bold",
                gid=f"plain:{c}")
        ax.text(1.62 * math.cos(a), 1.62 * math.sin(a), ABC[(i + k) % 26], ha="center", va="center", fontsize=12.5,
                gid=f"secret:{c}")
    ax.text(0, 0, f"Shift {k}", ha="center", va="center", fontsize=14, fontweight="bold")
    ax.text(0, 3.25, "Secret code wheel", ha="center", va="center", fontsize=14, fontweight="bold")
    ax.text(0, -3.1, "Outside ring: plain letter", ha="center", va="center", fontsize=11.5)
    ax.text(0, -3.5, "Inside ring: secret letter", ha="center", va="center", fontsize=11.5)
    ax.set_xlim(-3.4, 3.4)
    ax.set_ylim(-3.8, 3.6)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def _draw_strips(p: dict):
    k = p["shift"]
    w = 0.46
    fig, ax = new_figure(13.6, 2.6)
    ax.set_position([0, 0, 1, 1])
    x0 = 1.6
    for i, c in enumerate(ABC):
        for y, letter, fill, gid in ((1.15, c, "#d9dee3", "plain"), (0.45, ABC[(i + k) % 26], "#ffffff", "secret")):
            ax.add_patch(Rectangle((x0 + i * w, y), w, 0.6, facecolor=fill, edgecolor=INK, linewidth=0.9))
            ax.text(x0 + i * w + w / 2, y + 0.3, letter, ha="center", va="center", fontsize=13,
                    fontweight="bold" if y > 1 else "normal", gid=f"{gid}:{c}")
    ax.text(x0 - 0.12, 1.45, "Plain", ha="right", va="center", fontsize=12)
    ax.text(x0 - 0.12, 0.75, "Secret", ha="right", va="center", fontsize=12)
    ax.text(x0 + 13 * w, 2.15, f"Secret code: shift {k}", ha="center", va="center", fontsize=14, fontweight="bold")
    ax.set_xlim(0, x0 + 26 * w + 0.1)
    ax.set_ylim(0.3, 2.45)
    fig.set_size_inches(x0 + 26 * w + 0.1, 2.15)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def draw(p: dict):
    if p["band"] == "P":
        return _draw_wheel(p) if p["style"] == "wheel" else _draw_strips(p)
    k = p["shift"]
    fig, ax = new_figure(8.6, 2.2)
    w = 0.42
    x0 = 1.3
    for i, c in enumerate(ABC):
        for y, letter, fill in ((1.0, c, "#d9dee3"), (0.4, ABC[(i + k) % 26], "#ffffff")):
            ax.add_patch(Rectangle((x0 + i * w, y), w, 0.5, facecolor=fill, edgecolor=INK, linewidth=0.8))
            ax.text(x0 + i * w + w / 2, y + 0.25, letter, ha="center", va="center", fontsize=10.5, fontweight="bold" if y > 0.5 else "normal",
                    family="monospace")
    ax.text(x0 - 0.12, 1.25, "Plain", ha="right", va="center", fontsize=10)
    ax.text(x0 - 0.12, 0.65, "Cipher", ha="right", va="center", fontsize=10)
    ax.text(x0 + 13 * w, 1.85, f"Caesar cipher, shift {k}", ha="center", va="center", fontsize=12, fontweight="bold")
    ax.set_xlim(0, x0 + 26 * w + 0.1)
    ax.set_ylim(0.25, 2.15)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


SETTINGS = ["in a computing lesson", "for homework", "on a revision card", "at the coding club", "for a class test"]


P_SETTINGS = ["at school", "in the computer room", "at the coding club", "in class", "at home"]


def questions(p: dict, rng: random.Random) -> list:
    if p["band"] == "P":
        return _primary(p, rng)
    who, friend = rng.sample(NAMES, 2)
    plain, other = p["words"]
    k = p["shift"]
    coded, sent = caesar(plain, k), caesar(other, k)
    return [short(f"{who} uses this Caesar cipher {rng.choice(SETTINGS)}. Encrypt the word {plain}.", coded, [coded]),
            short(f"{friend} sends a word coded with this cipher. Decrypt the word {sent}.", other, [other])]


def _primary(p: dict, rng: random.Random) -> list:
    who, friend = rng.sample(NAMES, 2)
    plain, other = p["words"]
    k = p["shift"]
    coded, sent = caesar(plain, k), caesar(other, k)
    tool = "code wheel" if p["style"] == "wheel" else "secret code"
    secret = caesar(p["letter"], k)
    return [short(f"{who} uses this {tool} {rng.choice(P_SETTINGS)}. Encrypt the word {plain}: write it in secret code.",
                  coded, [coded, coded.lower()]),
            short(f"{friend} sends a secret word made with this {tool}. Decrypt the word {sent}: what is the plain word?",
                  other, [other, other.lower()]),
            short(f"With this {tool}, what secret letter does the letter {p['letter']} become?", secret,
                  [secret, secret.lower()])]
