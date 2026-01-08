import type { Rule } from '../../core/types.js'
import { getTableName } from '../../parser/index.js'

export const noTableWithoutPk: Rule = {
  meta: {
    id: 'no-table-without-pk',
    name: 'No Table Without Primary Key',
    description: 'Tables should have a primary key for performance and data integrity',
    severity: 'error',
    category: 'performance',
    docs: 'https://supabase.com/docs/guides/database/database-linter?lint=0004_no_primary_key',
  },
  check(statements, context) {
    for (const stmt of statements) {
      if (stmt.type !== 'CreateStmt') continue
      const tableName = getTableName(stmt.node)
      if (!tableName) continue

      if (!hasPrimaryKey(stmt.node)) {
        context.report({
          severity: this.meta.severity,
          message: `Table "${tableName}" does not have a primary key`,
          line: stmt.line,
          fix: { description: `Add primary key to ${tableName}`, sql: `ALTER TABLE ${tableName} ADD PRIMARY KEY (id);` },
        })
      }
    }
  },
}

function hasPrimaryKey(node: any): boolean {
  for (const elt of node.tableElts ?? []) {
    if (elt.ColumnDef?.constraints?.some((c: any) => c.Constraint?.contype === 'CONSTR_PRIMARY')) return true
    if (elt.Constraint?.contype === 'CONSTR_PRIMARY') return true
  }
  return false
}
