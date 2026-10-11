// scripts/figure-library/node-sqlite.d.ts
// The parts of node:sqlite the figure library uses. @types/node is 20.x here
// and has no node:sqlite types; delete this file once it is 22 or later.
declare module 'node:sqlite' {
  type SQLValue = null | number | bigint | string | Uint8Array
  interface StatementSync {
    run(...params: SQLValue[]): { changes: number | bigint; lastInsertRowid: number | bigint }
    get(...params: SQLValue[]): unknown
    all(...params: SQLValue[]): unknown[]
  }
  class DatabaseSync {
    constructor(path: string, options?: { open?: boolean; readOnly?: boolean })
    exec(sql: string): void
    prepare(sql: string): StatementSync
    close(): void
  }
}
