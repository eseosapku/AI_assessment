import { describe, expect, it } from 'vitest'
import { mapAuthUser } from './auth-user'

describe('mapAuthUser', () => {
  it('treats missing profile_complete as complete so existing accounts keep working', () => {
    const user = mapAuthUser({
      id: '1',
      name: 'Ada',
      email: null,
      student_id: 'STD-1',
      class: 'S3',
      subjects: [],
      role: 'student',
      country: 'RW',
    })
    expect(user.profileComplete).toBe(true)
    expect(user.email).toBeNull()
  })

  it('marks Google-first users incomplete until they finish setup', () => {
    const user = mapAuthUser({
      id: '2',
      name: 'Ada',
      email: 'ada@gmail.com',
      student_id: 'STD-2',
      class: 'Pending',
      subjects: [],
      role: 'student',
      country: 'RW',
      profile_complete: false,
    })
    expect(user.profileComplete).toBe(false)
  })
})
