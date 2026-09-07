// lib/book-reference.test.ts
//
// Every stem quoted here is one this pulled off the live database, not one
// invented for the test.
import { describe, it, expect } from 'vitest'
import {
  bookReference,
  stripBookLocators,
  repairBookReference,
  repairBookReferences,
} from './book-reference'

describe('bookReference', () => {
  it('finds the page the student cannot turn to', () => {
    expect(bookReference('Use the diagram on page 286 to support your explanation.')).toBe('page')
    expect(bookReference("Using the Python Shell window shown on page 255, describe how a simple 'Hello World!' program is executed.")).toBe('page')
    expect(bookReference('See pp. 12-13 for the method.')).toBe('page')
    expect(bookReference('The circuit shown on the previous page has two resistors.')).toBe('page')
  })

  it('finds the book itself', () => {
    expect(bookReference('Use the table on page 23 of the textbook to support your answer.')).toBe('page')
    expect(bookReference('Compare the two methods described in your coursebook.')).toBe('book')
  })

  it('finds a numbered figure, which is how a textbook labels its own', () => {
    expect(bookReference('State the energy transfer shown in Figure 28.3.')).toBe('figure-number')
    expect(bookReference('Complete Activity 12.2 and explain your result.')).toBe('figure-number')
    expect(bookReference('Refer to Fig. 7 when answering.')).toBe('figure-number')
  })

  it('leaves a bare "Table 3" alone', () => {
    // Far more often the student's own data than the book's furniture, and
    // rejecting a good question is worse than letting a loose one through.
    expect(bookReference('Table 3 shows the results of the experiment you ran.')).toBeNull()
  })

  it('finds a chapter cross-reference', () => {
    expect(bookReference('Compare the anti-social behaviors described in Unit 9 with those expected at school.')).toBe('chapter')
    expect(bookReference('Explain how the sources of wealth discussed in Unit 10 develop Rwanda.')).toBe('chapter')
    expect(bookReference("What is the main purpose of the 'Revision Exercises' in Unit 11?")).toBe('chapter')
  })

  it('does not mistake a real document cited by chapter for the textbook', () => {
    // "Chapter 4 of the Constitution" is the subject of the question. The
    // capital letter is the whole difference from "of the textbook".
    expect(bookReference('Which rights are protected in Chapter 4 of the Constitution?')).toBeNull()
    expect(bookReference('Explain the effect of Section 3 of the Companies Act.')).toBeNull()
  })

  it('does not treat an ordinary book as the study book', () => {
    // All four were being dropped off the live site by an earlier draft of
    // this rule. "The book" is one of the commonest nouns in a physics,
    // arithmetic or comprehension question.
    expect(bookReference('A book rests on a horizontal table. What is the reaction force to the weight of the book?')).toBeNull()
    expect(bookReference('A book costs 3.75 Rwandan Francs. What is the total cost of the book and the pen?')).toBeNull()
    expect(bookReference('What is the title of the book Eliza wants to pawn?')).toBeNull()
    expect(bookReference("Analyse the significance of the book's description in the passage.")).toBeNull()
  })

  it('still catches the study book, however it is named', () => {
    expect(bookReference('Which statement about how rocks are formed is accurate, as described in the textbook?')).toBe('book')
    expect(bookReference('Which of these is mentioned in the book?')).toBe('book')
    expect(bookReference('Compare the two methods described in your coursebook.')).toBe('book')
  })

  it('leaves an ordinary question alone', () => {
    expect(bookReference('Explain why a solid conducts heat faster than a gas.')).toBeNull()
    expect(bookReference('Design a web page that lists three products.')).toBeNull()
    expect(bookReference('')).toBeNull()
    expect(bookReference(null)).toBeNull()
  })
})

