import { describe, expect, it } from 'vitest'
import {
  isLazyChoiceQuestion,
  isWorkedProblemQuestion,
  sourceNeedsWorkedProblems,
  workedProblemRules,
  workedProblemTarget,
} from './worked-problems'

const EIGEN = `In eigen decomposition, a matrix A is diagonalizable if it is similar to a diagonal matrix D,
where the columns of the transformation matrix P are the eigenvectors of A.
Example: find the eigenvalues of A = [[2, 1], [1, 2]].`

describe('a source the student has to solve', () => {
  it('recognises a mathematics PDF', () => {
    expect(sourceNeedsWorkedProblems(EIGEN)).toBe(true)
    expect(sourceNeedsWorkedProblems('Calculate the area of a triangle with base 8 cm and height 5 cm.')).toBe(true)
    expect(sourceNeedsWorkedProblems(
      'Singular value decomposition and LU decomposition factor a matrix. They are used for dimensionality reduction.',
    )).toBe(true)
  })

  it('leaves a reading passage alone', () => {
    expect(sourceNeedsWorkedProblems(
      'In 1960 the character left the village. In paragraph 2 the family shared a secret about the house and never returned.',
    )).toBe(false)
    expect(sourceNeedsWorkedProblems('Photosynthesis converts light into chemical energy in the chloroplast.')).toBe(false)
  })
})

describe('how many questions must be problems', () => {
  it('asks for half the paper, and at least one', () => {
    expect(workedProblemTarget(10)).toBe(5)
    expect(workedProblemTarget(1)).toBe(1)
    expect(workedProblemTarget(0)).toBe(0)
    expect(workedProblemRules(10)).toContain('5 of the 10')
    expect(workedProblemRules(10)).toContain('theory')
    expect(workedProblemRules(10)).toContain('All of the above')
  })
})

describe('a question that makes the student solve', () => {
  it('accepts a calculation that includes the data', () => {
    expect(isWorkedProblemQuestion({
      question: 'Find the determinant of A = [[4, 2], [1, 3]].',
      options: ['8', '10', '12', '14'],
    })).toBe(true)
  })

  it('keeps a decomposition the student has to carry out', () => {
    for (const question of [
      'Given the matrix A = [[4, 2], [1, 3]], find the eigenvalues of A.',
      'Perform LU decomposition on the matrix A = [[2, 1], [6, 5]].',
      'Perform QR decomposition on the matrix A = \\begin{pmatrix} 1 & 2 \\\\ 3 & 4 \\end{pmatrix}.',
      'What is the singular value decomposition (SVD) of the matrix A = \\begin{pmatrix} 1 & 0 \\\\ 0 & 2 \\end{pmatrix}?',
      'For the matrix A = [[1, 0, 1], [0, 1, 1]], perform QR decomposition.',
      'Given the matrix A = [[1, 4], [2, 3]], perform eigendecomposition.',
      'Which of the following is a correct LU decomposition of the matrix A = \\begin{pmatrix} 1 & 2 \\\\ 3 & 4 \\end{pmatrix}?',
    ]) {
      expect(isWorkedProblemQuestion({ question }), question).toBe(true)
    }
  })

  it('rejects a description and a which-statement question', () => {
    expect(isWorkedProblemQuestion({
      question: 'Describe how to use the Singular Value Decomposition (SVD) for dimensionality reduction.',
    })).toBe(false)
    expect(isWorkedProblemQuestion({
      question: 'Which of the following is a property of the determinant of a matrix?',
      options: ['It is invariant under transposition', 'It scales by λ', 'It is the sum of the diagonal', 'It is the product of the diagonal'],
    })).toBe(false)
    expect(isWorkedProblemQuestion({
      question: 'Which of the following statements about LU decomposition is correct?',
      options: ['Only non-singular matrices', 'L has 1s on the diagonal', 'Used for the determinant', 'Used to solve systems'],
    })).toBe(false)
    expect(isWorkedProblemQuestion({
      question: 'What is the geometric interpretation of the determinant of a matrix?',
    })).toBe(false)
    expect(isWorkedProblemQuestion({
      question: 'Which of the following is a correct statement about eigenvalues?',
    })).toBe(false)
    expect(isWorkedProblemQuestion({
      question: 'Which decomposition method is used for dimensionality reduction in machine learning?',
    })).toBe(false)
  })
})

describe('options that are not an answer', () => {
  it('catches all of the above and none of the above', () => {
    expect(isLazyChoiceQuestion({
      options: ['It simplifies operations.', 'It reveals structure.', 'It is efficient.', 'All of the above.'],
    })).toBe(true)
    expect(isLazyChoiceQuestion({
      options: ['2', '3', '4', '5'],
    })).toBe(false)
  })
})
