// lib/figure-draw-more.test.ts
import { describe, it, expect } from 'vitest'
import { drawFromReply } from './figure-request'

/** Every new kind, drawn from the JSON a model would actually send. */
const CASES: [string, string][] = [
  ['piechart', '{"kind":"piechart","title":"How learners travel","slices":[{"label":"walk","value":12},{"label":"bus","value":7},{"label":"cycle","value":5}]}'],
  ['datatable', '{"kind":"datatable","title":"Plant heights","columns":["day","height (cm)"],"rows":[["1","2.1"],["3","4.6"],["5","7.0"]]}'],
  ['circuit', '{"kind":"circuit","arrangement":"series","supply":"6 V","components":[{"type":"lamp","label":"L1"},{"type":"switch"},{"type":"ammeter","label":"A"}]}'],
  ['circuit', '{"kind":"circuit","arrangement":"parallel","supply":"12 V","components":[{"type":"lamp","label":"L1"},{"type":"lamp","label":"L2"}]}'],
  ['forces', '{"kind":"forces","object":"box","surface":"the floor","arrows":[{"direction":"down","label":"weight 40 N"},{"direction":"up","label":"reaction 40 N"},{"direction":"right","label":"push 15 N"},{"direction":"left","label":"friction 9 N"}]}'],
  ['foodchain', '{"kind":"foodchain","organisms":["grass","grasshopper","frog","snake"]}'],
  ['grid', '{"kind":"grid","max":6,"quadrants":4,"points":[{"x":2,"y":3,"label":"A"},{"x":-4,"y":1,"label":"B"}]}'],
  ['grid', '{"kind":"grid","max":8,"quadrants":1,"joined":true,"points":[{"x":1,"y":1},{"x":5,"y":1},{"x":5,"y":4}]}'],
  ['angles', '{"kind":"angles","arrangement":"straight-line","marks":[{"at":55,"label":"55"},{"at":125,"label":"x"}]}'],
  ['angles', '{"kind":"angles","arrangement":"around-point","marks":[{"at":90,"label":"90"},{"at":130,"label":"130"},{"at":140,"label":"y"}]}'],
  ['angles', '{"kind":"angles","arrangement":"triangle","marks":[{"at":40,"label":"40"},{"at":60,"label":"60"},{"at":80,"label":"p"}]}'],
  ['apparatus', '{"kind":"apparatus","vessel":"tray","contents":"sand","ruler":true,"dropped":"marble","labels":["marble","tray","crater"]}'],
  ['apparatus', '{"kind":"apparatus","vessel":"cylinder","contents":"water","labels":["measuring cylinder","water level"]}'],
  ['apparatus', '{"kind":"apparatus","vessel":"beaker","contents":"salt solution","labels":["beaker"]}'],
]