describe('stripBookLocators', () => {
  it('takes the pointer out and leaves a sentence', () => {
    expect(stripBookLocators('Using the table on page 23, calculate the speed of sound in water.')).toBe(
      'Using the table, calculate the speed of sound in water.',
    )
    expect(stripBookLocators('Use the speed of sound from the table on page 23 of the textbook.')).toBe(
      'Use the speed of sound from the table.',
    )
  })

  it('keeps a real document intact', () => {
    const q = 'Which rights are protected in Chapter 4 of the Constitution?'
    expect(stripBookLocators(q)).toBe(q)
  })
})

describe('repairBookReference', () => {
  it('deletes a sentence that only sends the student to the book', () => {
    expect(
      repairBookReference(
        'Describe the process of diffraction of sound waves through a narrow slit. Use the diagram on page 286 to support your explanation.',
        false,
      ),
    ).toBe('Describe the process of diffraction of sound waves through a narrow slit.')
  })

  it('keeps the marks that trail the sentence it deleted', () => {
    expect(
      repairBookReference(
        'Analyse the factors that determine the speed of sound in different media. Use the table on page 23 of the textbook to support your answer. (6 marks)',
        false,
      ),
    ).toBe('Analyse the factors that determine the speed of sound in different media. (6 marks)')
  })

  it('deletes a trailing "provide examples from" pointer', () => {
    expect(
      repairBookReference(
        'Analyse the impact of the speed of sound on the clarity of sound transmission. Provide examples from the table on page 23 of the textbook.',
        false,
      ),
    ).toBe('Analyse the impact of the speed of sound on the clarity of sound transmission.')
  })

  it('will not delete a sentence that is doing the asking', () => {
    // "Using the Python Shell window shown on page 255, describe how…" opens
    // like a pointer, but the clause after the comma is the whole question.
    // Deleting it would leave "Explain the role of each line of code in the
    // subroutine 'Main'", which is unanswerable in a different way.
    expect(
      repairBookReference(
        "Using the Python Shell window shown on page 255, describe how a simple 'Hello World!' program is executed and what the output would be. Explain the role of each line of code in the subroutine 'Main'.",
        false,
      ),
    ).toBeNull()
  })

  it('deletes a trailing clause without touching the question around it', () => {
    expect(
      repairBookReference(
        'Describe the process of preparing carbon dioxide in the laboratory, as outlined in the textbook. Include the reactants and the apparatus.',
        false,
      ),
    ).toBe('Describe the process of preparing carbon dioxide in the laboratory. Include the reactants and the apparatus.')
  })

  it('deletes a clause buried mid-sentence, and both of its commas', () => {
    expect(
      repairBookReference(
        'Explain, using examples from the textbook, how the ability of a substance to conduct electricity relates to mobile ions.',
        false,
      ),
    ).toBe('Explain how the ability of a substance to conduct electricity relates to mobile ions.')
  })

  it('takes only the word "textbook" off a figure the student can see', () => {
    // "Referring to the textbook figure, which volcano…" — cutting the whole
    // phrase leaves "Referring figure". The book is an adjective here.
    expect(
      repairBookReference(
        'Referring to the textbook figure, which type of volcano is most likely to have a broad, shield-like shape?',
        true,
      ),
    ).toBe('Referring to the figure, which type of volcano is most likely to have a broad, shield-like shape?')
  })

  it('deletes a bracketed aside', () => {
    expect(repairBookReference('Which shape has four right angles? (Refer to the diagram on page 143)', false)).toBe(
      'Which shape has four right angles?',
    )
  })

  it('never deletes the first clause, which is the one carrying the data', () => {
    // "Using the table on page 23" is where the numbers are. What follows it
    // — "calculate the time it takes" — is not a question on its own.
    expect(repairBookReference('Using the table on page 23, calculate the time sound takes to travel 1 km.', false)).toBeNull()
  })

  it('cuts an attribution wherever it sits, including the opening clause', () => {
    // The one cut that can never cost the question anything: nothing is on the
    // far end of the pointer that the student needs.
    expect(repairBookReference('According to the textbook, what is a constellation?', false)).toBe(
      'What is a constellation?',
    )
    expect(
      repairBookReference('Which of the following sources of wealth is most sustainable according to the textbook?', false),
    ).toBe('Which of the following sources of wealth is most sustainable?')
    expect(
      repairBookReference('Explain how the sources of wealth discussed in Unit 10 contribute to development.', false),
    ).toBe('Explain how the sources of wealth contribute to development.')
    expect(
      repairBookReference(
        'When magnesium reacts with oxygen it forms magnesium oxide. According to the textbook, what type of oxide is this?',
        false,
      ),
    ).toBe('When magnesium reacts with oxygen it forms magnesium oxide. What type of oxide is this?')
  })

  it('will not rescue a question that leans on "the book" for real', () => {
    // "Which of these is mentioned?" is worse than the question it came from,
    // so a plain book is left to be dropped rather than cut down.
    expect(
      repairBookReference(
        'The book says you will be doing lots of different things in Stage 3. Which of these is mentioned in the book?',
        false,
      ),
    ).toBeNull()
  })

  it('will not delete a pointer that is carrying the task', () => {
    expect(repairBookReference('Use the graph on page 12 to determine the gradient.', false)).toBeNull()
  })

  it('rewrites rather than drops when the figure is actually attached', () => {
    expect(
      repairBookReference('Using the table on page 23, calculate the time sound takes to travel 1 km in air.', true),
    ).toBe('Using the table, calculate the time sound takes to travel 1 km in air.')
  })

  it('gives up on a single sentence with nothing on screen', () => {
    expect(
      repairBookReference(
        'Investigate how the medium changes the speed of sound using the data from the table on page 23 of the textbook.',
        false,
      ),
    ).toBeNull()
  })

  it('returns null for a stem that never mentioned the book', () => {
    expect(repairBookReference('Explain why a solid conducts heat faster than a gas.', false)).toBeNull()
  })
})

