/**
 * What to call a figure in the question that refers to it.
 *
 * The question says "Look at the ___." and the word has to be right, because
 * the learner is looking straight at the thing. Live, on a Checkpoint Science
 * paper, beside a table of the speed of sound in different media:
 *
 *   "Look at the map. State the medium where the speed of sound is highest."
 *
 * The word came from the figure's stored `category`, and that field is wrong
 * far more often than it looks. Counted across the 17,008-image library:
 *
 *   878 figures categorised `map_geo` whose description mentions no map
 *   713 described as a table, categorised as something else
 * 1,586 described as a graph or chart, categorised as neither
 *
 * The descriptions are good — they were written by a vision pass and say
 * plainly what each figure is. So the description decides the noun, and the
 * category is only the fallback for when the description does not say.
 *
 * Rewriting the category on 3,000 manifest rows would have fixed the same bug
 * with a much wider blast radius: `category` is also read by the figure
 * matcher and the image-question judge, and neither wants its meaning changed
 * underneath it.
 */

/** "this table shows", "a table of results" — not "seated at a table". */
const DESCRIBES_TABLE =
  /\b(?:this|the|a)\s+table\s+(?:shows?|compares?|lists?|categoriz|categoris|presents?|gives?|summaris|summariz|sets? out|contains?)|(?:\btable\s+of\s+\w+)|^(?:this|the)\s+table\b/i

const DESCRIBES_GRAPH =
  /\b(?:bar|line|pie|column)\s+(?:chart|graph)\b|\bhistogram\b|\bscatter\s*(?:gram|plot)\b|\b(?:this|the|a)\s+graph\s+(?:shows?|plots?|compares?|illustrates?)|\bgraph\s+of\b|\baxes\b/i

const DESCRIBES_MAP =
  /\b(?:this|the|a)\s+map\s+(?:shows?|of|illustrates?|depicts?)|\bmap\s+of\s+(?:the\s+)?\w+|\btopograph|\bcontour\s+map\b/i

function fromCategory(category: string): string {
  if (category === 'graph' || category === 'chart' || category === 'chart_diagram') return 'graph'
  if (category === 'table') return 'table'
  if (category === 'map_geo') return 'map'
  return 'diagram'
}

/**
 * The noun a question should use for this figure.
 *
 * The description is trusted first and the category only when the description
 * is silent, because the description is the field that was actually written
 * about this image.
 */
export function figureNoun(category: unknown, description?: unknown): string {
  const desc = String(description ?? '')

  if (desc.trim()) {
    // Map first: it is the narrowest claim and the one that was wrong most.
    if (DESCRIBES_MAP.test(desc)) return 'map'
    if (DESCRIBES_GRAPH.test(desc)) return 'graph'
    if (DESCRIBES_TABLE.test(desc)) return 'table'
  }

  const cat = String(category ?? '')
  // A description that plainly is not a map overrules a map_geo category:
  // 878 rows carry it with nothing map-like in them at all.
  if (cat === 'map_geo' && desc.trim() && !/\bmap\b/i.test(desc)) return 'diagram'

  return fromCategory(cat)
}
