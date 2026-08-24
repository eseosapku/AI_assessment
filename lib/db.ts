import { Pool, QueryResult, QueryResultRow } from 'pg'

declare global {
  // eslint-disable-next-line no-var
  var __brainInkPgPool: Pool | undefined
}

function resolveSsl() {
  const disableSsl = process.env.PG_DISABLE_SSL === 'true'
  if (disableSsl) return false
  return { rejectUnauthorized: false }
}

function createPool() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL is required for RDS/Postgres access')
  }

  return new Pool({
    connectionString,
    ssl: resolveSsl(),
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  })
}

function getPool() {
  if (global.__brainInkPgPool) return global.__brainInkPgPool
  const pool = createPool()
  global.__brainInkPgPool = pool
  return pool
}

export const db = {
  query: <T extends QueryResultRow = any>(text: string, values?: unknown[]): Promise<QueryResult<T>> =>
    getPool().query<T>(text, values),
}

/**
 * The narrow surface the query helpers actually use.
 *
 * Exported so a caller can be handed a stub in a test without reaching for a
 * live pool — the metrics modules take one of these rather than importing the
 * pool directly.
 */
export type Database = Pick<typeof db, 'query'>
