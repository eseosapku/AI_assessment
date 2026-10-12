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
