// lib/passage-question-match.test.ts
import { describe, it, expect } from 'vitest'
import { properNounsIn, namesAbsentFromPassage, questionInventsItsOwnText, passageBorrowsAKnownWork, questionIsOffPassage, offPassageStrength } from './passage-question-match'

/** The exact stems that shipped with no passage on the page. */
const SHIPPED = [
  'Emily entered The Literary Haven because she wanted to find a book that would take her on an adventure. Write down the title of the book Mr. Hawthorne recommended to Emily.',
  'Clara stumbled upon an ancient oak tree. Write down the name of the woman who guided Clara in the garden.',
  'Clara stumbled upon an ancient oak tree, what was hidden within its trunk?',
]

describe('a question about a story nobody wrote', () => {
  it('catches every one of the stems that shipped, when there is no passage', () => {
    for (const stem of SHIPPED) {
      expect(questionInventsItsOwnText(stem, ''), stem.slice(0, 40)).toBe(true)
      expect(questionInventsItsOwnText(stem, undefined), stem.slice(0, 40)).toBe(true)
    }
  })

  it('catches a name the passage does not contain', () => {
    const passage = 'Amara walked to the market before dawn. The stalls were already busy.'
    expect(namesAbsentFromPassage('Write down the name of the woman who guided Clara.', passage)).toEqual(['Clara'])
  })

  it('accepts a question whose names are all in the passage', () => {
    const passage = 'Emily entered the shop. Mr Hawthorne looked up from his desk and smiled at her.'
    expect(questionInventsItsOwnText('Write down the title of the book Mr. Hawthorne recommended to Emily.', passage)).toBe(false)
  })

  it('does not fire on ordinary questions with no names at all', () => {
    for (const stem of [
      'Write down one factor that can change the rate of a chemical reaction.',
      'Add 2/5 and 3/7.',
      'Explain why the writer uses a short sentence here.',
      'Give two reasons why the boy was late.',
      'Which word in line 4 means the same as "quiet"?',
    ]) {
      expect(questionInventsItsOwnText(stem, ''), stem).toBe(false)
    }
  })

  it('does not treat a capitalised weekday, month or subject as a person', () => {
    for (const stem of [
      'The bus leaves on Monday. Write down the day the bus leaves.',
      'The experiment started in March. Give the month it started.',
      'Write down one thing the learner does in English lessons.',
    ]) {
      expect(properNounsIn(stem).length, stem).toBe(0)
    }
  })

  it('ignores a capital that only starts a sentence', () => {
    expect(properNounsIn('Explain why the water rose. Describe what happened next.')).toEqual([])
  })

  it('matches a titled name against the surname alone in the passage', () => {
    const passage = 'Hawthorne had run the shop for thirty years.'
    expect(namesAbsentFromPassage('What did Mr. Hawthorne say?', passage)).toEqual([])
  })
})

describe('a name at the start of a sentence still counts', () => {
  it('finds the invented story even when its name opens the question', () => {
    expect(properNounsIn('Clara stumbled upon an ancient oak tree, what was hidden within its trunk?'))
      .toContain('Clara')
    expect(properNounsIn('Sam poured a mixture through the funnel. Name the liquid.'))
      .toContain('Sam')
  })

  it('passes an ordinary capitalised word when the passage contains it', () => {
    // The guard only runs on papers that HAVE a passage, and a question about
    // the passage uses the passage's own words.
    const passage = 'Water boils at one hundred degrees. Iron rusts in damp air.'
    expect(namesAbsentFromPassage('Water boils at what temperature?', passage)).toEqual([])
    expect(namesAbsentFromPassage('Iron rusts in which conditions?', passage)).toEqual([])
  })
})

describe('what the guard must not delete', () => {
  const passage = 'Gandalf arrived at dusk. Bilbo opened the door and stared at the wizard.'

  it('treats a possessive as the same name', () => {
    // "Gandalf's" was reported absent from a passage saying Gandalf twice,
    // and a good question was deleted for it.
    expect(namesAbsentFromPassage("What was in Gandalf's hand?", passage)).toEqual([])
    expect(namesAbsentFromPassage('Whose door did Bilbo open?', passage)).toEqual([])
  })

  it('does not read a command word as a character', () => {
    for (const stem of [
      'Identify the reason the wizard came.',
      'Provide two words that describe the door.',
      'Suggest why Bilbo was surprised.',
      'Compare the two characters.',
    ]) {
      expect(namesAbsentFromPassage(stem, passage), stem).toEqual([])
    }
  })

  it('still catches a character who is genuinely not there', () => {
    expect(namesAbsentFromPassage('What did Smaug guard?', passage)).toEqual(['Smaug'])
  })
})

