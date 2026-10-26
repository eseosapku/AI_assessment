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

  const pool = new Pool({
    connectionString,
    ssl: resolveSsl(),
    max: 20,
    // The activity ping fires every 60s. An idle limit under that closed the
    // socket in between, and the next ping opened a fresh TLS connection to
    // RDS. That handshake often takes longer than 10s from here, and the
    // attempt was then destroyed: "Connection terminated due to connection
    // timeout". Keep the socket, and give a cold connect time to finish.
    idleTimeoutMillis: 120_000,
    connectionTimeoutMillis: 20_000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10_000,
  })
  // A socket that dies while idle emits 'error'. With no listener the process
  // crashes, and the next request inherits a pool that cannot connect.
  pool.on('error', (error) => {
    console.error('Postgres pool error:', error.message)
  })
  return pool
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
