import type { Rule } from '../../core/types.js'
import { getTableName, getColumnNames } from '../../parser/index.js'

const SENSITIVE = [
  { pattern: /password|passwd/i, type: 'password' },
  { pattern: /secret/i, type: 'secret' },
  { pattern: /api[_-]?key/i, type: 'api_key' },
  { pattern: /access[_-]?token|refresh[_-]?token|auth[_-]?token|bearer|jwt/i, type: 'token' },
  { pattern: /ssn|social[_-]?security|credit[_-]?card|card[_-]?number|cvv/i, type: 'pii' },
  { pattern: /private[_-]?key|encryption[_-]?key/i, type: 'key' },
]

export const noSensitiveColumns: Rule = {
  meta: {
    id: 'no-sensitive-columns',
    name: 'No Sensitive Columns Exposed',
    description: 'Columns with sensitive data should not be exposed in public tables',
    severity: 'warning',
    category: 'security',
    docs: 'https://supabase.com/docs/guides/database/database-linter?lint=0023_sensitive_columns_exposed',
  },
  check(statements, context) {
    for (const stmt of statements) {
      if (stmt.type !== 'CreateStmt') continue
      const tableName = getTableName(stmt.node)
      if (!tableName) continue

      for (const col of getColumnNames(stmt.node)) {
        const match = SENSITIVE.find(s => s.pattern.test(col))
        if (match) {
          context.report({
            severity: this.meta.severity,
            message: `Column "${col}" in table "${tableName}" appears to contain sensitive ${match.type} data`,
            line: stmt.line,
          })
        }
      }
    }
  },
}
