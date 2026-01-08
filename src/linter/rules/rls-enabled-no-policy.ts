import type { Rule } from '../../core/types.js'
import { getTableName } from '../../parser/index.js'

export const rlsEnabledNoPolicy: Rule = {
  meta: {
    id: 'rls-enabled-no-policy',
    name: 'RLS Enabled No Policy',
    description: 'Tables with RLS enabled should have at least one policy defined',
    severity: 'warning',
    category: 'security',
    scope: 'project', // policies may be defined in a later migration file
    docs: 'https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy',
  },
  check(statements, context) {
    const withRls = new Map<string, number>()
    const withPolicies = new Set<string>()

    for (const stmt of statements) {
      if (stmt.type === 'AlterTableStmt') {
        const name = getTableName(stmt.node)
        if (name && stmt.node.cmds?.some((c: any) => c.AlterTableCmd?.subtype === 'AT_EnableRowSecurity')) {
          withRls.set(name, stmt.line)
        }
      }
      if (stmt.type === 'CreatePolicyStmt') {
        const { table } = stmt.node
        if (table?.relname) {
          withPolicies.add(table.relname)
          withPolicies.add(`${table.schemaname ?? 'public'}.${table.relname}`)
        }
      }
    }

    for (const [table, line] of withRls) {
      const base = table.startsWith('public.') ? table.slice(7) : table
      if (!withPolicies.has(table) && !withPolicies.has(base) && !withPolicies.has(`public.${base}`)) {
        context.report({
          severity: this.meta.severity,
          message: `Table "${table}" has RLS enabled but no policies defined (will block all access)`,
          line,
        })
      }
    }
  },
}