describe('every new shape draws', () => {
  for (const [kind, json] of CASES) {
    it(`draws a ${kind}`, () => {
      const drawn = drawFromReply(json)
      expect(drawn, json.slice(0, 60)).not.toBeNull()
      expect(drawn!.spec.kind).toBe(kind)
      expect(drawn!.svg.startsWith('<svg')).toBe(true)
      expect(drawn!.svg.endsWith('</svg>')).toBe(true)
      // Nothing may escape the box it was drawn in, or it is clipped on the
      // page and the label the question names is the part that goes missing.
      const box = drawn!.svg.match(/viewBox="0 0 (\d+) (\d+)"/)
      expect(box, 'viewBox').toBeTruthy()
      const [w, h] = [Number(box![1]), Number(box![2])]
      // The ANCHOR being inside the box is not enough: a right-anchored
      // "measuring cylinder" at x=38 runs eighty pixels off the left edge,
      // and the label the question names is the part that goes missing.
      const texts = [...drawn!.svg.matchAll(
        /<text x="(-?[\d.]+)" y="(-?[\d.]+)" text-anchor="(\w+)"[^>]*font-size="([\d.]+)"[^>]*>([^<]*)</g)]
      expect(texts.length, `no text found in ${kind}`).toBeGreaterThan(0)
      for (const m of texts) {
        const [x, y, anchor, size, label] = [Number(m[1]), Number(m[2]), m[3], Number(m[4]), m[5]]
        // Helvetica at 12px averages about 0.52em per character across mixed
        // case; generous enough not to cry wolf, tight enough to catch a
        // label that is plainly outside.
        const width = label.length * size * 0.52
        const left = anchor === 'end' ? x - width : anchor === 'middle' ? x - width / 2 : x
        const right = left + width
        expect(left, `"${label}" runs off the left of the ${kind}`).toBeGreaterThanOrEqual(-2)
        expect(right, `"${label}" runs off the right of the ${kind}`).toBeLessThanOrEqual(w + 2)
        expect(y, `"${label}" sits outside the ${kind} vertically`).toBeGreaterThanOrEqual(0)
        expect(y, `"${label}" sits outside the ${kind} vertically`).toBeLessThanOrEqual(h)
      }
      // A figure whose description names nothing cannot have a question
      // written against it.
      expect(drawn!.description.length).toBeGreaterThan(10)
      expect(drawn!.labels.length).toBeGreaterThan(0)
    })
  }

  it('refuses a spec whose geometry does not hold', () => {
    // Angles on a line that do not make 180 have no answer.
    expect(drawFromReply('{"kind":"angles","arrangement":"straight-line","marks":[{"at":55,"label":"55"},{"at":60,"label":"x"}]}')).toBeNull()
    // A point off the grid is the graph fault again.
    expect(drawFromReply('{"kind":"grid","max":6,"quadrants":1,"points":[{"x":9,"y":1,"label":"A"}]}')).toBeNull()
    // A row longer than its own headings describes a different table.
    expect(drawFromReply('{"kind":"datatable","columns":["a","b"],"rows":[["1","2","3"],["4","5"]]}')).toBeNull()
    // A parallel circuit needs two branches to be parallel.
    expect(drawFromReply('{"kind":"circuit","arrangement":"parallel","components":[{"type":"lamp"}]}')).toBeNull()
    // Two arrows the same way sit on top of each other.
    expect(drawFromReply('{"kind":"forces","object":"box","arrows":[{"direction":"up","label":"a"},{"direction":"up","label":"b"}]}')).toBeNull()
  })
})

describe('labels a real model would actually send', () => {
  /** Reuses the extent check above: long labels are where figures clip. */
  function assertInside(json: string, what: string) {
    const drawn = drawFromReply(json)
    expect(drawn, what).not.toBeNull()
    const box = drawn!.svg.match(/viewBox="0 0 (\d+) (\d+)"/)!
    const [w, h] = [Number(box[1]), Number(box[2])]
    for (const m of drawn!.svg.matchAll(
      /<text x="(-?[\d.]+)" y="(-?[\d.]+)" text-anchor="(\w+)"[^>]*font-size="([\d.]+)"[^>]*>([^<]*)</g)) {
      const [x, y, anchor, size, label] = [Number(m[1]), Number(m[2]), m[3], Number(m[4]), m[5]]
      const width = label.length * size * 0.52
      const left = anchor === 'end' ? x - width : anchor === 'middle' ? x - width / 2 : x
      expect(left, `"${label}" off the left of ${what}`).toBeGreaterThanOrEqual(-2)
      expect(left + width, `"${label}" off the right of ${what}`).toBeLessThanOrEqual(w + 2)
      expect(y, `"${label}" outside ${what}`).toBeLessThanOrEqual(h)
    }
  }

  it('fits long force labels', () => {
    assertInside('{"kind":"forces","object":"wooden block","surface":"a rough wooden bench","arrows":[{"direction":"left","label":"air resistance 12 N"},{"direction":"right","label":"driving force 40 N"},{"direction":"up","label":"upward reaction force 55 N"},{"direction":"down","label":"weight of the block 55 N"}]}', 'forces')
  })

  it('fits long circuit labels', () => {
    assertInside('{"kind":"circuit","arrangement":"series","supply":"a 6 V battery","components":[{"type":"lamp","label":"lamp one"},{"type":"ammeter","label":"ammeter A1"},{"type":"switch","label":"open switch"}]}', 'circuit')
    assertInside('{"kind":"circuit","arrangement":"parallel","supply":"12 V supply","components":[{"type":"lamp","label":"first lamp"},{"type":"lamp","label":"second lamp"},{"type":"resistor","label":"resistor R"}]}', 'circuit parallel')
  })

  it('fits long organism names', () => {
    assertInside('{"kind":"foodchain","organisms":["phytoplankton","small shrimp","mackerel","grey seal","killer whale"]}', 'foodchain')
  })

  it('fits long table headings and cells', () => {
    assertInside('{"kind":"datatable","title":"How the temperature changed over the morning","columns":["time of day","temperature (degrees C)","cloud cover"],"rows":[["08:00","14.2","overcast"],["10:00","17.9","broken cloud"],["12:00","21.4","clear"]]}', 'datatable')
  })

  it('fits long pie slice labels', () => {
    assertInside('{"kind":"piechart","title":"Where the school rubbish goes","slices":[{"label":"paper and cardboard","value":34},{"label":"food waste","value":22},{"label":"plastic bottles","value":18},{"label":"glass","value":9}]}', 'piechart')
  })

  it('fits long apparatus labels', () => {
    assertInside('{"kind":"apparatus","vessel":"tray","contents":"dry sand","ruler":true,"dropped":"steel marble","labels":["the steel marble","tray of dry sand","crater formed on impact","metre ruler"]}', 'apparatus')
  })

  it('fits long grid point labels', () => {
    assertInside('{"kind":"grid","max":12,"quadrants":4,"points":[{"x":-11,"y":11,"label":"P"},{"x":12,"y":-12,"label":"Q"}]}', 'grid')
  })
})

