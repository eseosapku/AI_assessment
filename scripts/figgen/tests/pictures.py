"""Pictures for the image tests: random ellipses, different for each seed, the same every time."""
import random

from PIL import Image, ImageDraw


def picture(seed: int, size=(640, 480)) -> Image.Image:
    rng = random.Random(seed)
    img = Image.new("RGB", size, "white")
    d = ImageDraw.Draw(img)
    for _ in range(25):
        x, y = rng.randrange(size[0]), rng.randrange(size[1])
        d.ellipse((x, y, x + rng.randrange(20, 160), y + rng.randrange(20, 160)), fill=tuple(rng.randrange(256) for _ in range(3)))
    return img
