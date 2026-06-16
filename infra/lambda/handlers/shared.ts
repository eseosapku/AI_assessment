import { Pool } from 'pg'

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('DATABASE_URL must be set')
}

const disableSsl = process.env.PG_DISABLE_SSL === 'true'

export const db = new Pool({
  connectionString,
  ssl: disableSsl ? false : { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
})

export function json(statusCode: number, body: Record<string, unknown>) {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  }
}
