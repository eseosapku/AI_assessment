import { describe, it, expect } from 'vitest'
import { cleanSay, cleanSuggestions } from '@/lib/studylab/tutorClean'

describe('cleanSay', () => {
  it("drops an 'I'll create a card' announcement sentence", () => {
    expect(cleanSay("Sodium reacts vigorously with water. I'll create a card to show this.")).toBe(
      'Sodium reacts vigorously with water.'
    )
  })

  it("drops 'Let me make a card...' too", () => {
    expect(cleanSay("Here's the key idea. Let me make a card to illustrate it.")).toBe("Here's the key idea.")
  })

  it('keeps normal pointing text', () => {
    expect(cleanSay('Look at the diagram on the board.')).toBe('Look at the diagram on the board.')
  })

  it('never blanks the whole message', () => {
    expect(cleanSay("I'll create a card to show this.")).toBe("I'll create a card to show this.")
  })
})

describe('cleanSuggestions', () => {
  it('drops card-action chips', () => {
    expect(cleanSuggestions(['Run the code', 'Go deeper', 'Click the card'])).toEqual(['Go deeper'])
  })

  it('keeps navigation chips', () => {
    expect(cleanSuggestions(['Show another example', "I'm ready to continue"])).toEqual([
      'Show another example',
      "I'm ready to continue",
    ])
  })
})
