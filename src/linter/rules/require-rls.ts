import type { Rule } from '../../core/types.js'
import { getTableName } from '../../parser/index.js'

export const requireRls: Rule = {
  meta: {
    id: 'require-rls',
    name: 'Require Row Level Security',
    description: 'Tables in public schema should have RLS enabled for security',
    severity: 'error',
    category: 'security',
    scope: 'project', // RLS may be enabled in a later migration file
    docs: 'https://supabase.com/docs/guides/database/database-linter?lint=0013_rls_disabled_in_public',
  },
  check(statements, context) {
    const tables = new Map<string, number>()
    const rlsEnabled = new Set<string>()

    for (const stmt of statements) {
      if (stmt.type === 'CreateStmt') {
        const name = getTableName(stmt.node)
        const schema = stmt.node.relation?.schemaname ?? 'public'
        if (name && schema === 'public') tables.set(name, stmt.line)
      }
      if (stmt.type === 'AlterTableStmt') {
        const name = getTableName(stmt.node)
        if (name && stmt.node.cmds?.some((c: any) => c.AlterTableCmd?.subtype === 'AT_EnableRowSecurity')) {
          rlsEnabled.add(name)
        }
      }
    }

    for (const [table, line] of tables) {
      if (!rlsEnabled.has(table)) {
        context.report({
          severity: this.meta.severity,
          message: `Table "${table}" in public schema does not have RLS enabled`,
          line,
          fix: { description: `Enable RLS on ${table}`, sql: `ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;` },
        })
      }
    }
  },
}
