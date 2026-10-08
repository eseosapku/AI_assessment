import { describe, expect, it } from 'vitest'
import { friendlyTutorError } from './tutorErrors'

describe('what a student reads when the tutor call fails', () => {
  it('says the tutor took too long, not "AbortError"', () => {
    expect(friendlyTutorError({ thrown: Object.assign(new Error('The user aborted a request.'), { name: 'AbortError' }) }))
      .toMatch(/taking too long/i)
  })
  it('says the tutor took too long when the server ran out of time', () => {
    // A 504 is the route's own deadline, or the gateway's HTML page at 30 s.
    expect(friendlyTutorError({ status: 504 })).toMatch(/taking too long/i)
  })
  it('says to check the connection when the request never got through', () => {
    expect(friendlyTutorError({ thrown: new TypeError('Failed to fetch') })).toMatch(/connection/i)
  })
  it('never shows a parse error from an HTML error page', () => {
    // A gateway timeout answers with HTML; res.json() threw, and the student
    // read "Unexpected token '<'".
    const msg = friendlyTutorError({ thrown: new SyntaxError("Unexpected token '<', \"<!DOCTYPE \"... is not valid JSON") })
    expect(msg).not.toMatch(/token|JSON|DOCTYPE/)
  })
  it("passes on the server's own words for a limit or a paywall", () => {
    expect(friendlyTutorError({ status: 429, bodyError: 'You have made a lot of requests. Please wait a little and try again.' }))
      .toMatch(/a lot of requests/)
    expect(friendlyTutorError({ status: 402, bodyError: 'Your plan has ended.' })).toBe('Your plan has ended.')
  })
  it('keeps raw server errors from a crash to itself', () => {
    expect(friendlyTutorError({ status: 500, bodyError: 'relation "x" does not exist' })).not.toMatch(/relation/)
    expect(friendlyTutorError({ status: 502 })).toMatch(/went wrong/i)
  })
  it('says a lesson that is not theirs is not available', () => {
    expect(friendlyTutorError({ status: 404, bodyError: 'Lesson not found' })).toMatch(/not available/i)
  })
})
