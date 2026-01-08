import type { Rule } from '../../core/types.js'
import { getTableName } from '../../parser/index.js'

export const policyExistsRlsDisabled: Rule = {
  meta: {
    id: 'policy-exists-rls-disabled',
    name: 'Policy Exists RLS Disabled',
    description: 'Tables with RLS policies should have RLS enabled',
    severity: 'error',
    category: 'security',
    scope: 'project', // RLS enable may be in a different file than policy
    docs: 'https://supabase.com/docs/guides/database/database-linter?lint=0007_policy_exists_rls_disabled',
  },
  check(statements, context) {
    const withPolicies = new Map<string, { policies: string[]; line: number }>()
    const withRls = new Set<string>()

    for (const stmt of statements) {
      if (stmt.type === 'CreatePolicyStmt') {
        const { table, policy_name } = stmt.node
        if (!table?.relname) continue
        const full = `${table.schemaname ?? 'public'}.${table.relname}`
        const entry = withPolicies.get(full) ?? { policies: [], line: stmt.line }
        entry.policies.push(policy_name)
        withPolicies.set(full, entry)
      }
      if (stmt.type === 'AlterTableStmt') {
        const name = getTableName(stmt.node)
        if (name && stmt.node.cmds?.some((c: any) => c.AlterTableCmd?.subtype === 'AT_EnableRowSecurity')) {
          withRls.add(name)
        }
      }
    }

    for (const [table, { policies, line }] of withPolicies) {
      const base = table.startsWith('public.') ? table.slice(7) : table
      if (!withRls.has(table) && !withRls.has(base) && !withRls.has(`public.${base}`)) {
        context.report({
          severity: this.meta.severity,
          message: `Table "${table}" has RLS policies (${policies.join(', ')}) but RLS is not enabled`,
          line,
          fix: { description: `Enable RLS on ${table}`, sql: `ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;` },
        })
      }
    }
  },
}
