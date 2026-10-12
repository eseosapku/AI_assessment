"""Every drawn family, by id."""
from . import (angles, bar_chart, box_plot, break_even, climate_graph, coordinates, cross_section, food_web,
               line_graph, notice, number_line, pie_chart, population_pyramid, punnett, scale_reading,
               scatter_graph, supply_demand, timeline, timetable, tree_diagram)

FAMILIES = {m.ID: m for m in (
    bar_chart, pie_chart, line_graph, scatter_graph, box_plot, number_line, angles, coordinates, tree_diagram,
    punnett, food_web, scale_reading, climate_graph, population_pyramid, cross_section, supply_demand,
    break_even, notice, timetable, timeline,
)}
