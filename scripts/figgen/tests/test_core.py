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
