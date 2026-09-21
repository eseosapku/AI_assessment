// lib/figure-noun.test.ts
import { describe, it, expect } from 'vitest'
import { figureNoun } from './figure-noun'

describe('the word the question uses for its figure', () => {
  it('calls a table a table, whatever the category says', () => {
    // The bug, verbatim: a table of the speed of sound in different media,
    // introduced as "Look at the map."
    expect(figureNoun('map_geo', 'This table shows the speed of sound in gases, liquids and solids.')).toBe('table')
    expect(figureNoun('device_photo', 'This table compares different types of business organisations.')).toBe('table')
    expect(figureNoun('other', 'A table of results for each trial.')).toBe('table')
  })

  it('does not call a photograph a table because people sit at one', () => {
    // A real description in the library. "seated at a table" is a photo.
    expect(figureNoun('device_photo', 'The image shows a panel of individuals seated at a table during a meeting.'))
      .not.toBe('table')
  })

  it('calls a graph a graph', () => {
    expect(figureNoun('other', 'This bar chart shows rainfall by month.')).toBe('graph')
    expect(figureNoun('device_photo', 'The graph plots distance against time, with labelled axes.')).toBe('graph')
    expect(figureNoun('diagram', 'A histogram of tomato masses.')).toBe('graph')
  })

  it('calls a map a map only when it is one', () => {
    expect(figureNoun('other', 'This map shows the regions of East Africa.')).toBe('map')
    expect(figureNoun('map_geo', 'Map of the river basin and its tributaries.')).toBe('map')
  })

  it('refuses a map_geo category when nothing in the description is a map', () => {
    // 878 rows carry map_geo with nothing map-like in them at all.
    expect(figureNoun('map_geo', 'A labelled diagram of a plant cell showing the chloroplast.')).toBe('diagram')
  })

  it('falls back to the category when the description says nothing', () => {
    expect(figureNoun('table', '')).toBe('table')
    expect(figureNoun('chart_diagram', undefined)).toBe('graph')
    expect(figureNoun('map_geo', '')).toBe('map')
    expect(figureNoun('science_diagram', '')).toBe('diagram')
    expect(figureNoun('', '')).toBe('diagram')
  })

  it('survives junk', () => {
    expect(() => figureNoun(null, null)).not.toThrow()
    expect(figureNoun(null, null)).toBe('diagram')
  })
})
