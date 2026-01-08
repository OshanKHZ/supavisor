import type { Rule } from '../../core/types.js'

export const noExtensionInPublic: Rule = {
  meta: {
    id: 'no-extension-in-public',
    name: 'No Extension in Public Schema',
    description: 'Extensions should be installed in "extensions" schema, not public',
    severity: 'warning',
    category: 'supabase',
    docs: 'https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public',
  },
  check(statements, context) {
    for (const stmt of statements) {
      if (stmt.type !== 'CreateExtensionStmt') continue
      const ext = stmt.node.extname
      const schema = stmt.node.options?.find((o: any) => o.DefElem?.defname === 'schema')?.DefElem?.arg?.String?.sval

      if (!schema || schema === 'public') {
        context.report({
          severity: this.meta.severity,
          message: `Extension "${ext}" is being installed in public schema`,
          line: stmt.line,
          fix: { description: `Install ${ext} in extensions schema`, sql: `CREATE EXTENSION IF NOT EXISTS "${ext}" WITH SCHEMA extensions;` },
        })
      }
    }
  },
}
