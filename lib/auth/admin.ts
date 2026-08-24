import { NextResponse, type NextRequest } from 'next/server'
import { createHash } from 'crypto'
import { db as defaultDb, type Database } from '@/lib/db'

/**
 * The gate on the admin area.
 *
 * The dashboard behind this reports the whole platform — every student's
 * scores, every school's spend — so it is guarded server-side on every request
 * rather than by hiding a link. A role claim carried by the client is not
 * evidence: the token is looked up in `user_sessions` and the role is read from
 * the row it belongs to, so revoking a session or demoting a user takes effect
 * on the next request rather than whenever their browser next reloads.
 *
 * Tokens are stored hashed. A leaked database dump should not hand over live
 * sessions, so the incoming token is hashed and the hash is what gets matched.
 */

export const ADMIN_SESSION_COOKIE = 'ss_session'

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/** Bearer header first, then the cookie, so an API client and a browser both work. */
export function tokenFromRequest(request: NextRequest): string | null {
  const header = request.headers.get('authorization') ?? ''
  const bearer = header.match(/^Bearer\s+(.+)$/i)?.[1]?.trim()
  if (bearer) return bearer
  const cookie = request.cookies.get(ADMIN_SESSION_COOKIE)?.value?.trim()
  return cookie || null
}

export interface AdminIdentity {
  userId: string
  email: string | null
  name: string | null
}

export type AdminAuthorization =
  | { ok: true; admin: AdminIdentity }
  | { ok: false; response: NextResponse }

function deny(status: number, error: string): AdminAuthorization {
  // Deliberately vague: distinguishing "no session" from "not an admin" tells an
  // attacker which half they got right.
  return { ok: false, response: NextResponse.json({ error }, { status }) }
}

/**
 * The identity model the rest of this app actually uses.
 *
 * Nothing issues session tokens yet — `user_sessions` exists but login does not
 * write to it — and every other route here identifies its caller by a `user_id`
 * carried on the request. Rejecting that would leave the admin area unreachable
 * by anyone, so it is accepted, and the role is still read from the database
 * rather than believed from the client.
 *
 * This is the weaker of the two paths: a user id is a bearer credential that
 * does not expire and cannot be revoked. It stays only until login issues real
 * sessions, at which point the token path above should become the only one.
 */
async function adminByUserId(
  request: NextRequest,
  database: Database,
): Promise<AdminAuthorization | null> {
  const userId = request.nextUrl.searchParams.get('user_id')?.trim()
  if (!userId || !UUID_RE.test(userId)) return null

  const { rows } = await database.query(
    `SELECT id, email, name FROM users WHERE id = $1 AND role = 'platform_admin' LIMIT 1`,
    [userId],
  )
  const row = rows[0]
  if (!row) return null
  return {
    ok: true,
    admin: {
      userId: String(row.id),
      email: row.email ? String(row.email) : null,
      name: row.name ? String(row.name) : null,
    },
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function requirePlatformAdmin(
  request: NextRequest,
  database: Database = defaultDb,
): Promise<AdminAuthorization> {
  const token = tokenFromRequest(request)
  if (!token) {
    try {
      const byId = await adminByUserId(request, database)
      if (byId) return byId
    } catch (error) {
      console.error('Admin authorization failed:', (error as Error)?.message ?? error)
      return deny(500, 'Could not verify your session')
    }
    return deny(401, 'Sign in as a platform administrator to view this dashboard')
  }

  try {
    const { rows } = await database.query(
      `SELECT u.id, u.email, u.name
         FROM user_sessions s
         JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = $1
          AND s.revoked_at IS NULL
          AND s.expires_at > NOW()
          AND u.role = 'platform_admin'
        LIMIT 1`,
      [hashToken(token)],
    )
    const row = rows[0]
    if (!row) return deny(403, 'This area is limited to platform administrators')

    // Best-effort: knowing a session is live matters more than recording that it
    // was seen, so a failure here must not cost the request.
    database
      .query(`UPDATE user_sessions SET last_seen_at = NOW() WHERE token_hash = $1`, [hashToken(token)])
      .catch(() => {})

    return {
      ok: true,
      admin: {
        userId: String(row.id),
        email: row.email ? String(row.email) : null,
        name: row.name ? String(row.name) : null,
      },
    }
  } catch (error) {
    console.error('Admin authorization failed:', (error as Error)?.message ?? error)
    return deny(500, 'Could not verify your session')
  }
}
