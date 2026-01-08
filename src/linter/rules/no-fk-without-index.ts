import type { Rule, ParsedStatement } from '../../core/types.js'
import { getTableName } from '../../parser/index.js'

interface FK { table: string; columns: string[]; refTable: string; line: number }
interface Idx { table: string; columns: string[] }

export const noFkWithoutIndex: Rule = {
  meta: {
    id: 'no-fk-without-index',
    name: 'No Foreign Key Without Index',
    description: 'Foreign key columns should be indexed for better JOIN performance',
    severity: 'warning',
    category: 'performance',
    scope: 'project', // index may be defined in another migration file
    docs: 'https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys',
  },
  check(statements, context) {
    const fks = extractFKs(statements)
    const indexes = extractIndexes(statements)

    for (const fk of fks) {
      const hasIndex = indexes.some(idx => idx.table === fk.table && fk.columns.every((col, i) => idx.columns[i] === col))
      if (!hasIndex) {
        const cols = fk.columns.join(', ')
        context.report({
          severity: this.meta.severity,
          message: `Foreign key on "${fk.table}(${cols})" referencing "${fk.refTable}" has no covering index`,
          line: fk.line,
          fix: { description: `Create index for FK on ${fk.table}(${cols})`, sql: `CREATE INDEX idx_${fk.table.replace('.', '_')}_${fk.columns.join('_')} ON ${fk.table} (${cols});` },
        })
      }
    }
  },
}

function extractFKs(statements: ParsedStatement[]): FK[] {
  const fks: FK[] = []
  for (const stmt of statements) {
    const tableName = getTableName(stmt.node)
    if (!tableName) continue

    if (stmt.type === 'CreateStmt') {
      for (const elt of stmt.node.tableElts ?? []) {
        if (elt.ColumnDef?.constraints) {
          for (const c of elt.ColumnDef.constraints) {
            if (c.Constraint?.contype === 'CONSTR_FOREIGN') {
              fks.push({ table: tableName, columns: [elt.ColumnDef.colname], refTable: c.Constraint.pktable?.relname ?? 'unknown', line: stmt.line })
            }
          }
        }
        if (elt.Constraint?.contype === 'CONSTR_FOREIGN') {
          fks.push({ table: tableName, columns: elt.Constraint.fk_attrs?.map((a: any) => a.String?.sval).filter(Boolean) ?? [], refTable: elt.Constraint.pktable?.relname ?? 'unknown', line: stmt.line })
        }
      }
    }
    if (stmt.type === 'AlterTableStmt') {
      for (const cmd of stmt.node.cmds ?? []) {
        const c = cmd.AlterTableCmd?.def?.Constraint
        if (c?.contype === 'CONSTR_FOREIGN') {
          fks.push({ table: tableName, columns: c.fk_attrs?.map((a: any) => a.String?.sval).filter(Boolean) ?? [], refTable: c.pktable?.relname ?? 'unknown', line: stmt.line })
        }
      }
    }
  }
  return fks
}

function extractIndexes(statements: ParsedStatement[]): Idx[] {
  return statements
    .filter(s => s.type === 'IndexStmt' && s.node.relation?.relname)
    .map(s => {
      const { relation, indexParams = [] } = s.node
      const table = relation.schemaname ? `${relation.schemaname}.${relation.relname}` : relation.relname
      return { table, columns: indexParams.map((p: any) => p.IndexElem?.name).filter(Boolean) }
    })
    .filter(idx => idx.columns.length > 0)
}
