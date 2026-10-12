"""Which pilot topic each drawn family's figures are made for (P1a).

Each topic's mapped figure kinds include the family's kind, and its level is
one the family draws for. Six subjects: maths, biology, geography, economics
and business, English, history.
"""
from __future__ import annotations

PILOT = {
    "bar_chart": ["db:410"], "pie_chart": ["db:410"], "scatter_graph": ["db:410"],  # Maths LS: Statistical investigations
    "line_graph": ["db:141"], "box_plot": ["db:141"],  # Maths UP: Averages and measures of spread
    "tree_diagram": ["db:153"],  # Maths UP: Probability using tree diagrams
    "angles": ["db:4295"],  # Maths LS: Calculating angles
    "number_line": ["db:489"], "coordinates": ["db:489"],  # Maths P: Numbers and sequences
    "punnett": ["db:111"],  # Biology UP: Genetics
    "food_web": ["db:3856"],  # NERDC SS2 Biology: Ecology
    "scale_reading": ["db:1101"],  # Geography LS: Weather and climate
    "climate_graph": ["db:1115"],  # Geography LS: Climate and climate change in Rwanda
    "population_pyramid": ["db:1105"],  # Geography LS: Population and settlement
    "cross_section": ["db:1112"],  # Geography LS: Relief in Rwanda
    "supply_demand": ["waec:Economics:1"],  # WAEC Economics: Demand and supply
    "break_even": ["jamb:Commerce:2"],  # JAMB Commerce: Finance
    "notice": ["checkpoint:lower-secondary:0876:0"],  # Checkpoint English: Reading and Usage
    "timetable": ["checkpoint:lower-secondary:0876:0"],
}
# A timeline goes to the history topic its events belong to.
TIMELINE = {"The Cold War": ["db:162"], "Independence in Africa": ["db:1057"]}


def topics_for(family: str, params: dict) -> list[str]:
    if family == "timeline":
        return TIMELINE[params["title"]]
    return PILOT[family]
