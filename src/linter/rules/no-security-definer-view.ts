import type { Rule } from '../../core/types.js'

export const noSecurityDefinerView: Rule = {
  meta: {
    id: 'no-security-definer-view',
    name: 'No Security Definer View',
    description: 'Views with SECURITY DEFINER can bypass RLS policies',
    severity: 'error',
    category: 'security',
    docs: 'https://supabase.com/docs/guides/database/database-linter?lint=0010_security_definer_view',
  },
  check(statements, context) {
    for (const stmt of statements) {
      if (stmt.type !== 'ViewStmt') continue
      const viewName = stmt.node.view?.relname
      const opts = stmt.node.options ?? []

      const hasDefiner = opts.some((o: any) => o.DefElem?.defname === 'security_invoker' && o.DefElem?.arg?.String?.sval === 'false')
      const hasBarrier = opts.some((o: any) => o.DefElem?.defname === 'security_barrier' && o.DefElem?.arg?.String?.sval === 'true')

      // Security barrier mitigates the definer risk
      if (hasDefiner && !hasBarrier) {
        context.report({
          severity: this.meta.severity,
          message: `View "${viewName}" uses SECURITY DEFINER without SECURITY BARRIER`,
          line: stmt.line,
          fix: { description: `Add SECURITY BARRIER to ${viewName}`, sql: `ALTER VIEW ${viewName} SET (security_barrier = true);` },
        })
      }
    }
  },
}
