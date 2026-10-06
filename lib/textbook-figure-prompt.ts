/**
 * One quiz question about one textbook figure, in its own short prompt.
 *
 * The general quiz prompt runs to 17,000 characters, and a figure handed to it
 * is one line among hundreds. Nova Lite follows a short prompt far better --
 * the Checkpoint paper's per-question prompt proved it -- so a figure question
 * gets one of its own, carrying what the figure shows, the words printed on
 * it, and the book's own exercise about it as the model.
 */
export type FigureQuestionKind = 'mcq' | 'short' | 'written'

export interface TextbookFigurePromptOptions {
  subject: string
  /** "Stage 8", "Grade 5" -- who is answering. */
  level: string
  topic: string
  id: number
  kind: FigureQuestionKind
  /** For a written answer: 2 or 3. */
  marks?: number
  figure: { noun: string; shows: string; labels: readonly string[]; original: string }
}

function schema(o: TextbookFigurePromptOptions): string {
  if (o.kind === 'mcq') {
    return `{"id": ${o.id}, "type": "mcq", "question": "...", "options": ["...", "...", "...", "..."], "correct_answer": <0-3>, "explanation": "40-80 words: why the right option is right and each other one is wrong"}
Exactly ONE option is correct. The other three are what a learner with a common misconception would choose. The options never repeat the question.`
  }
  if (o.kind === 'short') {
    return `{"id": ${o.id}, "type": "longform", "question": "...", "marks": 1, "short_answer": {"accepted": ["every acceptable form of the answer"]}, "explanation": "30-60 words, to the learner: what the answer is and how the ${o.figure.noun} shows it"}
The answer is one word, a short phrase or a number. Ask ONE thing.`
  }
  const marks = Math.max(2, Math.min(3, o.marks ?? 2))
  return `{"id": ${o.id}, "type": "longform", "question": "...", "marks": ${marks}, "marking_criteria": [${marks} criteria, one per mark, each a point the answer must make], "model_answer": "a full-mark answer in 2-4 sentences", "explanation": "30-60 words, to the learner: what a strong answer must include"}
It is worth ${marks} marks, so it asks for ${marks} separate points or steps -- never one word.`
}

export function buildTextbookFigurePrompt(o: TextbookFigurePromptOptions): string {
  const f = o.figure
  // Marks off the model exercise: shown "[1]", the writer matched it, and
  // wrote one-word answers into two-mark questions (see exam-paper-prompt.ts).
  const original = f.original.trim().slice(0, 700).replace(/\s*\[\d+\]/g, '')
  return [
    `Write ONE question for a ${o.subject} quiz, answered by a learner at ${o.level}.`,
    `Topic: ${o.topic}.`,
    '',
    `Printed beside the question is a ${f.noun} from the learner's textbook. It shows: ${f.shows}`,
    ...(f.labels.length ? [`The words and numbers printed on it: ${f.labels.join(', ')}.`] : []),
    // Many of the Rwanda books' figures sit on a page with no exercise about
    // them; an empty model invites a question about nothing.
    ...(original
      ? [
          `The textbook asks about it like this:`,
          '"""',
          original,
          '"""',
          `That is a model, not text to reuse. The new question is about the same ${f.noun}, in your own words: it asks about something the ${f.noun} shows, keeps every label and value exactly as printed, and is answered by looking at it and knowing the ${o.subject}.`,
        ]
      : [`The textbook prints it without an exercise. The question is about the ${f.noun}: it asks about something the ${f.noun} shows, keeps every label and value exactly as printed, and is answered by looking at it and knowing the ${o.subject}.`]),
    `A word printed on the ${f.noun} is never the answer. The learner answers on screen and cannot draw on it, join things with lines, or fill it in.`,
    // "How many keys are visible on the laptop's keyboard?" and "How many
    // edges does the smartphone have?" -- asked about photographs in a
    // Computing quiz. Answerable, and nothing to do with the subject.
    `Ask what a learner of ${o.subject} at this level would be asked about it: what it is, what it shows, what it is for, what would happen, or a value read from it. Never trivia such as counting keys, edges or buttons on a photograph.`,
    `Begin with "Look at the ${f.noun}." or one short sentence that sets it up. Keep the question under 30 words.`,
    '',
    'Return ONLY JSON: {"questions": [ one object ]}, shaped like this:',
    schema(o),
  ].join('\n')
}
