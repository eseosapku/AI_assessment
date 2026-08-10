import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isMissingColumn } from '@/lib/pg-errors'
import { checkAvatarDataUrl } from '@/lib/studio/avatar-validate'

/**
 * Profile photo storage.
 *
 * Photos used to live only in the browser's localStorage, so one set on a phone
 * never appeared on a laptop and vanished with site data. The user record is
 * now the source of truth; the client keeps a local copy purely as a cache.
 *
 * Every handler degrades to a no-op when `avatar_url` is absent
 * (migrations/add-user-avatar.sql not yet applied). The alternative — 500s on
 * every settings page and login — would break the app for all users until the
 * migration ran, which is the same trap the learnspace `mode` column set.
 */

/** Response used when the column isn't there yet: not an error, just nothing stored. */
const NOT_MIGRATED = { avatar: null as string | null, stored: false }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * `users.id` is a uuid column, so a malformed id makes Postgres raise
 * invalid_text_representation and the request 500s — a client mistake reported
 * as a server fault. Checking the shape first keeps it a 400.
 */
function userIdFrom(value: unknown): string {
  const id = String(value ?? '').trim()
  return UUID_RE.test(id) ? id : ''
}

export async function GET(request: NextRequest) {
  const userId = userIdFrom(request.nextUrl.searchParams.get('user_id'))
  if (!userId) {
    return NextResponse.json({ error: 'A user id is required' }, { status: 400 })
  }

  try {
    const res = await db.query('SELECT avatar_url FROM users WHERE id = $1 LIMIT 1', [userId])
    return NextResponse.json({ avatar: res.rows[0]?.avatar_url ?? null, stored: true })
  } catch (err) {
    if (isMissingColumn(err)) return NextResponse.json(NOT_MIGRATED)
    console.error('Avatar fetch failed:', err)
    return NextResponse.json({ error: 'Could not load your photo.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const userId = userIdFrom(body?.user_id)
    if (!userId) {
      return NextResponse.json({ error: 'A user id is required' }, { status: 400 })
    }

    // A null avatar means "remove my photo" — the same endpoint both ways so
    // the client has one path to keep in sync.
    const removing = body?.avatar === null
    if (!removing) {
      const check = checkAvatarDataUrl(body?.avatar)
      if (!check.ok) {
        return NextResponse.json({ error: check.reason ?? 'That image could not be used.' }, { status: 400 })
      }
    }

    const value = removing ? null : String(body.avatar).trim()
    const res = await db.query(
      'UPDATE users SET avatar_url = $2, updated_at = NOW() WHERE id = $1 RETURNING avatar_url',
      [userId, value],
    )
    if (res.rowCount === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    return NextResponse.json({ avatar: res.rows[0]?.avatar_url ?? null, stored: true })
  } catch (err) {
    if (isMissingColumn(err)) return NextResponse.json(NOT_MIGRATED)
    console.error('Avatar save failed:', err)
    return NextResponse.json({ error: 'Could not save your photo.' }, { status: 500 })
  }
}
