import type { Rule } from '../../core/types.js'

export const rlsReferencesUserMetadata: Rule = {
  meta: {
    id: 'rls-references-user-metadata',
    name: 'RLS References User Metadata',
    description: 'RLS policies should not reference user_metadata as it is editable by end users',
    severity: 'error',
    category: 'security',
    docs: 'https://supabase.com/docs/guides/database/database-linter?lint=0015_rls_references_user_metadata',
  },
  check(statements, context) {
    for (const stmt of statements) {
      if (stmt.type !== 'CreatePolicyStmt') continue
      const { policy_name, table } = stmt.node
      if (!table?.relname || !policy_name) continue

      const raw = stmt.raw.toLowerCase()
      // user_metadata is editable by users, making it unsafe for RLS decisions
      const unsafe = (raw.includes('auth.jwt()') && raw.includes('user_metadata')) ||
        (raw.includes('current_setting') && raw.includes('request.jwt.claims') && raw.includes('user_metadata')) ||
        raw.includes('raw_user_meta_data')

      if (unsafe) {
        context.report({
          severity: this.meta.severity,
          message: `Policy "${policy_name}" on "${table.schemaname ?? 'public'}.${table.relname}" references user_metadata which is editable by end users`,
          line: stmt.line,
        })
      }
    }
  },
}
