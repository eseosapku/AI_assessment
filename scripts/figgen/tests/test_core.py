"""The shared pieces in core.py."""
from figgen.core import money


def test_an_amount_of_francs_is_accepted_in_every_fair_form():
    forms = money(1500)
    assert forms[0] == "1500"
    for f in ("1500", "1,500", "1500 Frw", "1,500 Frw", "1500 RWF", "1,500 RWF", "1500Frw", "1500 francs", "1 500"):
        assert f in forms, f
    assert len(forms) == len(set(forms))


def test_an_amount_under_a_thousand_has_no_comma():
    assert not any("," in f or " 0" in f for f in money(500))
    assert {"500", "500 Frw", "500 RWF"} <= set(money(500))


def test_a_rounding_is_offered_only_where_it_is_a_rounding():
    """'123' for 123.4567 would accept a whole number for a decimal key, and '1.23e+03' is no form at all."""
    from figgen.core import short
    big = short("s", "123.4567").accepted
    assert "123" not in big and not any("e+" in a for a in big)
    small = short("s", "0.234375").accepted
    assert {"0.234", "0.2344", ".234"} <= set(small)
    zeros = short("s", "0.200040").accepted
    assert "0.2" not in zeros and "0.200" in zeros


def test_a_measure_is_accepted_in_every_fair_form():
    """Physics answers carry units: "6 ohms" and "6Ω" are the same answer as "6 Ω" (P3e)."""
    from figgen.core import measure
    assert {"6", "6 Ω", "6Ω", "6 ohms", "6 ohm"} <= set(measure(6, "Ω"))
    assert measure(6, "Ω")[0] == "6"
    assert {"2.5", "2.5 N", "2.5N", "2.5 newtons", "2.5 newton"} <= set(measure(2.5, "N"))
    assert {"1200 J", "1,200 J", "1 200 J", "1200J", "1200 joules"} <= set(measure(1200, "J"))
    assert {"0.5 A", ".5 A", "0.5 amps", "500 mA"} <= set(measure(0.5, "A"))
    forms = measure(3, "m/s")
    assert "3 m/s" in forms and len(forms) == len(set(forms))
    # A temperature below zero, typed with a hyphen or set with a true minus sign; times in minutes.
    assert {"-20", "-20 °C", "−20", "−20 °C", "-20 degrees"} <= set(measure(-20, "°C"))
    assert {"6 min", "6 minutes"} <= set(measure(6, "min"))
    # The same quantity with a prefix (final review): 36 kJ, 0.02 s for 20 ms, 1.5 m for 150 cm, 500 mV.
    assert {"36 kJ", "36kJ"} <= set(measure(36000, "J"))
    assert {"0.02 s", "0.02s"} <= set(measure(20, "ms")) and "20 ms" in measure(0.02, "s")
    assert "1.5 m" in measure(150, "cm") and "500 mV" in measure(0.5, "V")
    assert {"1.95 kg", "1.95kg"} <= set(measure(1950, "g"))  # "1950 g (1.95 kg)" (P3f review)


def test_three_significant_figures_round_half_up():
    """0.3125 is 0.313 to 3 s.f.; a binary float rounds it half-even to 0.312 (final review)."""
    from figgen.core import short
    forms = short("_", "0.3125").accepted
    assert "0.313" in forms and "0.312" not in forms
