"""Every drawn family, by id."""
from . import (angles, bar_chart, box_plot, break_even, climate_graph, clock, coordinates, cross_section, food_web,
               fraction_model, line_graph, notice, number_line, pattern_sequence, pictogram, pie_chart, place_value,
               population_pyramid, punnett, ruler, scale_reading, scatter_graph, supply_demand, timeline, timetable,
               tree_diagram)

FAMILIES = {m.ID: m for m in (
    bar_chart, pie_chart, line_graph, scatter_graph, box_plot, number_line, angles, coordinates, tree_diagram,
    punnett, food_web, scale_reading, climate_graph, population_pyramid, cross_section, supply_demand,
    break_even, notice, timetable, timeline,
    # P3a: the maths wave
    place_value, fraction_model, pattern_sequence, pictogram, clock, ruler,
)}
