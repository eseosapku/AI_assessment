/**
 * Holding a comprehension question to the text it claims to be about.
 *
 * Shipped, on a Cambridge English paper, with no passage anywhere on screen:
 *
 *   "Emily entered The Literary Haven because she wanted to find a book that
 *    would take her on an adventure. Write down the title of the book Mr.
 *    Hawthorne recommended to Emily."
 *   "Clara stumbled upon an ancient oak tree. Write down the name of the woman
 *    who guided Clara in the garden."
 *
 * Three questions of forty-two opened on that same sentence about Clara, and
 * the learner was never shown a word of the story any of them asked about.
 * The model had comprehension foci, no text, and did the only thing left: it
 * invented one per question and asked about the invention.
 *
 * The prompt already says "ask about THIS text". That is trust, and trust has
 * not once been enough in this codebase. A name in the question that is not in
 * the passage is a question with no answer, and that is checkable.
 *
 * Deliberately narrow: it looks for PROPER NOUNS, which is what an invented
 * story brings with it. It says nothing about whether the answer is really
 * findable — only that the thing being asked about exists on the page.
 */

/**
 * Capitalised words that are not somebody's name.
 *
 * Days, months, subjects and the like are legitimately capitalised in a stem
 * about a text that never mentions them, and flagging those would delete good
 * questions to catch bad ones.
 */
const NOT_A_NAME = new Set([
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august',
  'september', 'october', 'november', 'december',
  'english', 'mathematics', 'maths', 'science', 'biology', 'chemistry', 'physics',
  'history', 'geography', 'art', 'music', 'write', 'give', 'name', 'state',
  'explain', 'describe', 'complete', 'tick', 'circle', 'choose', 'look', 'read',
  'which', 'what', 'who', 'whose', 'whom', 'where', 'when', 'why', 'how',
  'the', 'a', 'an',
  'in', 'on', 'at', 'to', 'from', 'for', 'this', 'that', 'these', 'those',
  'one', 'two', 'three', 'four', 'five', 'both', 'each', 'use', 'using',
  'find', 'work', 'put', 'add', 'draw', 'answer', 'question', 'text', 'passage',
  'yes', 'no', 'true', 'false',
  // Command words that open a sentence and are not anybody's name. Missing
  // these reported "Identify" and "Provide" as characters absent from the
  // passage, and deleted two perfectly good questions.
  'identify', 'provide', 'select', 'match', 'list', 'suggest', 'compare',
  'calculate', 'work', 'copy', 'underline', 'fill', 'rewrite', 'summarise',
  'summarize', 'quote', 'refer', 'consider', 'think', 'imagine', 'discuss',
  // Another round of the same, found by reading a live paper: every one
  // of these opened a question and was reported as a missing character.
  'determine', 'infer', 'deduce', 'outline', 'define', 'label', 'order',
  'arrange', 'sort', 'group', 'count', 'measure', 'record', 'predict',
  'show', 'prove', 'justify', 'evaluate', 'assess', 'review', 'check',
  // Headings and acronyms a question quotes as part of its own item.
  'heading', 'paragraph', 'sentence', 'title', 'line', 'word', 'phrase',
  'html', 'pdf', 'url', 'ict',
  // And again, from the next live paper. Every one of these opened a
  // question and was reported as a character absent from the text.
  'correct', 'trace', 'rearrange', 'insert', 'replace', 'change', 'form',
  'punctuate', 'spell', 'join', 'separate', 'expand', 'shorten', 'begin',
])

/** Titles that attach to a name and should travel with it. */
const TITLE = /^(?:mr|mrs|ms|miss|dr|prof|sir|lady|lord|aunt|uncle|captain|doctor)\.?$/i

/**
 * Proper nouns a question names.
 *
 * A word is a candidate when it is capitalised and is NOT the first word of a
 * sentence — a sentence-initial capital says nothing. "Mr. Hawthorne" is taken
 * whole, so a passage naming "Hawthorne" alone still satisfies it.
 */
