"""Shared pieces of the accounting figures (P3p): amounts as an account prints them, a page laid out in inches,
and the Rwandan businesses, customers and suppliers the documents belong to. Not a family itself."""
from __future__ import annotations

import calendar

from ..core import INK, new_figure

MONTHS = list(calendar.month_name)[1:]
SHORT_MONTHS = list(calendar.month_abbr)[1:]

# Where the businesses are, and what they do: a trade as a question says it, and as a business name prints it.
TOWNS = ["Kigali", "Huye", "Musanze", "Rubavu", "Rwamagana", "Nyagatare", "Muhanga", "Rusizi", "Nyanza", "Karongi"]
TRADES = [("hardware shop", "Hardware"), ("bakery", "Bakery"), ("pharmacy", "Pharmacy"), ("stationery shop", "Stationers"),
          ("tailoring workshop", "Tailors"), ("grocery", "Grocers"), ("furniture workshop", "Furniture"),
          ("phone shop", "Mobile Shop"), ("hair salon", "Salon"), ("restaurant", "Restaurant"), ("shoe shop", "Shoes"),
          ("electronics shop", "Electronics")]
# Kigali neighbourhoods and other places a shop is named after.
PLACES = ["Remera", "Kimironko", "Nyamirambo", "Kicukiro", "Gisozi", "Kacyiru", "Nyabugogo", "Gikondo", "Kanombe", "Muhima"]
# Family names for credit customers ("J. Niyonzima"), none of them one of the first names a question uses.
SURNAMES = ["Niyonzima", "Uwimana", "Mukamana", "Nkurunziza", "Bizimana", "Hakizimana", "Uwera", "Munyaneza", "Nsengiyumva",
            "Mukeshimana", "Twagirayezu", "Ndayisaba"]
INITIALS = "ABCDEGJKMNPT"
# Wholesalers a shop buys its goods from on credit.
SUPPLIERS = ["Nyabugogo Wholesalers", "Kimironko Wholesalers", "Gikondo Traders", "Remera Supplies", "Muhima Distributors",
             "Kicukiro Wholesale", "Huye Traders", "Rubavu Traders"]
# Past years only: a statement for a year not yet ended reads as a slip.
YEARS = [2023, 2024, 2025]


def frw(n: int) -> str:
    """An amount as an account prints it: a space for thousands, "12 500"."""
    return f"{n:,}".replace(",", " ")


def article(word: str) -> str:
    return "an" if word[:1].lower() in "aeiou" else "a"


def page(width: float, height: float):
    """A figure whose axes fill it, measured in inches: (0, 0) bottom left, (width, height) top right."""
    fig, ax = new_figure(width, height)
    fig.subplots_adjust(left=0, right=1, bottom=0, top=1)
    ax.set_xlim(0, width)
    ax.set_ylim(0, height)
    ax.axis("off")
    return fig, ax


def rule(ax, x0: float, x1: float, y: float, double: bool = False, width: float = 0.9, colour: str = INK) -> None:
    """A ruled line under or over an amount; a double one under a final total."""
    ax.plot([x0, x1], [y, y], color=colour, linewidth=width, solid_capstyle="butt")
    if double:
        ax.plot([x0, x1], [y - 0.05, y - 0.05], color=colour, linewidth=width, solid_capstyle="butt")


def customer(rng) -> str:
    return f"{rng.choice(INITIALS)}. {rng.choice(SURNAMES)}"
