import type { Rule, ParsedStatement } from '../../core/types.js'

interface Idx { name: string; table: string; columns: string[]; unique: boolean; line: number }

export const duplicateIndex: Rule = {
  meta: {
    id: 'duplicate-index',
    name: 'Duplicate Index',
    description: 'Detects identical or redundant indexes on the same table',
    severity: 'warning',
    category: 'performance',
    scope: 'project', // duplicate indexes may be created in different files
    docs: 'https://supabase.com/docs/guides/database/database-linter?lint=0009_duplicate_index',
  },
  check(statements, context) {
    const indexes = extractIndexes(statements)
    const byTable = new Map<string, Idx[]>()
    for (const idx of indexes) {
      const arr = byTable.get(idx.table) ?? []
      arr.push(idx)
      byTable.set(idx.table, arr)
    }

    for (const [table, list] of byTable) {
      const seen = new Map<string, Idx>()

      for (const idx of list) {
        const key = idx.columns.join(',')
        const existing = seen.get(key)
        if (existing) {
          context.report({
            severity: this.meta.severity,
            message: `Table "${table}" has duplicate indexes: "${existing.name}" and "${idx.name}" on (${key})`,
            line: idx.line,
            fix: { description: `Drop duplicate index ${idx.name}`, sql: `DROP INDEX IF EXISTS ${idx.name};` },
          })
        } else {
          seen.set(key, idx)
        }
      }

      // Check prefix redundancy (shorter index covered by longer one)
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          const a = list[i], b = list[j]
          if (a.columns.join(',') === b.columns.join(',')) continue

          if (isPrefix(a.columns, b.columns) && !a.unique) {
            context.report({
              severity: 'info',
              message: `Index "${a.name}" on (${a.columns.join(', ')}) is redundant - covered by "${b.name}"`,
              line: a.line,
              fix: { description: `Drop redundant index ${a.name}`, sql: `DROP INDEX IF EXISTS ${a.name};` },
            })
          } else if (isPrefix(b.columns, a.columns) && !b.unique) {
            context.report({
              severity: 'info',
              message: `Index "${b.name}" on (${b.columns.join(', ')}) is redundant - covered by "${a.name}"`,
              line: b.line,
              fix: { description: `Drop redundant index ${b.name}`, sql: `DROP INDEX IF EXISTS ${b.name};` },
            })
          }
        }
      }
    }
  },
}

function extractIndexes(statements: ParsedStatement[]): Idx[] {
  return statements
    .filter(s => s.type === 'IndexStmt' && s.node.idxname && s.node.relation?.relname)
    .map(s => {
      const { idxname, relation, indexParams = [], unique } = s.node
      const table = relation.schemaname ? `${relation.schemaname}.${relation.relname}` : relation.relname
      return { name: idxname, table, columns: indexParams.map((p: any) => p.IndexElem?.name).filter(Boolean), unique: unique === true, line: s.line }
    })
    .filter(idx => idx.columns.length > 0)
}

function isPrefix(shorter: string[], longer: string[]): boolean {
  return shorter.length < longer.length && shorter.every((c, i) => c === longer[i])
}