describe('a passage that belongs to somebody else', () => {
  it('catches the text that actually came back', () => {
    const tolkien = 'The sun had long since set behind the rolling hills of the Shire. Bilbo Baggins sat by his fireplace. In walked Gandalf, the grey wizard. A dragon guards a mountain of gold, and it is this dragon, Smaug, who has been troubling the lands.'
    expect(passageBorrowsAKnownWork(tolkien)).toBeTruthy()
  })

  it('catches the other usual suspects', () => {
    for (const t of [
      'Hermione opened the door to the Gryffindor common room.',
      'The children stepped through the wardrobe into Narnia.',
      'Katniss drew her bow.',
      'They travelled to Hogwarts by train.',
    ]) {
      expect(passageBorrowsAKnownWork(t), t).toBeTruthy()
    }
  })

  it('leaves an original story alone', () => {
    for (const t of [
      'Amara walked to the market before dawn. The stalls were already busy with traders.',
      'The old mill on the river had not turned for thirty years. Musa decided to find out why.',
      'Every Thursday, Grandmother told the same story about the drought of her childhood.',
      'Charlie and Matilda shared a desk by the window.',
    ]) {
      expect(passageBorrowsAKnownWork(t), t).toBe('')
    }
  })
})

describe('a grammar item carries its own example', () => {
  const passage = 'The river rose after three days of rain. Musa watched from the bank.'

  it('ignores names inside a quoted example sentence', () => {
    // These four came off a real Reading and Usage paper and were all
    // deleted: the quoted sentence IS the exercise, not a reference to the
    // reading text.
    for (const stem of [
      "Match each pronoun to what it refers back to in the sentence: 'Sarah went to the library because she was late.'",
      "Find the information stated directly in the text: 'The capital of France is Paris.'",
      "Match the heading 'The Importance of Recycling' to the correct paragraph.",
    ]) {
      expect(namesAbsentFromPassage(stem, passage), stem.slice(0, 40)).toEqual([])
    }
  })

  it('still catches an unquoted character who is not in the text', () => {
    expect(namesAbsentFromPassage('Write down the name of the woman who guided Clara.', passage)).toEqual(['Clara'])
  })

  it('does not swallow a short quoted word', () => {
    // Only a quoted SENTENCE is an exercise; a quoted word is a reference
    // into the passage and its name still counts.
    expect(namesAbsentFromPassage('Who said "go"? Was it Ngozi?', passage)).toContain('Ngozi')
  })
})

describe('command words found by reading a live paper', () => {
  const passage = 'The river rose after three days of rain. Musa watched from the bank.'

  it('does not read a command or a structural noun as a character', () => {
    for (const stem of [
      'Determine the meaning of the word as it is used here.',
      'Infer why the river rose so quickly.',
      'Match the heading to the correct paragraph from the text.',
      'Arrange the events in the order they happened.',
      'Outline what Musa did next.',
    ]) {
      expect(namesAbsentFromPassage(stem, passage), stem).toEqual([])
    }
  })
})

describe('punctuation stuck to a word', () => {
  const passage = 'The river rose after three days of rain. Musa watched from the bank.'

  it('does not invent a character called Who', () => {
    // The token was `Who'` — not in the stop list however plainly it is not
    // a person — so a good grammar question was deleted.
    expect(namesAbsentFromPassage(
      "Explain the correct word order in a question starting with 'Who'. Provide an example sentence.",
      passage,
    )).toEqual([])
  })

  it('still reads a quoted character name as a name', () => {
    expect(namesAbsentFromPassage('Who is "Ngozi"?', passage)).toContain('Ngozi')
  })
})

describe('grammar commands are not characters either', () => {
  const passage = 'The river rose after three days of rain. Musa watched from the bank.'

  it('does not read a usage command as a name', () => {
    for (const stem of [
      "Correct the question form in the sentence: 'What time does the movie start?'",
      'Trace how the main idea develops in the text.',
      'Rearrange the words to make a question.',
      'Insert the missing comma.',
    ]) {
      expect(namesAbsentFromPassage(stem, passage), stem).toEqual([])
    }
  })
})

