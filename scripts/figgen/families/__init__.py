"""Every drawn family, by id."""
from . import (angles, area_shapes, bar_chart, bearings, box_plot, break_even, circle_theorem, climate_graph, clock, conversion_graph, coordinates, cross_section, cuboid, cumulative_frequency, food_web, frequency_table, histogram,
               fraction_model, inequality_region, line_graph, linear_graph, nets, notice, number_line, parallel_lines, pattern_sequence, pictogram, pie_chart, place_value, polygon_angles, quadratic_graph,
               population_pyramid, punnett, right_triangle, ruler, sample_space, scale_reading, scatter_graph, stem_leaf, supply_demand, timeline, timetable, transformation, travel_graph, two_way_table,
               tree_diagram, vectors_grid, venn)
# P3c: the second maths batch
from . import (algebra_area, area_under_curve, argand, bar_model, exp_graph, limit_graph, matrix_transform, money, pascal, pdf_graph,
               percent_grid, points_3d, price_tag, prob_distribution, rational_graph, scale_drawing, stationary_points, tangent_gradient,
               trig_graph, velocity_time)
# P3e: the physics wave
from . import capacitor_discharge, circuit, circular_motion, coulomb_force, decay_graph, electric_field, density_displacement, em_spectrum, energy_levels, energy_sankey, force_diagram, gas_law, gravity_orbit, heating_curve, iv_graph, lens_diagram, magnet_field, meter_dial, moments, motion_graph, motor_rule, nucleus, photoelectric, pressure, ray_optics, spring_graph, transformer, wave_graph

