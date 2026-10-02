import { describe, it, expect } from 'vitest'
import { correctParagraphLetter, citedParagraph, citesAMissingParagraph, paragraphNumberToLetter, paragraphMismatch } from './paragraph-reference'

const PASSAGE = [
  'In the heart of the ancient city of Eldoria lived a young girl named Mira.',
  'One crisp autumn morning, Mira stumbled upon an old, weathered book of prophecies lying in the marketplace.',
  'As she delved deeper, Mira discovered it was a collection of prophecies, each more enigmatic than the last.',
  'Along the way she met a wise old hermit who shared the secrets of the ancient world, and a mischievous sprite who taught her the art of laughter in the face of danger.',
  'The rivers of the hidden realm flowed with liquid silver beneath skies of pink and gold.',
].join('\n\n')

const q = (question: string, accepted: string[]) => ({ question, passage: PASSAGE, short_answer: { accepted } })

describe('correctParagraphLetter', () => {
  it('corrects the letter on the questions that shipped', () => {
    // All four cited C; none of them were about C.
    expect(correctParagraphLetter(q('In paragraph C, give the name of the person who taught Mira the art of laughter.', ['sprite'])))
      .toBe('In paragraph D, give the name of the person who taught Mira the art of laughter.')
    expect(correctParagraphLetter(q('In paragraph C, name the person who shared the secrets of the ancient world.', ['hermit'])))
      .toBe('In paragraph D, name the person who shared the secrets of the ancient world.')
    expect(correctParagraphLetter(q('In paragraph C, give the colour of the rivers in the hidden realm.', ['liquid silver'])))
      .toBe('In paragraph E, give the colour of the rivers in the hidden realm.')
  })

  it('leaves a citation that is already right', () => {
    const stem = 'In paragraph B, name the type of book Mira discovered in the marketplace.'
    expect(correctParagraphLetter(q(stem, ['prophecies']))).toBe(stem)
  })

  it('leaves an answer that appears in more than one paragraph', () => {
    // "Mira" is everywhere; there is nothing to correct TO.
    const stem = 'In paragraph C, give the name of the girl.'
    expect(correctParagraphLetter(q(stem, ['Mira']))).toBe(stem)
  })

  it('leaves an inference answer that is nowhere in the text', () => {
    // "curious" is answered FROM the text without being quoted in it.
    const stem = 'In paragraph A, give a word that describes Mira.'
    expect(correctParagraphLetter(q(stem, ['curious']))).toBe(stem)
  })

  it('leaves a question with no citation, no passage or no key', () => {
    expect(correctParagraphLetter(q('Name the girl in the story.', ['Mira']))).toBe('Name the girl in the story.')
    expect(correctParagraphLetter({ question: 'In paragraph C, name the girl.', short_answer: { accepted: ['Mira'] } }))
      .toBe('In paragraph C, name the girl.')
    expect(correctParagraphLetter({ question: 'In paragraph C, name the girl.', passage: PASSAGE }))
      .toBe('In paragraph C, name the girl.')
  })
})

describe('citedParagraph and citesAMissingParagraph', () => {
  it('reads the cited letter', () => {
    expect(citedParagraph('In paragraph D, name the sprite.')).toBe('D')
    expect(citedParagraph('Name the sprite.')).toBe('')
  })

  it('spots a letter the passage does not have', () => {
    // The passage above runs A to E.
    expect(citesAMissingParagraph(q('In paragraph K, name the runes.', ['runes']))).toBe(true)
    expect(citesAMissingParagraph(q('In paragraph B, name the book.', ['prophecies']))).toBe(false)
  })
})

const PARAS = [
  'In the heart of the town of Eldergrove, Elara explored the narrow cobblestone streets and the old market.',
  'She wandered through the winding paths of the forest, feeling excitement and anticipation as birds sang.',
  'Elara ventured into the deep forest and found the majestic Eldergrove Tree, whose branches touched the sky.',
  'She would often sit beneath the tree and whisper her wish for courage and wisdom to the leaves.',
].join('\n\n')

describe('a question that cites the wrong paragraph', () => {
  it('turns "paragraph 3" into the letter the screen shows', () => {
    expect(paragraphNumberToLetter('Write the adjective in paragraph 3 that describes the tree.', PARAS))
      .toBe('Write the adjective in paragraph C that describes the tree.')
  })

  it('flags "find the word in paragraph B" when paragraph B does not have it', () => {
    // "into" is in C and nowhere in B; nothing to correct it to that is not a guess.
    expect(paragraphMismatch({ question: 'Write the preposition that shows direction in paragraph B.', short_answer: { accepted: ['into', 'beneath'] }, passage: PARAS })).toBe(true)
  })

  it('passes a word that is where the question says', () => {
    expect(paragraphMismatch({ question: 'Write the preposition that shows direction in paragraph B.', short_answer: { accepted: ['through'] }, passage: PARAS })).toBe(false)
  })

  it('leaves an inference question alone', () => {
    expect(paragraphMismatch({ question: 'How does Elara feel in paragraph B?', short_answer: { accepted: ['excited'] }, passage: PARAS })).toBe(false)
  })

  it('flags a tick list whose ticked statements come from another paragraph', () => {
    const q = {
      type: 'interactive', kind: 'multi_select', passage: PARAS,
      question: 'Tick all the correct statements about paragraph D.',
      options: ['Elara found the majestic Eldergrove Tree in the deep forest.', 'Elara wished for courage and wisdom.', 'The market sold fish.'],
      correct_indices: [0, 1],
    }
    expect(paragraphMismatch(q)).toBe(true)
  })

  it('passes a tick list whose ticks are in the paragraph', () => {
    const q = {
      type: 'interactive', kind: 'multi_select', passage: PARAS,
      question: 'Tick all the correct statements about paragraph D.',
      options: ['Elara would often sit beneath the tree.', 'She whispered her wish for courage and wisdom.', 'The market sold fish.'],
      correct_indices: [0, 1],
    }
    expect(paragraphMismatch(q)).toBe(false)
  })
})