describe('questionIsOffPassage', () => {
  const PASSAGE =
    'In the heart of the ancient city of Eldoria lived a young girl named Mira. ' +
    'One crisp autumn morning she stumbled upon an old, weathered book of prophecies ' +
    'lying in the marketplace. The rivers of the hidden realm flowed with liquid silver.'

  it('catches the questions that shipped on an English paper', () => {
    for (const stem of [
      'Explain the meaning implied by the warning sign for laser radiation.',
      "What does the label 'Room temperature Tw = 20 C' imply about the environment?",
      'Using evidence from the text, explain why the boy is writing a letter.',
    ]) {
      expect(questionIsOffPassage(stem, PASSAGE), stem).toBe(true)
    }
  })

  it('leaves questions that are genuinely about the passage', () => {
    for (const stem of [
      'In paragraph B, name the type of book Mira discovered in the marketplace.',
      'Give the colour of the rivers in the hidden realm.',
      'Explain how the writer makes Eldoria sound ancient.',
      'Give a word from the text that describes the morning.',
    ]) {
      expect(questionIsOffPassage(stem, PASSAGE), stem).toBe(false)
    }
  })

  it('leaves a composition, which is not about the passage by design', () => {
    for (const stem of [
      'Write a letter to a friend explaining why you enjoyed a recent stage performance.',
      'Write a story about a journey that goes wrong.',
      'Write an article for your school magazine about keeping fit.',
    ]) {
      expect(questionIsOffPassage(stem, PASSAGE), stem).toBe(false)
    }
  })

  it('says nothing without a passage, or on a stem with nothing to judge', () => {
    expect(questionIsOffPassage('Explain the warning sign for laser radiation.', '')).toBe(false)
    expect(questionIsOffPassage('', PASSAGE)).toBe(false)
    expect(questionIsOffPassage('Give a word.', PASSAGE)).toBe(false)
  })
})

describe('off-passage on a live English paper that came back short', () => {
  const P =
    'In the heart of the ancient city of Eldoria lived a young girl named Mira. One crisp autumn ' +
    'morning she stumbled upon an old book in the marketplace. "Where did you come from?" she whispered.'

  it('keeps self-contained usage exercises and writer\'s-craft questions', () => {
    // All four were dropped, and the paper failed at 14 of 17.
    for (const stem of [
      "Rewrite the following reported speech into direct speech: 'She said that she was tired.'",
      "Form a question using the words provided: 'you / to / going / the / park'",
      "What does the pronoun 'it' refer back to in the sentence: 'The cat chased the ball because it moved.'",
      'Explain how the choice of speech verbs affects the portrayal of characters.',
    ]) {
      expect(questionIsOffPassage(stem, P), stem).toBe(false)
    }
  })

  it('still drops a question about a different text', () => {
    for (const stem of [
      'Trace how the idea of using data mining develops across the text.',
      'Explain the meaning implied by the warning sign for laser radiation.',
      "Find the information stated directly in the text: 'The capital of France is Paris.'",
    ]) {
      expect(questionIsOffPassage(stem, P), stem).toBe(true)
    }
  })
})

describe('offPassageStrength', () => {
  const P =
    'In the heart of the ancient city of Eldoria lived a young girl named Mira. One crisp autumn ' +
    'morning she stumbled upon an old book in the marketplace. "Where did you come from?" she whispered.'

  it('is certain only when a question quotes the text and the text does not say it', () => {
    expect(offPassageStrength("Find the information stated directly in the text: 'The capital of France is Paris.'", P))
      .toBe('certain')
  })

  it('is only likely when the evidence is shared words alone', () => {
    expect(offPassageStrength("What does the priest's role in the wedding ceremony reveal about society?", P))
      .toBe('likely')
  })

  it('says nothing about the literature questions it used to drop', () => {
    for (const stem of [
      'How does varying sentence length affect the pacing of the story?',
      'Describe how the main idea is developed throughout the text.',
      'Draw a ring around the event that happened first in paragraph B.',
    ]) {
      expect(offPassageStrength(stem, P), stem).toBeNull()
    }
  })
})

describe('a quotation that differs only in punctuation or one word', () => {
  const P =
    "Lyra’s fascination with the old books ignited a fire within her. She spent hours poring " +
    'over faded pages in the attic, where the light fell through a cracked window.'

  it('is not treated as absent from the text', () => {
    // Curly apostrophe in the passage, straight one in the question.
    expect(offPassageStrength(
      "Explain why the writer chose the word 'ignited' in the text: 'Lyra's fascination with the old books ignited a fire'.",
      P,
    )).not.toBe('certain')
    // One word paraphrased.
    expect(offPassageStrength(
      "In paragraph A, what does the writer suggest with 'she spent hours poring over old pages in the attic'?",
      P,
    )).not.toBe('certain')
  })

  it('is still absent when the text says nothing like it', () => {
    expect(offPassageStrength("Find the information stated directly in the text: 'The capital of France is Paris.'", P))
      .toBe('certain')
  })
})
