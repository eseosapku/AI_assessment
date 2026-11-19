import re
from pathlib import Path
from PIL import Image, ImageEnhance, ImageOps

root = Path(r"c:\Users\hp\Desktop\update\AI_assessment\qa-artifacts\non-english")

def form_slice(name, needles):
    raw = (root / name).read_text(encoding="utf-8", errors="replace")
    print("=" * 20, name, "=" * 20)
    for needle in needles:
        idx = raw.find(needle)
        print(f"\n--- needle {needle!r} at {idx} ---")
        if idx < 0:
            continue
        chunk = raw[max(0, idx - 500) : idx + 1200]
        chunk = re.sub(r"\s+", " ", chunk)
        print(chunk)

form_slice(
    "forgot-password-dump-dom.html",
    ["Forgot password?", "Email address", 'id="email"', "Send verification code", "Back to Login"],
)
form_slice(
    "signup-dump-dom.html",
    ['id="password"', 'id="confirmPassword"', "Create Student Account"],
)

# Contrast-stretch the forgot-password shot and crop signup regions.
forgot = Image.open(root / "forgot-password-1440x900.png").convert("RGB")
stretched = ImageOps.autocontrast(forgot, cutoff=1)
stretched.save(root / "forgot-password-autocontrast.png")
signup = Image.open(root / "signup-1440x900.png").convert("RGB")
signup.crop((700, 520, 1440, 900)).save(root / "signup-crop-form.png")
signup.crop((0, 700, 500, 900)).save(root / "signup-crop-bottom-left.png")
home = Image.open(root / "home-1440x900.png").convert("RGB")
home.crop((0, 760, 400, 900)).save(root / "home-crop-bottom-left.png")
print("crops written")
