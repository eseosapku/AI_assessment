// scripts/figure-library/figureKinds.ts
/**
 * Every kind of educational figure the library makes or finds (spec 5.1).
 * Drawn kinds are generated from data with computed answers; real kinds come
 * from openly licensed collections. Drawn families are designed per kind in P3.
 */
export interface FigureKind {
  id: string
  drawn: boolean
  label: string
}

export const FIGURE_KINDS: readonly FigureKind[] = [
  { id: 'graph.line', drawn: true, label: 'Line graph: motion, rates, functions, change over time' },
  { id: 'graph.bar', drawn: true, label: 'Bar chart, column chart or histogram' },
  { id: 'graph.pie', drawn: true, label: 'Pie chart' },
  { id: 'graph.scatter', drawn: true, label: 'Scatter graph, with or without a line of best fit' },
  { id: 'graph.stats', drawn: true, label: 'Box plot, cumulative frequency curve or stem-and-leaf diagram' },
  { id: 'table.data', drawn: true, label: 'Table of data to read, complete or calculate from' },
  { id: 'maths.number', drawn: true, label: 'Number line, place-value chart, fraction or array model' },
  { id: 'maths.geometry', drawn: true, label: 'Shapes, angles, polygons, circles, constructions, transformations' },
  { id: 'maths.coordinate', drawn: true, label: 'Coordinate grid with points, lines, vectors or regions' },
  { id: 'maths.measure', drawn: true, label: 'Clock, ruler, scale, protractor or money to read' },
  { id: 'maths.solid', drawn: true, label: '3D solid, net, plan or elevation' },
  { id: 'maths.probability', drawn: true, label: 'Tree diagram, Venn diagram, two-way table or sample space' },
  { id: 'physics.circuit', drawn: true, label: 'Electrical circuit diagram' },
  { id: 'physics.ray', drawn: true, label: 'Ray diagram: mirror, lens, refraction' },
  { id: 'physics.force', drawn: true, label: 'Force or free-body diagram, moments, levers, pulleys' },
  { id: 'physics.wave', drawn: true, label: 'Waveform or wavefront diagram' },
  { id: 'physics.field', drawn: true, label: 'Magnetic or electric field pattern' },
  { id: 'instrument.reading', drawn: true, label: 'Measuring instrument to read: meter, thermometer, burette, cylinder, balance' },
  { id: 'chem.structure', drawn: true, label: 'Structural or displayed formula of a molecule' },
  { id: 'chem.particle', drawn: true, label: 'Particle diagram or dot-and-cross bonding diagram' },
  { id: 'chem.energy', drawn: true, label: 'Energy profile or enthalpy diagram' },
  { id: 'chem.chromatogram', drawn: true, label: 'Paper or thin-layer chromatogram' },
  { id: 'bio.genetics', drawn: true, label: 'Punnett square or family pedigree' },
  { id: 'bio.ecology', drawn: true, label: 'Food chain, food web or ecological pyramid' },
  { id: 'bio.key', drawn: true, label: 'Dichotomous key' },
  { id: 'diagram.template', drawn: true, label: 'Labelled diagram from a template, with varied parts to identify (cell, heart, flower, eye)' },
  { id: 'process.flow', drawn: true, label: 'Flow or cycle diagram of a process (water cycle, digestion, manufacturing)' },
  { id: 'geo.map', drawn: true, label: 'Map: location, choropleth, route, or contour (topographic) map' },
  { id: 'geo.climate', drawn: true, label: 'Climate graph or population pyramid' },
  { id: 'geo.section', drawn: true, label: 'Cross-section or profile: land, river, soil, rock layers' },
  { id: 'timeline', drawn: true, label: 'Timeline of events or periods' },
  { id: 'cs.logic', drawn: true, label: 'Logic gate circuit or truth table' },
  { id: 'cs.structure', drawn: true, label: 'Tree, stack, queue, network topology, ER or state diagram' },
  { id: 'cs.code', drawn: true, label: 'Short code or pseudocode with a trace table' },
  { id: 'econ.curve', drawn: true, label: 'Economics diagram: supply and demand, costs, PPF, AD/AS' },
  { id: 'business.document', drawn: true, label: 'Business or accounting document: income statement, balance sheet, invoice, organisation chart' },
  { id: 'text.notice', drawn: true, label: 'Notice, timetable, menu, sign, form or advert to read' },
  { id: 'music.notation', drawn: true, label: 'Music notation: rhythms, notes, scales, intervals' },
  { id: 'photo.specimen', drawn: false, label: 'Photo of a real organism, rock, mineral, soil or material' },
  { id: 'photo.micrograph', drawn: false, label: 'Microscope image of cells, tissues, microbes or crystals' },
  { id: 'photo.landscape', drawn: false, label: 'Photo or satellite image of a landform, environment, settlement or weather system' },
  { id: 'photo.apparatus', drawn: false, label: 'Photo of laboratory apparatus, an experiment in progress, or equipment' },
  { id: 'photo.object', drawn: false, label: 'Photo of a manufactured object, tool, machine, instrument or technology' },
  { id: 'photo.everyday', drawn: false, label: 'Everyday scene or object, for language and primary topics' },
  { id: 'diagram.reference', drawn: false, label: 'Published labelled scientific or technical diagram (for example a Wikimedia anatomy diagram)' },
  { id: 'source.historical', drawn: false, label: 'Historical photo, document, poster, cartoon or map' },
  { id: 'artwork', drawn: false, label: 'Painting, sculpture, craft, textile or building as art' },
]

export const KIND_BY_ID: ReadonlyMap<string, FigureKind> = new Map(FIGURE_KINDS.map((k) => [k.id, k]))