describe('repairBookReferences', () => {
  it('rewrites the stems it can and counts them', () => {
    const paper = [
      { question: 'Describe diffraction through a narrow slit. Use the diagram on page 286 to support your explanation.' },
      { question: 'Using the table on page 23, calculate the wavelength.', image_url: '/fig/table.png' },
      { question: 'Compare the behaviors described in Unit 9 with those expected at school.' },
      { question: 'Using the table on page 227, calculate the average age of the people listed.' },
      { question: 'Explain why a solid conducts heat faster than a gas.' },
    ]
    expect(repairBookReferences(paper)).toBe(3)
    expect(paper[0].question).toBe('Describe diffraction through a narrow slit.')
    expect(paper[1].question).toBe('Using the table, calculate the wavelength.')
    expect(paper[2].question).toBe('Compare the behaviors with those expected at school.')
    // Left for danglingReference to drop — the table it needs is not on screen.
    expect(paper[3].question).toContain('page 227')
    expect(paper[4].question).toBe('Explain why a solid conducts heat faster than a gas.')
  })

  it('cleans the hints and the model answer whatever happens to the stem', () => {
    // A hint never carries the data the question needs, so the page number
    // there is noise rather than a missing half.
    const q: any = {
      question: 'Explain why a solid conducts heat faster than a gas.',
      hints: ['Name the state of matter.', 'Look at the diagram on page 88.'],
      marking_criteria: ['Particles are closer together (see page 87).'],
      model_answer: 'As the table on page 23 shows, particles in a solid are closer together.',
      explanation: 'Tests understanding of Figure 4.2.',
    }
    expect(repairBookReferences([q])).toBe(0)
    expect(q.hints[1]).toBe('Look at the diagram.')
    expect(q.marking_criteria[0]).toBe('Particles are closer together.')
    expect(q.model_answer).toBe('As the table shows, particles in a solid are closer together.')
    expect(q.explanation).toBe('Tests understanding.')
  })

  it('survives a paper with nothing usable in it', () => {
    expect(repairBookReferences([{}, { question: 3 } as any, { question: '' }])).toBe(0)
  })
})
