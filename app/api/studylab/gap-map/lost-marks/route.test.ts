import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const query = vi.fn()
vi.mock('@/lib/db', () => ({ db: { query: (...a: unknown[]) => query(...a) } }))

import { GET } from './route'

const USER = '11111111-1111-4111-8111-111111111111'
const get = (qs: string) => GET(new NextRequest(`http://localhost/api/studylab/gap-map/lost-marks?${qs}`))

beforeEach(() => { query.mockReset(); query.mockResolvedValue({ rows: [] }) })

describe('lost marks route', () => {
  it('refuses a bad user_id', async () => {
    expect((await get('user_id=nope&topic_id=4')).status).toBe(400)
    expect(query).not.toHaveBeenCalled()
  })
  it('refuses a bad topic_id', async () => {
    expect((await get(`user_id=${USER}&topic_id=abc`)).status).toBe(400)
  })
  it('asks for this student only', async () => {
    await get(`user_id=${USER}&topic_id=4&subtopic_ids=7,8`)
    const [sql, params] = query.mock.calls[0]
    expect(String(sql)).toContain('user_id = $1')
    expect(String(sql)).toContain('LIMIT 40')
    expect(params).toEqual([USER])
  })
  it('returns the lost marks', async () => {
    query.mockResolvedValue({ rows: [{ answers: { 0: 2 }, questions_data: [{ type: 'mcq', question: 'Q?', options: ['a', 'b', 'c'], correct_answer: 0, subtopic_id: 7, topic_id: 4 }] }] })
    const body = await (await get(`user_id=${USER}&topic_id=4&subtopic_ids=7`)).json()
    expect(body.data).toEqual([{ question: 'Q?', said: 'c', right: 'a' }])
  })
  it('hides the database message and logs it', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    query.mockRejectedValue(new Error('password authentication failed for user "secret_user"'))
    const res = await get(`user_id=${USER}&topic_id=4`)
    expect(res.status).toBe(500)
    expect(JSON.stringify(await res.json())).not.toContain('secret_user')
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })
})
