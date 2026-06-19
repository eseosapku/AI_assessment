import { db } from '@/lib/db'
import { supabase } from '@/lib/supabase'

export type UserRecord = {
  id: string
  email: string | null
  password_hash: string
  name: string
  student_id: string | null
  class: string
  role?: string | null
  subjects?: string[] | null
  country?: string | null
  reset_token?: string | null
  reset_token_expires?: string | null
  [key: string]: unknown
}

export function usePostgresUsers(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim())
}

export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  if (usePostgresUsers()) {
    const result = await db.query('SELECT * FROM users WHERE email = $1 LIMIT 1', [email])
    return (result.rows[0] as UserRecord) ?? null
  }
  const { data, error } = await supabase.from('users').select('*').eq('email', email).maybeSingle()
  if (error) throw error
  return (data as UserRecord | null) ?? null
}

export async function findUserByStudentId(studentId: string): Promise<UserRecord | null> {
  if (usePostgresUsers()) {
    const result = await db.query('SELECT * FROM users WHERE student_id = $1 LIMIT 1', [studentId])
    return (result.rows[0] as UserRecord) ?? null
  }
  const { data, error } = await supabase.from('users').select('*').eq('student_id', studentId).maybeSingle()
  if (error) throw error
  return (data as UserRecord | null) ?? null
}

export async function findUserById(userId: string): Promise<UserRecord | null> {
  if (usePostgresUsers()) {
    const result = await db.query('SELECT * FROM users WHERE id = $1 LIMIT 1', [userId])
    return (result.rows[0] as UserRecord) ?? null
  }
  const { data, error } = await supabase.from('users').select('*').eq('id', userId).maybeSingle()
  if (error) throw error
  return (data as UserRecord | null) ?? null
}

export async function findUserByResetToken(token: string): Promise<UserRecord | null> {
  if (usePostgresUsers()) {
    const result = await db.query(
      'SELECT id, reset_token, reset_token_expires FROM users WHERE reset_token = $1 LIMIT 1',
      [token],
    )
    return (result.rows[0] as UserRecord) ?? null
  }
  const { data, error } = await supabase
    .from('users')
    .select('id, reset_token, reset_token_expires')
    .eq('reset_token', token)
    .maybeSingle()
  if (error) throw error
  return (data as UserRecord | null) ?? null
}

export async function emailExists(email: string): Promise<boolean> {
  const user = await findUserByEmail(email)
  return Boolean(user)
}

export async function studentIdExists(studentId: string): Promise<boolean> {
  const user = await findUserByStudentId(studentId)
  return Boolean(user)
}

export async function createUser(payload: {
  email: string | null
  password_hash: string
  name: string
  student_id: string
  class: string
  role: string
  subjects: string[]
  country?: string | null
}): Promise<UserRecord> {
  if (usePostgresUsers()) {
    const result = await db.query(
      `INSERT INTO users (email, password_hash, name, student_id, class, role, subjects, country)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, name, email, student_id, class, subjects, role, country`,
      [
        payload.email,
        payload.password_hash,
        payload.name,
        payload.student_id,
        payload.class,
        payload.role,
        payload.subjects,
        payload.country ?? null,
      ],
    )
    const row = result.rows[0] as UserRecord | undefined
    if (!row) throw new Error('Failed to create user')
    return row
  }

  const { data, error } = await supabase
    .from('users')
    .insert(payload)
    .select('id, name, email, student_id, class, subjects, role, country')
    .single()
  if (error || !data) throw error ?? new Error('Failed to create user')
  return data as UserRecord
}

export async function updateUserById(
  userId: string,
  payload: Record<string, unknown>,
): Promise<UserRecord | null> {
  if (usePostgresUsers()) {
    const columnMap: Record<string, string> = {
      name: 'name',
      class: 'class',
      subjects: 'subjects',
      country: 'country',
      password_hash: 'password_hash',
      reset_token: 'reset_token',
      reset_token_expires: 'reset_token_expires',
    }

    const setClauses: string[] = []
    const values: unknown[] = [userId]
    let paramIndex = 2

    for (const [key, value] of Object.entries(payload)) {
      const column = columnMap[key]
      if (!column) continue
      setClauses.push(`${column} = $${paramIndex}`)
      values.push(value)
      paramIndex += 1
    }

    if (!setClauses.length) return findUserById(userId)

    setClauses.push('updated_at = NOW()')

    const result = await db.query(
      `UPDATE users
       SET ${setClauses.join(', ')}
       WHERE id = $1
       RETURNING id, name, email, student_id, class, subjects, role, country`,
      values,
    )
    return (result.rows[0] as UserRecord) ?? null
  }

  const { data, error } = await supabase
    .from('users')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select('id, name, email, student_id, class, subjects, role, country')
    .maybeSingle()
  if (error) throw error
  return (data as UserRecord | null) ?? null
}
