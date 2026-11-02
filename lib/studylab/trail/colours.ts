// lib/studylab/trail/colours.ts

/**
 * The board's own colours. They are set as `--trail-*` variables under `.ss-trail`
 * in globals.css; these are the values the contrast test holds to 3:1.
 */
export const TRAIL_COLOURS = {
  light: {
    tile: ['#0C6FAE', '#0C86CE'] as [string, string],
    done: ['#047857', '#059669'] as [string, string],
    grid: '#D5E0E7',
    canvas: '#E8EEF3',
  },
  dark: {
    tile: ['#2ACBF2', '#0C86CE'] as [string, string],
    done: ['#34D399', '#059669'] as [string, string],
    grid: '#64748B',
    canvas: '#0a0a0a',
  },
}
