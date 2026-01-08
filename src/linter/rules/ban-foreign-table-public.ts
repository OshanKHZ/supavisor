import type { Rule } from '../../core/types.js'

export const banForeignTablePublic: Rule = {
  meta: {
    id: 'ban-foreign-table-public',
    name: 'Foreign Table in Public Schema',
    description: 'Foreign tables in public schema are exposed via API and do not support RLS',
    severity: 'warning',
    category: 'security',
    docs: 'https://supabase.com/docs/guides/database/database-linter?lint=0017_foreign_table_in_api',
  },
  check(statements, context) {
    for (const stmt of statements) {
      if (stmt.type !== 'CreateForeignTableStmt') continue
      const tableName = stmt.node.base?.relation?.relname
      const schema = stmt.node.base?.relation?.schemaname ?? 'public'
      if (schema !== 'public') continue

      context.report({
        severity: this.meta.severity,
        message: `Foreign table "${tableName}" in public schema is exposed via API and does not support RLS`,
        line: stmt.line,
      })
    }
  },
}
