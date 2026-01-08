import { glob } from 'glob'
import { parseFiles, clearCache, isIgnoredByCache, type CachedFile } from '../core/cache.js'
import { allRules } from './rules/index.js'
import { createProjectContext, updateContext } from './context/project.js'
import { projectRules } from './project-rules.js'
import { loadIgnoreFile, type IgnoreEntry } from '../config/ignore.js'
import type { Rule, RuleContext, LintResult, LintReport, LintOptions, ParsedStatement, Severity } from '../core/types.js'

const RULE_STATEMENT_TYPES: Record<string, string[]> = {
  'no-table-without-pk': ['CreateStmt'],
  'no-fk-without-index': ['CreateStmt', 'AlterTableStmt', 'IndexStmt'],
  'require-rls': ['CreateStmt', 'AlterTableStmt'],
  'no-sensitive-columns': ['CreateStmt'],
  'no-extension-in-public': ['CreateExtensionStmt'],
  'no-security-definer-view': ['ViewStmt'],
  'function-search-path': ['CreateFunctionStmt'],
  'auth-users-exposed': ['ViewStmt', 'CreateTableAsStmt'],
  'multiple-permissive-policies': ['CreatePolicyStmt'],
  'policy-exists-rls-disabled': ['CreatePolicyStmt', 'AlterTableStmt'],
  'rls-enabled-no-policy': ['AlterTableStmt', 'CreatePolicyStmt'],
  'duplicate-index': ['IndexStmt'],
  'rls-references-user-metadata': ['CreatePolicyStmt'],
  'ban-materialized-view-public': ['CreateTableAsStmt'],
  'ban-foreign-table-public': ['CreateForeignTableStmt'],
  'rls-policy-always-true': ['CreatePolicyStmt'],
}

export async function lint(options: LintOptions): Promise<LintReport> {
  const filePaths = await resolveFiles(options.files, options.ignore)
  const ignoreEntries = await loadIgnoreFile()
  const cachedFiles = await parseFiles(filePaths, 10)

  return options.projectMode
    ? lintProject(cachedFiles, options.rules, ignoreEntries)
    : lintIndividual(cachedFiles, options.rules, ignoreEntries)
}

function lintIndividual(
  cachedFiles: CachedFile[],
  ruleConfig?: Record<string, Severity | 'off'>,
  ignoreEntries: IgnoreEntry[] = []
): LintReport {
  // Only run file-scoped rules in individual mode (project-scoped rules need cross-file context)
  const fileRules = allRules.filter(r => r.meta.scope !== 'project')
  const rules = applyRuleConfig(fileRules, ruleConfig)
  const results: LintResult[] = []

  for (const cached of cachedFiles) {
    for (const result of lintFile(cached, rules)) {
      if (!isIgnored(result, cached, ignoreEntries)) results.push(result)
    }
  }

  return createReport(results)
}

function lintProject(
  cachedFiles: CachedFile[],
  ruleConfig?: Record<string, Severity | 'off'>,
  ignoreEntries: IgnoreEntry[] = []
): LintReport {
  // Sort by migration order: timestamps first, then numeric prefixes
  const sortedFiles = [...cachedFiles].sort((a, b) => migrationCompare(a.path, b.path))
  const results: LintResult[] = []
  const fileMap = new Map(cachedFiles.map(f => [f.path, f]))

  // Run file-scoped rules per file (project-scoped rules are handled by projectRules below)
  const fileRules = applyRuleConfig(allRules.filter(r => r.meta.scope !== 'project'), ruleConfig)
  for (const cached of sortedFiles) {
    for (const result of lintFile(cached, fileRules)) {
      if (!isIgnored(result, cached, ignoreEntries)) results.push(result)
    }
  }

  // Run project-level context rules (these analyze ALL files together with full context)
  const ctx = createProjectContext()
  for (const cached of sortedFiles) updateContext(ctx, cached.statements, cached.path)

  for (const rule of applyProjectRuleConfig(ruleConfig)) {
    for (const r of rule.check(ctx)) {
      const cached = fileMap.get(r.file)
      if (!cached || !isIgnored(r, cached, ignoreEntries)) results.push(r)
    }
  }

  return createReport(results)
}

