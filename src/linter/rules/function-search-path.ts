import type { Rule } from '../../core/types.js'

export const functionSearchPath: Rule = {
  meta: {
    id: 'function-search-path',
    name: 'Function Search Path Mutable',
    description: 'Functions should set search_path to prevent search path injection attacks',
    severity: 'warning',
    category: 'security',
    docs: 'https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable',
  },
  check(statements, context) {
    for (const stmt of statements) {
      if (stmt.type !== 'CreateFunctionStmt') continue
      const name = stmt.node.funcname?.map((n: any) => n.String?.sval).filter(Boolean).join('.')
      if (!name) continue

      const opts = stmt.node.options ?? []
      const isDefiner = opts.some((o: any) => o.DefElem?.defname === 'security' && o.DefElem?.arg?.String?.sval === 'definer')
      const hasPath = opts.some((o: any) => o.DefElem?.defname === 'set' && o.DefElem?.arg?.VariableSetStmt?.name === 'search_path')

      // Only definer functions need explicit search_path
      if (isDefiner && !hasPath) {
        context.report({
          severity: this.meta.severity,
          message: `Function "${name}" is SECURITY DEFINER but does not set search_path`,
          line: stmt.line,
          fix: { description: `Set search_path for ${name}`, sql: `-- Add to function definition:\nSET search_path = ''` },
        })
      }
    }
  },
}
