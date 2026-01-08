import type { Rule } from '../../core/types.js'

export const authUsersExposed: Rule = {
  meta: {
    id: 'auth-users-exposed',
    name: 'Auth Users Exposed',
    description: 'Views or materialized views should not expose auth.users data',
    severity: 'error',
    category: 'security',
    docs: 'https://supabase.com/docs/guides/database/database-linter?lint=0002_auth_users_exposed',
  },
  check(statements, context) {
    for (const stmt of statements) {
      if (stmt.type === 'ViewStmt') {
        const viewName = stmt.node.view?.relname
        const schema = stmt.node.view?.schemaname ?? 'public'
        if (schema !== 'public') continue

        const raw = stmt.raw.toLowerCase()
        const refsAuth = raw.includes('auth.users') || raw.includes('"auth"."users"') || (raw.includes('from users') && raw.includes('auth'))
        if (!refsAuth) continue

        const isInvoker = (stmt.node.options ?? []).some((o: any) =>
          o.DefElem?.defname === 'security_invoker' && ['true', '1', 'yes', 'on'].includes(o.DefElem?.arg?.String?.sval?.toLowerCase())
        )
        if (!isInvoker) {
          context.report({
            severity: this.meta.severity,
            message: `View "${viewName}" in public schema exposes auth.users data`,
            line: stmt.line,
            fix: { description: 'Make view security invoker', sql: `ALTER VIEW ${schema}.${viewName} SET (security_invoker = true);` },
          })
        }
      }

      if (stmt.type === 'CreateTableAsStmt' && stmt.node.relkind === 'OBJECT_MATVIEW') {
        const viewName = stmt.node.into?.rel?.relname
        const schema = stmt.node.into?.rel?.schemaname ?? 'public'
        if (schema !== 'public') continue

        const raw = stmt.raw.toLowerCase()
        if (raw.includes('auth.users') || raw.includes('"auth"."users"')) {
          context.report({
            severity: this.meta.severity,
            message: `Materialized view "${viewName}" exposes auth.users data (no RLS support)`,
            line: stmt.line,
          })
        }
      }
    }
  },
}