describe('what a question may name', () => {
  it('lets a question name the letter an apparatus figure actually prints', () => {
    const drawn = drawFromReply('{"kind":"apparatus","vessel":"tray","contents":"sand","dropped":"marble","labels":["marble","tray of sand","crater"]}')!
    expect(drawn.labels).toContain('A')
    expect(drawn.labels).toContain('C')
    expect(drawn.labels).toContain('crater')
    // The drawing prints exactly these letters, so the check and the picture
    // agree.
    expect(drawn.svg).toContain('>A<')
    expect(drawn.svg).toContain('>C<')
    expect(drawn.labels).not.toContain('D')
  })
})

describe('a table the learner can actually read', () => {
  /** The particle-model table that shipped with its columns overlapping. */
  const PARTICLE = JSON.stringify({
    kind: 'datatable',
    title: 'Particle Model of Solids, Liquids, and Gases',
    columns: ['State of Matter', 'Particle Arrangement', 'Particle Movement'],
    rows: [
      ['Solid', 'Closely packed in a fixed position', 'Vibrate in place'],
      ['Liquid', 'Closely packed but able to slide past each other', 'Move around each other'],
      ['Gas', 'Far apart and spread out', 'Move freely in all directions'],
    ],
  })

  it('keeps every cell inside its own column', () => {
    const drawn = drawFromReply(PARTICLE)
    expect(drawn).not.toBeNull()
    const svg = drawn!.svg

    // Column edges, read off the verticals the table draws.
    const verticals = [...svg.matchAll(/<line x1="([\d.]+)" y1="[\d.]+" x2="\1" /g)]
      .map((m) => Number(m[1]))
    const edges = [...new Set(verticals)].sort((a, b) => a - b)
    expect(edges.length).toBeGreaterThanOrEqual(4)

    for (const m of svg.matchAll(/<text x="([\d.]+)" y="[\d.]+" text-anchor="(\w+)"[^>]*font-size="([\d.]+)"[^>]*>([^<]*)</g)) {
      const [x, anchor, size, label] = [Number(m[1]), m[2], Number(m[3]), m[4]]
      if (!label.trim()) continue
      // The title spans the whole table by design and belongs to no column.
      if (label.includes('Particle Model of Solids')) continue
      const width = label.length * size * 0.52
      const left = anchor === 'middle' ? x - width / 2 : x
      const right = left + width
      // Which column does this text sit in?
      const col = edges.findIndex((e, i) => i < edges.length - 1 && x > e && x < edges[i + 1])
      if (col < 0) continue  // the title, which sits over the whole table
      expect(left, `"${label}" runs out of its column on the left`).toBeGreaterThanOrEqual(edges[col] - 2)
      expect(right, `"${label}" runs out of its column on the right`).toBeLessThanOrEqual(edges[col + 1] + 2)
    }
  })

  it('wraps a long cell rather than letting it run', () => {
    const drawn = drawFromReply(PARTICLE)!
    // "Closely packed but able to slide past each other" cannot fit one line
    // in a readable column, so it has to have been split.
    expect(drawn.svg).not.toContain('Closely packed but able to slide past each other')
    expect(drawn.svg).toContain('Closely')
  })

  it('still draws a short table on one line per cell', () => {
    const drawn = drawFromReply('{"kind":"datatable","columns":["day","mm"],"rows":[["Mon","4"],["Tue","9"]]}')!
    expect(drawn.svg).toContain('>Mon<')
    expect(drawn.svg).toContain('>day<')
  })
})