export function properNounsIn(stem: unknown): string[] {
  const raw = String(stem ?? '')
  if (!raw.trim()) return []

  // A QUOTED span is the item, not a reference to the passage.
  //
  // ESL usage questions carry their own example: "Match each pronoun to what
  // it refers back to in the sentence: 'Sarah went to the library because she
  // was late.'" Sarah is not in the reading text and is not supposed to be —
  // she is the exercise. Counting her deleted four good grammar questions off
  // a Reading and Usage paper, which is the one paper that is half grammar.
  const text = raw.replace(/["'‘’“”][^"'‘’“”]{8,}["'‘’“”]/g, ' ')

  const found: string[] = []
  // Split into sentences — but NOT on the full stop in "Mr.", which split
  // "What did Mr. Hawthorne say?" in two and left the name stranded as the
  // first word of the second half, where it was then skipped.
  const sentences = text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|Prof|St|Sr|Jr|Capt)\.)(?<=[.!?])\s+/)
  for (const sentence of sentences) {
    const words = sentence.trim().split(/\s+/)
    // The first word IS considered.
    //
    // Skipping it was the safe-looking choice and it missed the exact stem
    // that shipped: "Clara stumbled upon an ancient oak tree, what was hidden
    // within its trunk?" — the whole invented story is the first word. A
    // sentence-initial capital is weak evidence on its own, which is what
    // NOT_A_NAME is for; and this only ever runs on a paper that HAS a
    // passage, where an ordinary capitalised word ("Water", "Iron") is almost
    // always in the passage too and so is never reported absent.
    for (let i = 0; i < words.length; i++) {
      const raw = words[i]
      const bare = raw.replace(/^[^A-Za-z]+|[^A-Za-z.]+$/g, '')
      if (!bare || !/^[A-Z]/.test(bare)) continue
      if (NOT_A_NAME.has(bare.toLowerCase().replace(/\.$/, ''))) continue
      // A title takes the word after it as one name.
      if (TITLE.test(bare) && words[i + 1]) {
        const next = words[i + 1].replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, '')
        if (next && /^[A-Z]/.test(next)) {
          if (!found.includes(next)) found.push(next)
          i++
          continue
        }
      }
      // Strip punctuation off BOTH ends before deciding.
      //
      // "...a question starting with 'Who'." left the token as `Who'`, which
      // is not in NOT_A_NAME however plainly it is not a person, so a good
      // grammar question was deleted for naming a character called Who.
      const clean = bare.replace(/[^A-Za-z]+$/, '').replace(/^[^A-Za-z]+/, '')
      if (clean.length < 2) continue
      if (NOT_A_NAME.has(clean.toLowerCase())) continue
      if (!found.includes(clean)) found.push(clean)
    }
  }
  return found
}

/**
 * Which names in this question do not appear in the passage?
 *
 * An empty passage means every one of them is absent, which is the exact case
 * that shipped: comprehension questions with no text at all.
 */
