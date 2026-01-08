import type { Rule, ParsedStatement } from '../../core/types.js'

interface Policy { name: string; table: string; command: string; permissive: boolean; roles: string[]; line: number }

export const multiplePermissivePolicies: Rule = {
  meta: {
    id: 'multiple-permissive-policies',
    name: 'Multiple Permissive Policies',
    description: 'Multiple permissive policies on the same table/role/action is suboptimal for performance',
    severity: 'warning',
    category: 'performance',
    scope: 'project', // policies may be spread across multiple files
    docs: 'https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies',
  },
  check(statements, context) {
    const policies = extractPolicies(statements)
    const groups = new Map<string, Policy[]>()

    for (const p of policies.filter(p => p.permissive)) {
      for (const role of p.roles) {
        const key = `${p.table}:${p.command}:${role}`
        const arr = groups.get(key) ?? []
        arr.push(p)
        groups.set(key, arr)
      }
    }

    for (const [key, list] of groups) {
      if (list.length <= 1) continue
      const [table, cmd, role] = key.split(':')
      context.report({
        severity: this.meta.severity,
        message: `Table "${table}" has ${list.length} permissive policies for role "${role}" on ${cmd}: ${list.map(p => p.name).join(', ')}`,
        line: list[0].line,
      })
    }
  },
}

function extractPolicies(statements: ParsedStatement[]): Policy[] {
  const policies: Policy[] = []
  for (const stmt of statements) {
    if (stmt.type !== 'CreatePolicyStmt') continue
    const { policy_name, table, cmd_name, permissive, roles = [] } = stmt.node
    if (!table?.relname) continue

    const fullTable = table.schemaname ? `${table.schemaname}.${table.relname}` : table.relname
    const cmd = (cmd_name ?? 'all').toUpperCase()
    const cmds = cmd === 'ALL' ? ['SELECT', 'INSERT', 'UPDATE', 'DELETE'] : [cmd]

    for (const c of cmds) {
      policies.push({
        name: policy_name,
        table: fullTable,
        command: c,
        permissive: permissive !== false,
        roles: roles.map((r: any) => r.RoleSpec?.rolename ?? 'public'),
        line: stmt.line,
      })
    }
  }
  return policies
}
