"""Perceptual hashes, to keep near-copies out (spec 5.3: a distance of 6 or more from anything held)."""
from __future__ import annotations

from PIL import Image

MIN_DISTANCE = 6


def dhash(img: Image.Image) -> int:
    """64-bit difference hash: does each pixel of a 9x8 grey copy get brighter towards its right?"""
    grey = img.convert("L").resize((9, 8), Image.Resampling.LANCZOS)
    px = list(grey.getdata())
    bits = 0
    for row in range(8):
        for col in range(8):
            bits = (bits << 1) | int(px[row * 9 + col] < px[row * 9 + col + 1])
    return bits


def distance(a: int, b: int) -> int:
    return bin(a ^ b).count("1")
