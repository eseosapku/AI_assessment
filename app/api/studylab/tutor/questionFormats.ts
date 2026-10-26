// app/api/studylab/tutor/questionFormats.ts
import { tapFigureLines } from '@/lib/studylab/check/diagramRegions'

/**
 * The question formats a learner answers with their hands, as the check
 * writer and the station tutor are shown them. Shapes are spelled out with
 * their exact field names -- naming a format alone got back guessed fields --
 * and the diagrams a tap can use come from the region maps, never copied by
 * hand.
 */
export function byHandFormats(): string {
  return [
    'QUESTION FORMATS done by hand -- use one when it fits better than a multiple choice:',
    '  fill  -- a key word in a definition or rule: { "id":"q1","format":"fill","prompt":"Complete the sentence.",',
    '           "text":"Plants make ___ from carbon dioxide and ___.","tiles":["glucose","water","oxygen"],"answer":["glucose","water"] }',
    '           Each blank is ___ in "text"; "answer" has one tile per blank, in order; "tiles" are the answers plus one or two',
    '           a confused student would pick, all different, eight at most.',
    '  order -- a process, a cycle or the steps of a method: { "id":"q2","format":"order","prompt":"Put the stages in order.",',
    '           "items":["Egg","Larva","Pupa","Adult"],"clues":[{ "text":"The larva hatches from the egg.","before":"Egg","after":"Larva" }] }',
    '           Three to six "items" written IN THE RIGHT ORDER (the card shuffles them); up to four "clues", optional, each naming',
    '           two items exactly as written and true of the right order.',
    '  tap   -- a part of a diagram: { "id":"q3","format":"tap","prompt":"Tap the part that controls the cell.",',
    '           "figure":"asset:plant-cell","answer":["nucleus"] }',
    '           A tap question names a figure and parts from this list, by id; the picture shows no labels, so ask for a part by',
    '           what it does or looks like. Never ask for every part of a figure.',
    ...tapFigureLines().map((l) => `    ${l}`),
  ].join('\n')
}
