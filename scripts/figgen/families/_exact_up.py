"""Exact answers as students write them (P6 upper-secondary maths): multiples of pi, surds, fractions, and the
decimals a calculator gives for them. Each helper returns the printed form first, as the key, then every fair form."""
from __future__ import annotations

import math
from decimal import ROUND_HALF_UP, Decimal
from fractions import Fraction


def _add(out: list, *forms: str) -> None:
    for f in forms:
        if f not in out:
            out.append(f)


def fr(x: Fraction) -> str:
    """3, -2, 3/4, -5/2."""
    x = Fraction(x)
    return str(x.numerator) if x.denominator == 1 else f"{x.numerator}/{x.denominator}"


def dec(x: Fraction) -> str | None:
    """A fraction as a terminating decimal ("0.75", "-2.5"), or None when it does not terminate."""
    x = Fraction(x)
    d = x.denominator
    while d % 2 == 0:
        d //= 2
    while d % 5 == 0:
        d //= 5
    if d != 1:
        return None
    s = format(Decimal(x.numerator) / Decimal(x.denominator), "f")
    return s.rstrip("0").rstrip(".") if "." in s else s


def rounded(v: float) -> list[str]:
    """A calculator value to 3 significant figures, 1 and 2 decimal places, and the nearest whole number when it is
    100 or more (half up from the decimal as printed)."""
    out: list[str] = []
    d = Decimal(repr(v))
    if v != 0:
        sig = d.quantize(Decimal(1).scaleb(d.adjusted() - 2), rounding=ROUND_HALF_UP)
        _add(out, format(sig.normalize(), "f") if sig == sig.to_integral() else format(sig, "f"))
    for places in ("0.1", "0.01"):
        _add(out, format(d.quantize(Decimal(places), rounding=ROUND_HALF_UP), "f"))
    if abs(v) >= 100:
        _add(out, str(int(d.quantize(Decimal(1), rounding=ROUND_HALF_UP))))
    return out


def fraction_forms(x: Fraction) -> list[str]:
    """3/4 as "3/4" and "0.75"; -5/2 as "-5/2", "−5/2", "-2.5"."""
    x = Fraction(x)
    out = [fr(x)]
    d = dec(x)
    if d:
        _add(out, d)
        if d.startswith("-0."):
            _add(out, "-" + d[2:])
        elif d.startswith("0."):
            _add(out, d[1:])
    for f in list(out):
        if f.startswith("-"):
            _add(out, "−" + f[1:])
    return out


def pi_text(c: Fraction) -> str:
    """c times pi as printed: "π", "4π", "2π/3", "-π/6"."""
    c = Fraction(c)
    n, d = c.numerator, c.denominator
    top = ("-" if n < 0 else "") + ("" if abs(n) == 1 else str(abs(n))) + "π"
    return top if d == 1 else f"{top}/{d}"


def pi_forms(c: Fraction, unit: str = "") -> list[str]:
    """c pi in every fair form: "4π/3", "4/3π", "(4/3)π", "4pi/3", "4/3 pi", the calculator value; with the unit too."""
    c = Fraction(c)
    n, d = c.numerator, c.denominator
    k = "" if abs(n) == 1 else str(abs(n))
    s = "-" if n < 0 else ""
    out = [pi_text(c)]
    if d == 1:
        _add(out, f"{s}{k}pi", f"{s}{k} pi", f"{s}{k}*π", f"{s}{k}×π", f"{s}{k} π")
    else:
        _add(out, f"{s}{k}pi/{d}", f"{s}{abs(n)}/{d}π", f"{s}{abs(n)}/{d} π", f"{s}({abs(n)}/{d})π", f"{s}{abs(n)}/{d}pi",
             f"{s}{abs(n)}/{d} pi", f"{s}({abs(n)}/{d})pi", f"{s}{abs(n)}π/{d}", f"{s}{abs(n)}pi/{d}")
    _add(out, *rounded(float(c) * math.pi))
    if unit:
        for f in list(out):
            _add(out, f"{f} {unit}")
    return out


def plus_pi_forms(a: Fraction, c: Fraction, unit: str = "") -> list[str]:
    """a + c pi (a perimeter of straight parts and arcs): "12 + 4π", "4π + 12", "12+4pi", the calculator value."""
    a, c = Fraction(a), Fraction(c)
    p = pi_text(c)
    out = [f"{fr(a)} + {p}"]
    for x in (p, p.replace("π", "pi")):
        _add(out, f"{fr(a)} + {x}", f"{fr(a)}+{x}", f"{x} + {fr(a)}", f"{x}+{fr(a)}")
    _add(out, *rounded(float(a) + float(c) * math.pi))
    if unit:
        for f in list(out):
            _add(out, f"{f} {unit}")
    return out


def simplest_surd(n: int) -> tuple[int, int]:
    """sqrt(n) as k sqrt(m) with m square-free: 72 -> (6, 2)."""
    k, m = 1, n
    f = 2
    while f * f <= m:
        while m % (f * f) == 0:
            m //= f * f
            k *= f
        f += 1
    return k, m


def surd_text(k: int, m: int) -> str:
    """k sqrt(m) as printed: "6√2", "√5", "4"."""
    if m == 1:
        return str(k)
    return ("" if k == 1 else str(k)) + f"√{m}"


def surd_forms(k: int, m: int, unit: str = "") -> list[str]:
    """k sqrt(m) in every fair form: "6√2", "6sqrt2", "6 sqrt(2)", "6root2", "√72", the calculator value."""
    out = [surd_text(k, m)]
    if m != 1:
        c = "" if k == 1 else str(k)
        _add(out, f"{c}sqrt{m}", f"{c}sqrt({m})", f"{c} sqrt({m})", f"{c} sqrt {m}", f"{c}root{m}", f"{c} root {m}",
             f"{c}√({m})", f"{c} √{m}", f"√{k * k * m}", f"sqrt({k * k * m})")
        _add(out, *rounded(k * math.sqrt(m)))
    if unit:
        for f in list(out):
            _add(out, f"{f} {unit}")
    return out
