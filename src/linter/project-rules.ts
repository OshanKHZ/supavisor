import type { ProjectContext } from './context/project.js'
import type { LintResult, Severity } from '../core/types.js'

export interface ProjectRule {
  id: string
  name: string
  description: string
  severity: Severity
  category: string
  docs?: string
  check: (ctx: ProjectContext) => LintResult[]
}

export const projectRules: ProjectRule[] = [
  {
    id: 'project/table-without-rls',
    name: 'Table Without RLS',
    description: 'Public tables should have RLS enabled',
    severity: 'error',
    category: 'security',
    check(ctx) {
      return [...ctx.tables]
        .filter(([, t]) => t.schema === 'public' && !t.hasRls)
        .map(([name, t]) => ({
          ruleId: this.id,
          severity: this.severity,
          message: `Table "${name}" does not have RLS enabled`,
          file: t.file,
          line: t.line,
          fix: { description: `Enable RLS on ${name}`, sql: `ALTER TABLE ${name} ENABLE ROW LEVEL SECURITY;` },
        }))
    },
  },

  {
    id: 'project/fk-without-index',
    name: 'Foreign Key Without Index',
    description: 'Foreign key columns should be indexed',
    severity: 'warning',
    category: 'performance',
    check(ctx) {
      const results: LintResult[] = []
      for (const [tableName, table] of ctx.tables) {
        const indexes = ctx.indexes.get(tableName) ?? []
        for (const fk of table.foreignKeys) {
          const hasIndex = indexes.some(idx => fk.columns.every((col, i) => idx.columns[i] === col))
          if (!hasIndex) {
            const cols = fk.columns.join(', ')
            results.push({
              ruleId: this.id,
              severity: this.severity,
              message: `Foreign key on "${tableName}(${cols})" has no covering index`,
              file: table.file,
              line: table.line,
              fix: { description: 'Create index for FK', sql: `CREATE INDEX idx_${table.name}_${fk.columns.join('_')} ON ${tableName} (${cols});` },
            })
          }
        }
      }
      return results
    },
  },

  {
    id: 'project/rls-without-policy',
    name: 'RLS Without Policy',
    description: 'Tables with RLS enabled should have at least one policy',
    severity: 'warning',
    category: 'security',
    check(ctx) {
      return [...ctx.tables]
        .filter(([name, t]) => t.hasRls && (ctx.policies.get(name)?.length ?? 0) === 0)
        .map(([name, t]) => ({
          ruleId: this.id,
          severity: this.severity,
          message: `Table "${name}" has RLS enabled but no policies (blocks all access)`,
          file: t.file,
          line: t.line,
        }))
    },
  },

  {
    id: 'project/policy-without-rls',
    name: 'Policy Without RLS',
    description: 'Tables with policies should have RLS enabled',
    severity: 'error',
    category: 'security',
    check(ctx) {
      const results: LintResult[] = []
      for (const [tableName, policies] of ctx.policies) {
        const table = ctx.tables.get(tableName)
        if (table && !table.hasRls) {
          results.push({
            ruleId: this.id,
            severity: this.severity,
            message: `Table "${tableName}" has policies (${policies.map(p => p.name).join(', ')}) but RLS is not enabled`,
            file: policies[0].file,
            line: policies[0].line,
            fix: { description: `Enable RLS on ${tableName}`, sql: `ALTER TABLE ${tableName} ENABLE ROW LEVEL SECURITY;` },
          })
        }
      }
      return results
    },
  },

  {
    id: 'project/duplicate-index',
    name: 'Duplicate Index',
    description: 'Identical indexes on the same table',
    severity: 'warning',
    category: 'performance',
    check(ctx) {
      const results: LintResult[] = []
      for (const [tableName, indexes] of ctx.indexes) {
        const seen = new Map<string, (typeof indexes)[0]>()
        for (const idx of indexes) {
          const key = idx.columns.join(',')
          const existing = seen.get(key)
          if (existing) {
            results.push({
              ruleId: this.id,
              severity: this.severity,
              message: `Duplicate indexes on "${tableName}": "${existing.name}" and "${idx.name}"`,
              file: idx.file,
              line: idx.line,
              fix: { description: 'Drop duplicate index', sql: `DROP INDEX IF EXISTS ${idx.name};` },
            })
          } else {
            seen.set(key, idx)
          }
        }
      }
      return results
    },
  },

  {
    id: 'project/multiple-permissive-policies',
    name: 'Multiple Permissive Policies',
    description: 'Multiple permissive policies for same role/action is suboptimal',
    severity: 'warning',
    category: 'performance',
    check(ctx) {
      const results: LintResult[] = []
      for (const [tableName, policies] of ctx.policies) {
        const groups = new Map<string, typeof policies>()

        for (const policy of policies.filter(p => p.permissive)) {
          const cmds = policy.command === 'ALL' ? ['SELECT', 'INSERT', 'UPDATE', 'DELETE'] : [policy.command]
          for (const cmd of cmds) {
            for (const role of policy.roles) {
              const key = `${cmd}:${role}`
              const arr = groups.get(key) ?? []
              arr.push(policy)
              groups.set(key, arr)
            }
          }
        }

        for (const [key, group] of groups) {
          if (group.length <= 1) continue
          const [cmd, role] = key.split(':')
          results.push({
            ruleId: this.id,
            severity: this.severity,
            message: `Table "${tableName}" has ${group.length} permissive policies for ${role}/${cmd}: ${group.map(p => p.name).join(', ')}`,
            file: group[0].file,
            line: group[0].line,
          })
        }
      }
      return results
    },
  },

]