function lintFile(cached: CachedFile, rules: Rule[]): LintResult[] {
  const results: LintResult[] = []
  const byType = new Map<string, ParsedStatement[]>()

  for (const stmt of cached.statements) {
    const arr = byType.get(stmt.type) ?? []
    arr.push(stmt)
    byType.set(stmt.type, arr)
  }

  for (const rule of rules) {
    const types = RULE_STATEMENT_TYPES[rule.meta.id] ?? ['*']
    const stmts = types.includes('*')
      ? cached.statements
      : types.flatMap(t => byType.get(t) ?? [])

    if (stmts.length === 0) continue

    const context: RuleContext = {
      file: cached.path,
      source: cached.content,
      report: r => results.push({ ...r, ruleId: rule.meta.id, file: cached.path, docs: rule.meta.docs }),
      getAllStatements: () => cached.statements,
    }
    rule.check(stmts, context)
  }

  return results
}

function isIgnored(result: LintResult, cached: CachedFile, ignoreEntries: IgnoreEntry[]): boolean {
  for (const entry of ignoreEntries) {
    if (entry.ruleId !== result.ruleId && entry.ruleId !== '*') continue
    if (!entry.file) return true
    if (result.file.includes(entry.file) && (!entry.line || entry.line === result.line)) return true
  }

  const objectName = result.message.match(/"([^"]+)"/)?.[1]
  return isIgnoredByCache(cached, result.ruleId, result.line, objectName)
}

async function resolveFiles(patterns: string[], ignore?: string[]): Promise<string[]> {
  const files: string[] = []
  for (const pattern of patterns) {
    const matches = await glob(pattern, { ignore: ignore ?? ['**/node_modules/**'], nodir: true })
    files.push(...matches)
  }
  return [...new Set(files)]
}

function applyRuleConfig(rules: Rule[], config?: Record<string, Severity | 'off'>): Rule[] {
  if (!config) return rules
  return rules
    .filter(r => config[r.meta.id] !== 'off')
    .map(r => {
      const sev = config[r.meta.id]
      return sev && sev !== 'off' ? { ...r, meta: { ...r.meta, severity: sev } } : r
    })
}

function applyProjectRuleConfig(config?: Record<string, Severity | 'off'>) {
  if (!config) return projectRules
  return projectRules
    .filter(r => config[r.id] !== 'off')
    .map(r => {
      const sev = config[r.id]
      return sev && sev !== 'off' ? { ...r, severity: sev } : r
    })
}

function createReport(results: LintResult[]): LintReport {
  return {
    results,
    errorCount: results.filter(r => r.severity === 'error').length,
    warningCount: results.filter(r => r.severity === 'warning').length,
    fixableCount: results.filter(r => r.fix).length,
  }
}

export async function lintWithFixes(options: LintOptions): Promise<{ report: LintReport; fixes: Map<string, string> }> {
  const report = await lint(options)
  const fixes = new Map<string, string>()

  if (!options.fix) return { report, fixes }

  const fixesByFile = new Map<string, LintResult[]>()
  for (const r of report.results) {
    if (r.fix) {
      const arr = fixesByFile.get(r.file) ?? []
      arr.push(r)
      fixesByFile.set(r.file, arr)
    }
  }

  const filePaths = await resolveFiles(options.files, options.ignore)
  const fileMap = new Map((await parseFiles(filePaths)).map(f => [f.path, f]))

  for (const [file, results] of fixesByFile) {
    const cached = fileMap.get(file)
    if (!cached) continue
    let content = cached.content
    for (const r of results) {
      if (r.fix) content += `\n\n-- Autofix: ${r.fix.description}\n${r.fix.sql}`
    }
    fixes.set(file, content)
  }

  return { report, fixes }
}

// Sort migrations: timestamps first (14-digit format), then natural sort fallback
function migrationCompare(a: string, b: string): number {
  const aFile = a.split(/[/\\]/).pop() ?? a
  const bFile = b.split(/[/\\]/).pop() ?? b

  // Extract timestamp (14 digits like 20240115123456)
  const tsRegex = /^(\d{14})/
  const aTs = aFile.match(tsRegex)?.[1]
  const bTs = bFile.match(tsRegex)?.[1]

  // Both have timestamps - compare them
  if (aTs && bTs) return aTs.localeCompare(bTs)

  // One has timestamp, it comes first (more reliable)
  if (aTs) return -1
  if (bTs) return 1

  // Fallback: natural sort for numeric prefixes (001_, V1__, etc)
  const numRegex = /^[Vv]?(\d+)/
  const aNum = parseInt(aFile.match(numRegex)?.[1] ?? '', 10)
  const bNum = parseInt(bFile.match(numRegex)?.[1] ?? '', 10)

  if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum
  if (!isNaN(aNum)) return -1
  if (!isNaN(bNum)) return 1

  // Last resort: alphabetical
  return aFile.localeCompare(bFile)
}

export { clearCache }
