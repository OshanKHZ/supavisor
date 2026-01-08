import type { Rule } from '../../core/types.js'

const ALWAYS_TRUE = ['true', '(true)', '1=1', '(1=1)', '1 = 1', '( true )']

export const rlsPolicyAlwaysTrue: Rule = {
  meta: {
    id: 'rls-policy-always-true',
    name: 'RLS Policy Always True',
    description: 'Detects RLS policies with overly permissive expressions like USING (true)',
    severity: 'warning',
    category: 'security',
    docs: 'https://supabase.com/docs/guides/database/database-linter?lint=0024_permissive_rls_policy',
  },
  check(statements, context) {
    for (const stmt of statements) {
      if (stmt.type !== 'CreatePolicyStmt') continue
      const { policy_name: name, table, cmd_name, permissive } = stmt.node
      if (!table?.relname || !name || permissive === false) continue

      const schema = table.schemaname ?? 'public'
      const cmd = (cmd_name ?? 'all').toUpperCase()
      const using = extractClause(stmt.raw, 'using')
      const withCheck = extractClause(stmt.raw, 'with check')

      if (isAlwaysTrue(using) && ['UPDATE', 'DELETE', 'ALL'].includes(cmd)) {
        context.report({ severity: this.meta.severity, message: `Policy "${name}" on "${schema}.${table.relname}" has USING (true) for ${cmd}`, line: stmt.line })
      }
      if (isAlwaysTrue(withCheck) && ['INSERT', 'UPDATE', 'ALL'].includes(cmd)) {
        context.report({ severity: this.meta.severity, message: `Policy "${name}" on "${schema}.${table.relname}" has WITH CHECK (true) for ${cmd}`, line: stmt.line })
      }
    }
  },
}

function extractClause(raw: string, clause: string): string | null {
  const idx = raw.toLowerCase().indexOf(clause)
  if (idx === -1) return null
  const after = raw.slice(idx + clause.length)
  const start = after.indexOf('(')
  if (start === -1) return null

  let depth = 0, end = -1
  for (let i = start; i < after.length; i++) {
    if (after[i] === '(') depth++
    if (after[i] === ')' && --depth === 0) { end = i; break }
  }
  return end === -1 ? null : after.slice(start + 1, end).trim()
}

function isAlwaysTrue(clause: string | null): boolean {
  if (!clause) return false
  const n = clause.toLowerCase().replace(/\s+/g, ' ').trim()
  return ALWAYS_TRUE.some(p => n === p || n === p.replace(/\s/g, ''))
}
