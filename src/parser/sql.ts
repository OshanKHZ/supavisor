import { parse } from 'libpg-query'
import type { ParsedStatement } from '../core/types.js'

interface PgParseResult {
  stmts?: Array<{
    stmt: Record<string, any>
    stmt_location?: number
    stmt_len?: number
  }>
}

export async function parseSQL(source: string): Promise<ParsedStatement[]> {
  const result = (await parse(source)) as PgParseResult
  if (!result.stmts) return []

  return result.stmts
    .filter(stmt => stmt.stmt)
    .map(stmt => {
      const node = stmt.stmt
      const type = Object.keys(node)[0]
      const line = stmt.stmt_location ? source.slice(0, stmt.stmt_location).split('\n').length : 1
      const raw = stmt.stmt_len
        ? source.slice(stmt.stmt_location ?? 0, (stmt.stmt_location ?? 0) + stmt.stmt_len)
        : source

      return { type, node: node[type], raw, line }
    })
}
