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

  /**
   * Queries the database itself abandons after `ms`.
   *
   * For an optional lookup with a deadline (the figure library's sample): a caller that stops
   * waiting still leaves its query running on the server, holding a connection. SET LOCAL lasts
   * only for this transaction, so the pooled connection goes back unchanged.
   */
  withStatementTimeout: async <R>(
    ms: number,
    fn: (query: <T extends QueryResultRow = any>(text: string, values?: unknown[]) => Promise<QueryResult<T>>) => Promise<R>,
  ): Promise<R> => {
    const client = await getPool().connect()
    try {
      await client.query('BEGIN')
      await client.query(`SET LOCAL statement_timeout = ${Math.max(1, Math.floor(ms))}`)
      const result = await fn((text, values) => client.query(text, values))
      await client.query('COMMIT')
      return result
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {})
      throw err
    } finally {
      client.release()
    }
  },
}

/**
 * The narrow surface the query helpers actually use.
 *
 * Exported so a caller can be handed a stub in a test without reaching for a
 * live pool — the metrics modules take one of these rather than importing the
 * pool directly.
 */
export type Database = Pick<typeof db, 'query'>
