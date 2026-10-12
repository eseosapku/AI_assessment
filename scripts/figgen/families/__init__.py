"""Every drawn family, by id."""
from . import (angles, area_shapes, bar_chart, bearings, box_plot, break_even, circle_theorem, climate_graph, clock, conversion_graph, coordinates, cross_section, cuboid, cumulative_frequency, food_web, frequency_table, histogram,
               fraction_model, inequality_region, line_graph, linear_graph, nets, notice, number_line, parallel_lines, pattern_sequence, pictogram, pie_chart, place_value, polygon_angles, quadratic_graph,
               population_pyramid, punnett, right_triangle, ruler, sample_space, scale_reading, scatter_graph, stem_leaf, supply_demand, timeline, timetable, transformation, travel_graph, two_way_table,
               tree_diagram, vectors_grid, venn)
# P3c: the second maths batch
from . import area_under_curve, limit_graph, stationary_points, tangent_gradient

FAMILIES = {m.ID: m for m in (
    bar_chart, pie_chart, line_graph, scatter_graph, box_plot, number_line, angles, coordinates, tree_diagram,
    punnett, food_web, scale_reading, climate_graph, population_pyramid, cross_section, supply_demand,
    break_even, notice, timetable, timeline,
    # P3a: the maths wave
    place_value, fraction_model, pattern_sequence, pictogram, clock, ruler,
    parallel_lines, polygon_angles, area_shapes, bearings,
    right_triangle, circle_theorem, cuboid, nets,
    linear_graph, quadratic_graph, conversion_graph, travel_graph, transformation, vectors_grid, inequality_region,
    venn, two_way_table, frequency_table, stem_leaf, cumulative_frequency, histogram, sample_space,
    # P3c: the second maths batch
    tangent_gradient, stationary_points, area_under_curve, limit_graph,
)}
