"""Caesar ciphers (LS, UP): the plain alphabet over the cipher alphabet shifted along by 1 to 25 places, the shift
stated. A word to encrypt, and a coded word to decrypt.

Every key is the shift applied: each letter moves the stated number of places along the alphabet, Z wrapping to A.
Keys are in capitals; the app's marker ignores case, so a lowercase answer is the same word.
"""
from __future__ import annotations

import random
import string

from matplotlib.patches import Rectangle

from ..core import INK, NAMES, new_figure, short

ID = "caesar_cipher"
KIND = "cs.structure"
SUBJECT = "computing"
BANDS = ("LS", "UP")
CONCEPTS = tuple(f"computing.{c}" for c in ("cipher-encryption", "computer-security-terms"))
AVOID = r"spreadsheet|database|graphic|presentation|html|logic gate|boolean|word processing|protecting a document|internet and email|searching the internet"
# A topic whose sections the book lists is reached only if one names what this figure teaches.
NEEDS = r"encrypt|cipher|cypher|security|cryptograph|caesar|protect"
WORDS = ["SCHOOL", "RIVER", "MANGO", "BANANA", "VOLCANO", "MARKET", "LAKE", "COFFEE", "GORILLA", "HILLS", "DRUM", "BREAD",
         "PLANET", "WATER", "GARDEN", "TEACHER", "BOOK", "CLOUD", "RAIN", "FOREST", "BICYCLE", "MILK", "HONEY", "ZEBRA",
         "KIGALI", "MUSANZE", "HUYE", "RUBAVU", "NYUNGWE", "AKAGERA"]
ABC = string.ascii_uppercase


def caesar(word: str, shift: int) -> str:
    return "".join(ABC[(ABC.index(c) + shift) % 26] for c in word)


def sample(rng: random.Random) -> dict:
    return {"band": rng.choice(BANDS), "shift": rng.randint(1, 25), "words": rng.sample(WORDS, 2)}


def draw(p: dict):
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


def questions(p: dict, rng: random.Random) -> list:
    who, friend = rng.sample(NAMES, 2)
    plain, other = p["words"]
    k = p["shift"]
    coded, sent = caesar(plain, k), caesar(other, k)
    return [short(f"{who} uses this Caesar cipher {rng.choice(SETTINGS)}. Encrypt the word {plain}.", coded, [coded]),
            short(f"{friend} sends a word coded with this cipher. Decrypt the word {sent}.", other, [other])]