export function namesAbsentFromPassage(stem: unknown, passage: unknown): string[] {
  const names = properNounsIn(stem)
  if (names.length === 0) return []

  const text = String(passage ?? '')
  if (!text.trim()) return names

  // Possessives are the same name. "Gandalf's" was reported absent from a
  // passage that says "Gandalf" on every other line, and the question was
  // deleted for it.
  const bare = (s: string) => s.toLowerCase().replace(/['’]s$/, '')
  const haystack = bare(text)
  return names.filter((n) => !haystack.includes(bare(n)))
}

/**
 * Is this question about a story nobody wrote?
 *
 * True when the question names people or places the passage does not contain.
 * The caller deletes it and the retry loop writes a replacement.
 */
export function questionInventsItsOwnText(stem: unknown, passage: unknown): boolean {
  // A composition brings its own people and is meant to. "Write an article
  // ... Aim for about 400 words." was deleted for "naming Aim", and the
  // paper's 25-mark slot went to a one-word question instead.
  if (isWritingTask(stem)) return false
  return namesAbsentFromPassage(stem, passage).length > 0
}

/**
 * Words that say nothing about WHICH text a question is about.
 *
 * A comprehension question is half meta-language -- "in paragraph B", "give a
 * word from the text", "explain what the writer implies" -- and none of that
 * tells you whether the question belongs to this passage or another one. Only
 * the subject-matter words can do that, so these are removed before counting.
 */
const META = new Set([
  'text', 'passage', 'paragraph', 'extract', 'article', 'story', 'line',
  'word', 'words', 'phrase', 'sentence', 'sentences', 'quotation', 'quote',
  'author', 'writer', 'narrator', 'reader', 'evidence', 'meaning', 'means',
  'answer', 'answers', 'question', 'example', 'reason', 'reasons', 'idea',
  'give', 'write', 'down', 'name', 'state', 'explain', 'describe', 'identify',
  'suggest', 'choose', 'select', 'find', 'using', 'used', 'show', 'tick',
  'complete', 'match', 'think', 'from', 'about', 'that', 'this', 'these',
  'those', 'what', 'which', 'where', 'when', 'does', 'said', 'says', 'with',
  'your', 'their', 'there', 'here', 'would', 'could', 'should', 'will',
  'implies', 'implied', 'imply', 'support', 'supports', 'refer', 'refers',
  'best', 'most', 'more', 'than', 'also', 'into', 'onto', 'over', 'under',
  'first', 'second', 'third', 'last', 'next', 'other', 'another', 'each',
  'both', 'some', 'many', 'much', 'very', 'like', 'make', 'makes', 'made',
  // Structure and grammar vocabulary, which is the other half of an ESL
  // Reading and Usage paper. Without these, "Write the heading that best
  // matches paragraph B", "What is the main purpose of paragraph F" and
  // "Identify the comparative form of the adjective" all read as questions
  // about some other text -- seventeen of forty on a live ESL paper.
  'heading', 'headings', 'purpose', 'main', 'title', 'form', 'forms',
  'verb', 'verbs', 'noun', 'nouns', 'adjective', 'adjectives', 'adverb',
  'adverbs', 'pronoun', 'pronouns', 'plural', 'singular', 'comparative',
  'superlative', 'tense', 'connective', 'connectives', 'conjunction',
  'preposition', 'synonym', 'antonym', 'prefix', 'suffix', 'punctuation',
  'apostrophe', 'comma', 'capital', 'spelling', 'grammar', 'context',
  'statement', 'statements', 'correct', 'right', 'wrong', 'true', 'false',
  'ring', 'around', 'draw', 'circle', 'underline', 'blank', 'gap', 'box',
  // Writer's-craft vocabulary. "Explain how the choice of speech verbs
  // affects the portrayal of characters" is about the passage in the terms a
  // literature question uses, and shares none of the passage's own words.
  'choice', 'choices', 'speech', 'portrayal', 'portray', 'portrays', 'character',
  'characters', 'technique', 'techniques', 'language', 'tone', 'mood',
  'atmosphere', 'imagery', 'simile', 'similes', 'metaphor', 'metaphors',
  'structure', 'effect', 'effects', 'dialogue', 'description', 'describes',
  'develops', 'develop', 'across', 'idea', 'ideas', 'theme', 'themes',
  'feeling', 'feelings', 'emotion', 'emotions', 'shows', 'suggests',
  'creates', 'create', 'presented', 'presents', 'viewpoint', 'perspective',
  // More of the same, each from a good question dropped on a live paper.
  'varying', 'vary', 'length', 'pacing', 'pace', 'affect', 'affects',
  'reveal', 'reveals', 'developed', 'throughout', 'trace', 'happened',
  'event', 'events', 'agrees', 'subject', 'reaction', 'purpose', 'author',
  'list', 'order', 'opinion', 'fact', 'summary',
])

/**
 * A fill-in-the-blank exercise carries its own sentence.
 *
 * "Identify the correct verb form: 'She ___ to the store yesterday.'" is a
 * grammar item, not a comprehension one, and the store and the yesterday
 * belong to the exercise rather than to the reading text. The blank is what
 * distinguishes it from a question that merely QUOTES the passage -- "What
 * does the label 'Room temperature Tw = 20 C' imply?" has a quotation and no
 * blank, and is exactly the off-topic case this module exists to catch.
 */
const HAS_A_BLANK = /_{2,}|\.{4,}|\[\s*\]|\(\s*\)/

/** Subject-matter words a question is actually about. */
function subjectWords(text: string): string[] {
  return [
    ...new Set(
      text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 3 && !META.has(w)),
    ),
  ]
}

/**
 * Tasks that are not ABOUT the passage and are not supposed to be.
 *
 * A Cambridge English paper ends on a composition -- "Write a letter to a
 * friend explaining why you enjoyed a recent stage performance" -- which
 * shares nothing with the reading text by design. Counting those would delete
 * the highest-mark question on the paper.
 *
 * At the start of ANY sentence, not just the first: real tasks often set the
 * scene -- "Your school is holding a competition. Write an article ..." --
 * and "Write a short story" is as much a task as "Write a story". Still a
 * sentence start, so "why does the writer write a letter to her aunt?" is a
 * comprehension question and stays one. The one mid-sentence form is the
 * task handed to the learner: "You have been asked to write an article".
 */
const WRITING_TASK =
  /(?:^|[.!?]["'”’]?\s+|\b(?:asked|invited|chosen)\s+to\s+)write\s+(?:a|an|your|the)\s+(?:set\s+of\s+|(?:(?!(?:of|from|in|about|for|on|with|to)\b)[\w'-]+\s+){0,2})(?:letter|story|article|report|description|account|review|speech|talk|email|diary|blog|poem|leaflet|essay|narrative|newspaper|instructions|guide|script|recount|profile|biography|advertisement|advert|brochure|invitation|postcard|proposal|paragraph(?!\s+(?:letter|number)))\b/i

/** Is this a composition task rather than a question about the text? */
export function isWritingTask(stem: unknown): boolean {
  return WRITING_TASK.test(String(stem ?? '').trim())
}

/** A stem that says the quotation it carries comes from the reading text. */
const CLAIMS_THE_TEXT =
  /\b(?:the\s+(?:text|passage|extract|article|story)|in\s+paragraph\s+[A-Z]|the\s+writer|the\s+author)\b/i

/**
 * A question that quotes the passage, and quotes something that is not in it.
 *
 * This is the precise half of the test, and it is worth having on its own
 * because the word-overlap half below is weak in both directions: an ESL
 * grammar item shares nothing with the passage and is fine, while
 *
 *   "What does the label 'Room temperature Tw = 20 C' imply about the
 *    environment?"
 *
 * shares the word "room" with a passage about a library and so passes. Live
 * ESL papers carried:
 *
 *   "Find the information stated directly in the text: 'The capital of
 *    France is Paris.'"
 *   "Work out the meaning the text implies: 'He was not happy with the
 *    outcome, but he said nothing.'"
 *
 * Both say "the text" and then quote a sentence the text does not contain.
 * A learner told to find it directly in the text will not find it.
 *
 * Fifteen characters minimum, so a one-word quotation -- "what does
 * 'gnarled' mean" -- is not treated as a claim about a sentence.
 */
function quotesAbsentText(stem: string, passage: string): boolean {
  if (!CLAIMS_THE_TEXT.test(stem)) return false
  // Compared as WORDS, with punctuation gone from both sides.
  //
  // Character-exact matching called a quotation absent over a curly
  // apostrophe against a straight one, or a single word paraphrased, and on
  // a live ESL run it dropped twelve good questions that way -- "why the
  // writer chose the word 'ignited' to describe Lyra's fascination", "the
  // writer's purpose in describing Elara's fall from the tree". The fault
  // this exists for is a quotation that is not in the text AT ALL: "The
  // capital of France is Paris" on a story about a library shares one word
  // of four with it.
  const words = (s: string) =>
    s.toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z0-9' ]+/g, ' ').replace(/'/g, '').split(/\s+/).filter(Boolean)
  const hay = ` ${words(passage).join(' ')} `
  const vocab = new Set(words(passage))
  // An apostrophe between two letters is part of a word, not a quotation
  // mark: "the writer's attitude towards Elara's adventure" read as a quote of
  // "s attitude towards Elara", absent from the text, and was dropped four
  // times on one English paper.
  const unquoted = stem.replace(/([A-Za-z])['’]([A-Za-z])/g, '$1$2')
  const quotes = [...unquoted.matchAll(/["'“”‘’]([^"'“”‘’]{15,})["'“”‘’]/g)].map((m) => m[1])
  if (quotes.length === 0) return false
  return quotes.some((q) => {
    // A blank in the quotation means it is an exercise, not a citation.
    if (/_{2,}/.test(q)) return false
    const w = words(q)
    if (w.length === 0) return false
    if (hay.includes(` ${w.join(' ')} `)) return false
    // Nearly every word present is a paraphrase of the text, not an invention.
    const present = w.filter((x) => vocab.has(x)).length
    return present / w.length < 0.8
  })
}

/**
 * Is this question about some other text entirely?
 *
 * Shipped, on a Cambridge English paper whose passage is about a girl named
 * Mira in the city of Eldoria:
 *
 *   "Explain the meaning implied by the warning sign for laser radiation."
 *   "Using evidence from the text, explain why the boy is writing a letter."
 *   "What does the label 'Room temperature Tw = 20 C' imply about the
 *    environment?"
 *
 * There is no warning sign, no boy and no thermometer anywhere in the passage
 * or on the page. These are questions written for a FIGURE -- a safety sign,
 * a physics diagram -- which was then correctly refused, because an English
 * paper takes no textbook illustrations. The figure went and the question
 * stayed, and none of them say "the diagram", so the dangling-reference guard
 * could not see them either.
 *
 * Measured on subject-matter words: a question about this passage shares at
 * least one with it. Sharing NONE is the signal, which is deliberately the
 * strongest possible form of the test -- one word in common is enough to pass.
 */
export function questionIsOffPassage(stem: unknown, passage: unknown): boolean {
  return offPassageStrength(stem, passage) !== null
}

/**
 * How sure we are that a question belongs to some other text.
 *
 *   'certain'  it says "the text" and quotes something the text does not
 *              contain -- a learner told to find it will not find it.
 *   'likely'   it shares no subject-matter word with the passage.
 *   null       no reason to think so.
 *
 * The two are kept apart because they are not equally reliable. Measured on a
 * live English paper, the word-overlap signal was right about "the priest's
 * role in the wedding ceremony" on a story with no wedding, and wrong about
 * "How does varying sentence length affect the pacing of the story?" and
 * "Draw a ring around the event that happened first in paragraph B" --
 * literature questions use words the passage does not, and roughly half its
 * drops were good questions. Each of those pushed the paper towards "Failed
 * to generate 17 questions", which is worse than any single question. So the
 * caller drops a 'certain' one and only sets a 'likely' one aside.
 */
export function offPassageStrength(
  stem: unknown,
  passage: unknown,
  /**
   * A table's rows, a tick list's statements, an MCQ's options. Counted for
   * shared words only: "Complete the table to show whether each statement is
   * true or not" says nothing about any passage, and its rows say everything.
   * Never searched for a quotation -- a false statement on a tick list is
   * SUPPOSED to be something the text does not say.
   */
  answers?: readonly unknown[],
): 'certain' | 'likely' | null {
  const text = String(stem ?? '').trim()
  const source = String(passage ?? '')
  if (!text || !source.trim()) return null
  if (isWritingTask(text)) return null
  if (quotesAbsentText(text, source)) return 'certain'
  const rows = (answers ?? []).filter((a): a is string => typeof a === 'string')
  return sharesNothingWithPassage([text, ...rows].join(' '), source) ? 'likely' : null
}

/**
 * "artifacts" in the text and "artifact" in the question are one word. The
 * same crude cut on both sides, so it can only ever find MORE in common --
 * which is the safe direction for a check that sets questions aside.
 */
function singular(w: string): string {
  return w.replace(/(?:es|s)$/, '')
}

function sharesNothingWithPassage(text: string, source: string): boolean {
  if (HAS_A_BLANK.test(text)) return false
  // An exercise that brings its own sentence and does not claim the passage
  // wrote it. "Rewrite the following reported speech into direct speech:
  // 'She said that...'", "Form a question using the words: 'you / to /
  // going'", "What does 'it' refer back to in the sentence: 'The cat
  // chased...'" -- all usage items, all self-contained, and all dropped by
  // the word-overlap test below on a live English paper, which then came back
  // three questions short. The claim-the-text case has already been decided
  // by `quotesAbsentText` above.
  // A quotation from a LABEL, sign or notice is not the learner's own sentence
  // -- it belongs to a figure, and "What does the label 'Room temperature Tw =
  // 20 C' imply?" on an English paper with no such figure is exactly the fault
  // this module catches. Those fall through to the overlap test.
  const quotesAFigure = /\b(?:label|labelled|sign|notice|poster|advert|advertisement|caption|diagram|chart|graph|table)\b/i.test(text)
  if (/["'“‘][^"'“”‘’]{8,}["'”’]/.test(text) && !CLAIMS_THE_TEXT.test(text) && !quotesAFigure) return false

  const asked = subjectWords(text)
  // Too little to judge on. A three-word stem with no subject words is
  // somebody else's problem, not this one's.
  if (asked.length < 2) return false

  const inPassage = new Set(subjectWords(source).map(singular))
  return !asked.some((w) => inPassage.has(singular(w)))
}

/**
 * Characters and places that belong to somebody else.
 *
 * The passage prompt used to end "...or author/title if using a real text",
 * which is an invitation, and it was taken: a Cambridge ESL reading paper came
 * back as Bilbo Baggins, Gandalf and Smaug in the Shire. An exam board cannot
 * print someone else's story and neither can this — quite apart from a
 * comprehension text that half the class has already read.
 *
 * Deliberately distinctive names only. "Matilda" and "Charlie" are Dahl
 * characters and also two of the commonest names in a classroom, and refusing
 * a passage for using them would cost more than it saves.
 */
const BORROWED = [
  'bilbo', 'frodo', 'gandalf', 'smaug', 'sauron', 'hobbiton', 'middle-earth',
  'rivendell', 'mordor', 'gollum', 'aragorn', 'legolas',
  'hogwarts', 'hermione', 'dumbledore', 'voldemort', 'gryffindor', 'slytherin',
  'hufflepuff', 'ravenclaw', 'quidditch', 'muggle', 'harry potter',
  'narnia', 'aslan', 'katniss', 'panem', 'hunger games',
  'percy jackson', 'sherlock holmes', 'willy wonka', 'oompa loompa',
  'darth vader', 'skywalker', 'jedi', 'pokemon', 'pikachu', 'minecraft',
  'spider-man', 'spiderman', 'batman', 'superman', 'wakanda', 'hogsmeade',
  'winterfell', 'westeros', 'dothraki', 'gotham', 'asgard',
]

/** The borrowed name this passage uses, or '' when it is original. */
export function passageBorrowsAKnownWork(passage: unknown): string {
  const text = String(passage ?? '').toLowerCase()
  if (!text.trim()) return ''
  for (const name of BORROWED) {
    // Word-boundary matched, so "asgard" does not fire on "Asgardian Road"
    // being a street somebody invented, and "jedi" not on a surname.
    //
    // String.raw, not a plain template literal: `\b` inside one is the
    // BACKSPACE escape, U+0008, not a word boundary — so the pattern became
    // <BS>bilbo<BS> and matched nothing, silently. The file itself is clean,
    // which is why the control-byte guard could not see it; the corruption
    // only exists at runtime.
    const pattern = String.raw`\b` + name.replace(/-/g, '[- ]') + String.raw`\b`
    if (new RegExp(pattern, 'i').test(text)) return name
  }
  return ''
}
