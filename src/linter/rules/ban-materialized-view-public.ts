import type { Rule } from '../../core/types.js'

export const banMaterializedViewPublic: Rule = {
  meta: {
    id: 'ban-materialized-view-public',
    name: 'Materialized View in Public Schema',
    description: 'Materialized views in public schema are exposed via API and do not support RLS',
    severity: 'warning',
    category: 'security',
    docs: 'https://supabase.com/docs/guides/database/database-linter?lint=0016_materialized_view_in_api',
  },
  check(statements, context) {
    for (const stmt of statements) {
      if (stmt.type !== 'CreateTableAsStmt' || stmt.node.relkind !== 'OBJECT_MATVIEW') continue
      const viewName = stmt.node.into?.rel?.relname
      const schema = stmt.node.into?.rel?.schemaname ?? 'public'
      if (schema !== 'public') continue

      context.report({
        severity: this.meta.severity,
        message: `Materialized view "${viewName}" in public schema is exposed via API and does not support RLS`,
        line: stmt.line,
      })
    }
  },
}