# P3g: the chemistry wave
from . import covalent_bonding, electron_shells, ionic_bonding, particle_diagram, periodic_table
from . import electrolysis, energy_profile, organic_structure
from . import mass_spectrum, ph_curve, rate_graph, solubility_curve
from . import chromatogram, titration
# P3i: the biology wave
from . import enzyme_graph, glucose_graph, osmosis_graph, photosynthesis_rate, population_curve, spirometer_trace
from . import dna_strand, pedigree
from . import dichotomous_key, quadrat, variation_chart
from . import antibiotic_plate, food_test_table, magnification, sa_volume
# P3k: the computing wave
from . import logic_gates, truth_table
from . import binary_search, flowchart, sort_trace, trace_table
from . import binary_place, bitmap_image, sound_samples
from . import database_query, network_topology, spreadsheet_formula
from . import binary_tree, caesar_cipher, stack_queue
# P3m: the geography wave
from . import contour_map, grid_reference, map_distance
from . import lat_long, weather_station, wind_rose
from . import dtm, employment_structure, hydrograph, ternary_graph
# P3p: the commerce wave (one line each, added when the modules import cleanly)
# P3p economics imports
from . import cost_revenue, elasticity, national_income, ppc, price_index
# P3p accounting imports
from . import bank_reconciliation, depreciation, income_statement, ratio_analysis, t_account, trial_balance
# P3p business imports
# P3s: the primary science wave (one line each, added when the modules import cleanly)
# P3s physical imports
from . import force_arrows_p, magnets_p, seesaw_p, shadows_p, simple_circuit_p
# P3s materials imports
from . import materials_test_p, plant_growth_p, soil_drainage_p, state_changes_p, weather_chart_p
# P3s living imports
from . import body_data_p, carroll_sort_p, food_chain_p, grid_robot_p, teeth_p
# P3t: agriculture
# P3t agriculture imports
from . import crop_calendar, farm_record, fertiliser_calc, pearson_square, soil_texture
# P3w: biology diagrams
# P3w structures imports
from . import arm_muscles, flower_diagram, heart_diagram, nephron_diagram, reflex_arc
# P3w processes imports
from . import carbon_cycle, cell_division, life_cycle, nitrogen_cycle, tropism_experiment
# P3w data imports
from . import antibody_response, blood_vessels, gas_exchange, menstrual_cycle, potometer
from . import cash_flow_forecast, critical_path, inventory_chart, pricing
# P3v: computing
# P3v cs imports
from . import assembly_trace, floating_point, karnaugh_map, register_transfer, sensor_control
# P3v data imports
from . import er_normalisation, hash_table, ip_address, linked_list_array, parity_check
# P3v ict imports
from . import expert_system, file_transfer, gantt_chart, mail_merge, web_page
# P3x: social studies and history
# P3x primary imports
from . import admin_ladder_p, budget_p, compass_map_p, family_tree_p, map_key_p
# P3x history imports
from . import arms_of_government, census_chart, election_chart

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
    exp_graph, trig_graph, rational_graph,
    argand, matrix_transform, points_3d,
    prob_distribution, pdf_graph, velocity_time,
    money, price_tag,
    bar_model, scale_drawing, percent_grid, algebra_area, pascal,
    # P3e: the physics wave
    motion_graph, force_diagram, moments, spring_graph,
    pressure, density_displacement, energy_sankey,
    circuit, meter_dial, iv_graph,
    motor_rule, transformer,
    heating_curve, wave_graph, ray_optics, lens_diagram, em_spectrum,
    decay_graph, nucleus,
    # P3g: the physics gaps
    electric_field, coulomb_force, magnet_field,
    circular_motion, gravity_orbit,
    gas_law, capacitor_discharge, photoelectric, energy_levels,
    # P3g: the chemistry wave
    particle_diagram, electron_shells, ionic_bonding, covalent_bonding, periodic_table, organic_structure, energy_profile, electrolysis, rate_graph, solubility_curve, ph_curve, mass_spectrum, titration, chromatogram,
    enzyme_graph, photosynthesis_rate, population_curve, osmosis_graph, glucose_graph, spirometer_trace, pedigree, dna_strand, quadrat, dichotomous_key, variation_chart,
    magnification, antibiotic_plate, sa_volume, food_test_table,
    logic_gates, truth_table,
    sort_trace, binary_search, trace_table, flowchart,
    binary_place, bitmap_image, sound_samples,
    spreadsheet_formula, database_query, network_topology,
    binary_tree, stack_queue, caesar_cipher,
    # P3m: the geography wave
    grid_reference, map_distance, contour_map,
    weather_station, wind_rose, lat_long,
    hydrograph, ternary_graph, dtm, employment_structure,
    # P3p: the commerce wave
    # P3p economics families
    ppc, elasticity, cost_revenue, price_index, national_income,
    # P3p accounting families
    t_account, trial_balance, depreciation, bank_reconciliation, income_statement, ratio_analysis,
    # P3p business families
    cash_flow_forecast, critical_path, inventory_chart, pricing,
    # P3s: the primary science wave
    # P3s physical families
    simple_circuit_p, magnets_p, shadows_p, seesaw_p, force_arrows_p,
    # P3s materials families
    materials_test_p, soil_drainage_p, state_changes_p, weather_chart_p, plant_growth_p,
    # P3s living families
    carroll_sort_p, food_chain_p, body_data_p, teeth_p, grid_robot_p,
    # P3t agriculture families
    pearson_square, fertiliser_calc, farm_record, soil_texture, crop_calendar,
    # P3w: biology diagrams
    # P3w structures families
    heart_diagram, flower_diagram, nephron_diagram, reflex_arc, arm_muscles,
    # P3w processes families
    carbon_cycle, nitrogen_cycle, cell_division, tropism_experiment, life_cycle,
    # P3w data families
    potometer, menstrual_cycle, antibody_response, blood_vessels, gas_exchange,
    # P3v: computing
    # P3v cs families
    assembly_trace, register_transfer, karnaugh_map, sensor_control, floating_point,
    # P3v data families
    parity_check, ip_address, linked_list_array, hash_table, er_normalisation,
    # P3v ict families
    mail_merge, gantt_chart, file_transfer, expert_system, web_page,
    # P3x: social studies and history
    # P3x primary families
    compass_map_p, map_key_p, family_tree_p, admin_ladder_p, budget_p,
    # P3x history families
    arms_of_government, census_chart, election_chart,
)}