describe('a shape that cannot exist', () => {
  it('refuses a rectangle whose opposite sides differ', () => {
    // Shown to a learner: a rectangle labelled 5 cm, 5 cm, 3 cm, 4 cm.
    expect(drawFromReply('{"kind":"polygon","sides":4,"shape":"rectangle","edges":["5 cm","5 cm","3 cm","4 cm"]}')).toBeNull()
    expect(drawFromReply('{"kind":"polygon","sides":4,"shape":"rectangle","edges":["5 cm","3 cm","5 cm","3 cm"]}')).not.toBeNull()
  })

  it('refuses a triangle that breaks the triangle inequality', () => {
    expect(drawFromReply('{"kind":"polygon","sides":3,"shape":"scalene","edges":["2 cm","3 cm","9 cm"]}')).toBeNull()
    expect(drawFromReply('{"kind":"polygon","sides":3,"shape":"scalene","edges":["6 cm","7 cm","9 cm"]}')).not.toBeNull()
  })

  it('refuses a right angle the sides do not support', () => {
    // 5, 5, 9 has its largest angle at 128 degrees; 3, 4, 5 is right. A
    // 5, 5, 7 is 88.9 and passes deliberately -- nobody can see the
    // difference and refusing it would cost more figures than it saves.
    expect(drawFromReply('{"kind":"polygon","sides":3,"shape":"right","rightAngle":"bottom-left","edges":["5 cm","5 cm","9 cm"]}')).toBeNull()
    expect(drawFromReply('{"kind":"polygon","sides":3,"shape":"right","rightAngle":"bottom-left","edges":["3 cm","4 cm","5 cm"]}')).not.toBeNull()
  })

  it('says nothing about labels that are not measurements', () => {
    // "x cm" and "a" are perfectly good edge labels.
    expect(drawFromReply('{"kind":"polygon","sides":4,"shape":"rectangle","edges":["x cm","y cm","x cm","y cm"]}')).not.toBeNull()
    expect(drawFromReply('{"kind":"polygon","sides":3,"edges":["a","b","c"]}')).not.toBeNull()
  })

  it('leaves a trapezium free, since its sides are meant to differ', () => {
    expect(drawFromReply('{"kind":"polygon","sides":4,"shape":"trapezium","edges":["18 cm","20 cm","30 cm","16 cm"]}')).not.toBeNull()
  })
})

describe('a table with nothing in it', () => {
  it('refuses a table whose value cells are all empty', () => {
    // "Recycling Collected by Class" shipped with Class 1-4 and no numbers,
    // under "Which average best represents the recycling collected?"
    expect(drawFromReply('{"kind":"datatable","title":"Recycling Collected by Class","columns":["Class","Recycling Collected (kg)"],"rows":[["Class 1",""],["Class 2",""],["Class 3",""],["Class 4",""]]}')).toBeNull()
  })

  it('keeps a table that carries its data', () => {
    expect(drawFromReply('{"kind":"datatable","columns":["Class","kg"],"rows":[["Class 1","12"],["Class 2","9"],["Class 3","15"]]}')).not.toBeNull()
  })
})
