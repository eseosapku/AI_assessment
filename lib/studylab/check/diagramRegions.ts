// lib/studylab/check/diagramRegions.ts

/**
 * The parts of our own catalogue diagrams, mapped by hand, so a tap question
 * can ask for one and know where it is. Coordinates are in each diagram's own
 * pixels (public/art/montessori/diagrams/*.webp). A part may have several
 * spots -- every chloroplast is "chloroplast" -- and one part may sit inside
 * another (ovules inside the ovary): a tap goes to the smallest spot under it.
 *
 * Library figures with region data come later; tutor-drawn SVG waits until
 * drawings are sanitised and their regions can be checked.
 */
export interface Spot { x: number; y: number; r: number }
export interface Region { id: string; label: string; spots: Spot[] }
export interface DiagramRegions { width: number; height: number; regions: Region[] }

const s = (x: number, y: number, r: number): Spot => ({ x, y, r })
const R = (id: string, label: string, ...spots: Spot[]): Region => ({ id, label, spots })

export const DIAGRAM_REGIONS: Record<string, DiagramRegions> = {
  'plant-cell': { width: 460, height: 460, regions: [
    R('cell-wall', 'Cell wall', s(230, 58, 8), s(102, 250, 8)),
    R('cell-membrane', 'Cell membrane', s(123, 330, 6)),
    R('vacuole', 'Vacuole', s(240, 230, 45)),
    R('nucleus', 'Nucleus', s(160, 215, 25)),
    R('chloroplast', 'Chloroplast', s(157, 108, 20), s(306, 108, 20), s(320, 218, 16), s(167, 353, 20), s(305, 350, 20)),
  ] },
  'animal-cell': { width: 460, height: 460, regions: [
    R('cell-membrane', 'Cell membrane', s(56, 250, 7), s(230, 58, 6)),
    R('nucleus', 'Nucleus', s(232, 222, 55)),
    R('mitochondrion', 'Mitochondrion', s(237, 97, 18), s(333, 150, 20), s(106, 200, 18), s(360, 260, 18), s(133, 315, 20), s(245, 362, 20)),
    R('endoplasmic-reticulum', 'Endoplasmic reticulum', s(170, 170, 13), s(300, 292, 13)),
    R('ribosome', 'Ribosome', s(119, 138, 7), s(88, 278, 7), s(283, 128, 7)),
  ] },
  'bacterial-cell': { width: 460, height: 460, regions: [
    R('cell-wall', 'Cell wall', s(387, 110, 8), s(118, 250, 8)),
    R('circular-dna', 'Circular DNA', s(250, 195, 22)),
    R('plasmid', 'Plasmid', s(352, 124, 13), s(195, 297, 13)),
    R('ribosome', 'Ribosome', s(313, 90, 6), s(338, 168, 6), s(175, 255, 6), s(232, 277, 6)),
    R('flagellum', 'Flagellum', s(80, 395, 20)),
  ] },
  'leaf-section': { width: 460, height: 460, regions: [
    R('cuticle', 'Cuticle', s(330, 78, 6)),
    R('upper-epidermis', 'Upper epidermis', s(150, 97, 10)),
    R('palisade-layer', 'Palisade layer', s(215, 160, 24)),
    R('spongy-layer', 'Spongy layer', s(110, 310, 17), s(330, 300, 17)),
    R('vascular-bundle', 'Vascular bundle', s(220, 282, 40)),
    R('stoma', 'Stoma', s(220, 371, 11)),
    R('lower-epidermis', 'Lower epidermis', s(330, 369, 10)),
  ] },
  'flower-section': { width: 460, height: 460, regions: [
    R('petal', 'Petal', s(85, 170, 25), s(385, 160, 25)),
    R('sepal', 'Sepal', s(125, 300, 14), s(340, 295, 14)),
    R('anther', 'Anther', s(182, 137, 10), s(278, 134, 10), s(147, 172, 10), s(312, 178, 10)),
    R('stigma', 'Stigma', s(230, 105, 9)),
    R('style', 'Style', s(230, 165, 10)),
    R('ovary', 'Ovary', s(231, 268, 32)),
    R('ovule', 'Ovule', s(220, 270, 7), s(242, 270, 7)),
  ] },
  'root-section': { width: 460, height: 460, regions: [
    R('epidermis', 'Epidermis', s(230, 74, 7), s(72, 230, 7)),
    R('root-hair', 'Root hair', s(385, 75, 12)),
    R('cortex', 'Cortex', s(120, 300, 22)),
    R('xylem', 'Xylem', s(230, 228, 15)),
    R('phloem', 'Phloem', s(190, 190, 11), s(268, 190, 11), s(190, 268, 11), s(268, 268, 11)),
  ] },
  'heart': { width: 460, height: 460, regions: [
    R('right-atrium', 'Right atrium', s(150, 250, 24)),
    R('right-ventricle', 'Right ventricle', s(200, 355, 22)),
    R('left-atrium', 'Left atrium', s(285, 212, 17)),
    R('left-ventricle', 'Left ventricle', s(300, 330, 28)),
    R('aorta', 'Aorta', s(235, 85, 17)),
    R('vena-cava', 'Vena cava', s(145, 95, 13), s(138, 410, 12)),
    R('pulmonary-artery', 'Pulmonary artery', s(320, 125, 11), s(105, 126, 11)),
    R('pulmonary-vein', 'Pulmonary vein', s(100, 170, 10), s(345, 205, 10)),
    R('valve', 'Valve', s(207, 258, 9), s(250, 245, 9), s(163, 318, 9), s(302, 242, 8)),
  ] },
  'lungs': { width: 460, height: 460, regions: [
    R('trachea', 'Trachea', s(230, 110, 14)),
    R('bronchus', 'Bronchus', s(205, 195, 9), s(255, 195, 9)),
    R('bronchiole', 'Bronchiole', s(150, 160, 10), s(305, 170, 10)),
    R('alveoli', 'Alveoli', s(125, 227, 17), s(110, 278, 13), s(130, 315, 13), s(175, 305, 14)),
    R('diaphragm', 'Diaphragm', s(230, 375, 20)),
  ] },
  'digestive-system': { width: 460, height: 460, regions: [
    R('oesophagus', 'Oesophagus', s(233, 110, 8)),
    R('liver', 'Liver', s(180, 208, 22)),
    R('gall-bladder', 'Gall bladder', s(190, 243, 9)),
    R('stomach', 'Stomach', s(265, 225, 20)),
    R('pancreas', 'Pancreas', s(250, 268, 8)),
    R('small-intestine', 'Small intestine', s(225, 335, 25)),
    R('large-intestine', 'Large intestine', s(165, 320, 12), s(293, 320, 12)),
    R('rectum', 'Rectum', s(232, 420, 10)),
  ] },
  'nephron': { width: 460, height: 460, regions: [
    R('bowman-capsule', "Bowman's capsule", s(110, 108, 26)),
    R('glomerulus', 'Glomerulus', s(118, 100, 10)),
    R('proximal-tubule', 'Proximal tubule', s(200, 120, 15)),
    R('loop-of-henle', 'Loop of Henle', s(225, 400, 15)),
    R('distal-tubule', 'Distal tubule', s(290, 135, 15)),
    R('collecting-duct', 'Collecting duct', s(358, 300, 12)),
  ] },
  'eye': { width: 422, height: 460, regions: [
    R('cornea', 'Cornea', s(52, 240, 12)),
    R('pupil', 'Pupil', s(82, 236, 7)),
    R('iris', 'Iris', s(100, 150, 10), s(100, 315, 10)),
    R('lens', 'Lens', s(125, 232, 24)),
    R('vitreous-humour', 'Vitreous humour', s(250, 240, 40)),
    R('retina', 'Retina', s(250, 65, 7), s(375, 180, 7)),
    R('optic-nerve', 'Optic nerve', s(395, 305, 14)),
  ] },
  'ear': { width: 422, height: 460, regions: [
    R('pinna', 'Pinna', s(45, 250, 18)),
    R('ear-canal', 'Ear canal', s(170, 250, 18)),
    R('eardrum', 'Eardrum', s(238, 255, 8)),
    R('ossicles', 'Ossicles', s(255, 205, 12)),
    R('semicircular-canals', 'Semicircular canals', s(295, 175, 18)),
    R('cochlea', 'Cochlea', s(335, 230, 22)),
    R('eustachian-tube', 'Eustachian tube', s(320, 320, 10)),
  ] },
  'skin-section': { width: 412, height: 460, regions: [
    R('epidermis', 'Epidermis', s(100, 180, 10)),
    R('dermis', 'Dermis', s(74, 302, 8)),
    R('fat-layer', 'Fat layer', s(200, 375, 20)),
    R('hair', 'Hair', s(210, 100, 10)),
    R('hair-follicle', 'Hair follicle', s(175, 300, 14)),
    R('sweat-gland', 'Sweat gland', s(270, 300, 18)),
    R('receptor', 'Receptor', s(100, 232, 9), s(316, 253, 9)),
    R('erector-muscle', 'Erector muscle', s(235, 245, 10)),
    R('blood-vessel', 'Blood vessel', s(100, 300, 12)),
  ] },
  'neuron': { width: 412, height: 460, regions: [
    R('cell-body', 'Cell body', s(65, 235, 26)),
    R('nucleus', 'Nucleus', s(68, 230, 10)),
    R('dendrite', 'Dendrite', s(40, 165, 12), s(105, 180, 10), s(30, 290, 10)),
    R('myelin-sheath', 'Myelin sheath', s(180, 230, 12), s(260, 230, 12)),
    R('node-of-ranvier', 'Node of Ranvier', s(200, 230, 5)),
    R('axon-terminal', 'Axon terminal', s(365, 180, 10), s(365, 275, 10)),
  ] },
  'tooth-section': { width: 460, height: 460, regions: [
    R('enamel', 'Enamel', s(230, 60, 12)),
    R('dentine', 'Dentine', s(165, 140, 10)),
    R('pulp', 'Pulp', s(230, 150, 15)),
    R('nerve', 'Nerve and blood vessels', s(190, 330, 8)),
    R('root', 'Root', s(295, 320, 10)),
    R('gum', 'Gum', s(115, 185, 12), s(340, 185, 12)),
    R('jaw-bone', 'Jaw bone', s(130, 300, 15)),
  ] },
  'skeleton': { width: 460, height: 460, regions: [
    R('skull', 'Skull', s(230, 45, 22)),
    R('clavicle', 'Clavicle', s(205, 104, 7), s(258, 104, 7)),
    R('ribcage', 'Ribcage', s(205, 140, 14), s(258, 140, 14)),
    R('spine', 'Spine', s(232, 190, 10)),
    R('pelvis', 'Pelvis', s(232, 230, 20)),
    R('humerus', 'Humerus', s(175, 150, 9), s(290, 150, 9)),
    R('radius-and-ulna', 'Radius and ulna', s(155, 215, 9), s(305, 215, 9)),
    R('hand', 'Hand', s(130, 272, 12), s(330, 272, 12)),
    R('femur', 'Femur', s(205, 292, 10), s(258, 292, 10)),
    R('tibia-and-fibula', 'Tibia and fibula', s(207, 390, 10), s(255, 390, 10)),
    R('foot', 'Foot', s(205, 436, 10), s(255, 436, 10)),
  ] },
  'volcano': { width: 460, height: 250, regions: [
    R('ash-cloud', 'Ash cloud', s(230, 40, 25)),
    R('crater', 'Crater', s(225, 82, 9)),
    R('main-vent', 'Main vent', s(228, 150, 9)),
    R('side-vent', 'Side vent', s(290, 130, 8)),
    R('layered-cone', 'Layers of ash and lava', s(140, 165, 15), s(330, 165, 15)),
    R('magma-chamber', 'Magma chamber', s(225, 225, 20)),
  ] },
  'river-profile': { width: 460, height: 250, regions: [
    R('source', 'Source', s(60, 45, 12)),
    R('waterfall', 'Waterfall', s(100, 125, 10)),
    R('meander', 'Meander', s(195, 155, 12)),
    R('oxbow-lake', 'Oxbow lake', s(255, 136, 10)),
    R('delta', 'Delta', s(370, 180, 18)),
    R('sea', 'Sea', s(420, 185, 15)),
  ] },
  'soil-profile': { width: 460, height: 250, regions: [
    R('leaf-litter', 'Leaf litter', s(180, 22, 8)),
    R('topsoil', 'Topsoil', s(150, 70, 14)),
    R('subsoil', 'Subsoil', s(230, 130, 14)),
    R('parent-rock', 'Parent rock', s(230, 185, 12)),
    R('bedrock', 'Bedrock', s(230, 228, 8)),
  ] },
  'earth-layers': { width: 460, height: 250, regions: [
    R('crust', 'Crust', s(230, 22, 7)),
    R('mantle', 'Mantle', s(110, 120, 22)),
    R('outer-core', 'Outer core', s(150, 190, 20)),
    R('inner-core', 'Inner core', s(230, 212, 22)),
  ] },
  'circuit-series': { width: 460, height: 460, regions: [
    R('cell', 'Cell', s(75, 228, 18)),
    R('lamp', 'Lamp', s(240, 100, 40)),
    R('switch', 'Switch', s(180, 330, 18)),
    R('resistor', 'Resistor', s(413, 228, 18), s(320, 352, 20)),
  ] },
  'lever': { width: 460, height: 460, regions: [
    R('load', 'Load', s(85, 215, 25)),
    R('fulcrum', 'Fulcrum', s(200, 280, 18)),
    R('effort', 'Effort', s(383, 120, 15)),
    R('beam', 'Beam', s(290, 218, 8)),
    R('spring', 'Spring', s(395, 250, 18)),
  ] },
  'microscope': { width: 460, height: 460, regions: [
    R('eyepiece', 'Eyepiece', s(275, 30, 14)),
    R('body-tube', 'Body tube', s(255, 90, 10)),
    R('objective-lens', 'Objective lens', s(165, 172, 10), s(193, 192, 10), s(222, 208, 10)),
    R('stage', 'Stage', s(210, 262, 14)),
    R('focus-knob', 'Focus knob', s(290, 105, 12), s(298, 158, 12), s(303, 315, 10)),
    R('mirror', 'Mirror', s(210, 345, 14)),
    R('arm', 'Arm', s(350, 250, 12)),
    R('base', 'Base', s(250, 410, 16)),
  ] },
  'bunsen-burner': { width: 460, height: 460, regions: [
    R('flame', 'Flame', s(200, 45, 18)),
    R('inner-cone', 'Inner cone', s(228, 85, 12)),
    R('barrel', 'Barrel', s(230, 210, 14)),
    R('air-hole', 'Air hole', s(227, 297, 9)),
    R('collar', 'Collar', s(230, 330, 10)),
    R('gas-inlet', 'Gas inlet', s(275, 365, 12)),
    R('gas-tube', 'Gas tube', s(380, 395, 15)),
    R('base', 'Base', s(170, 412, 12)),
  ] },
}

/** The map for a figure named as the catalogue names it ("asset:plant-cell" or "plant-cell"); null for anything else. */
export function regionsFor(figure: string): DiagramRegions | null {
  if (typeof figure !== 'string') return null
  const key = figure.trim().replace(/^asset:/, '')
  return Object.prototype.hasOwnProperty.call(DIAGRAM_REGIONS, key) ? DIAGRAM_REGIONS[key] : null
}

/** The part under a point: the smallest spot that holds it, so a part inside another wins; null in empty space. */
export function regionAt(map: DiagramRegions, x: number, y: number): Region | null {
  let best: { region: Region; r: number } | null = null
  for (const region of map.regions) {
    for (const spot of region.spots) {
      if (Math.hypot(x - spot.x, y - spot.y) <= spot.r && (!best || spot.r < best.r)) best = { region, r: spot.r }
    }
  }
  return best?.region ?? null
}
