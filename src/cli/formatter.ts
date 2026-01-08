import pc from 'picocolors'
import type { LintResult, Severity } from '../core/types.js'

const ICONS: Record<Severity, string> = { error: pc.red('✖'), warning: pc.yellow('⚠'), info: pc.blue('ℹ') }
const COLORS: Record<Severity, (s: string) => string> = { error: pc.red, warning: pc.yellow, info: pc.blue }

export function printResults(results: LintResult[], quiet: boolean): void {
  const byFile = new Map<string, LintResult[]>()
  for (const r of results) {
    if (quiet && r.severity !== 'error') continue
    const arr = byFile.get(r.file) ?? []
    arr.push(r)
    byFile.set(r.file, arr)
  }

  for (const [file, list] of byFile) {
    console.log(pc.underline(file))
    for (const r of list) {
      const loc = r.line ? pc.dim(`:${r.line}`) : ''
      console.log(`  ${ICONS[r.severity]} ${COLORS[r.severity](r.message)} ${pc.dim(`(${r.ruleId})`)}${loc}`)
      if (r.fix) console.log(pc.dim(`    → Fix: ${r.fix.description}`))
    }
    console.log()
  }
}

export function printSummary(errors: number, warnings: number, fixable: number, didFix: boolean): void {
  const parts: string[] = []
  if (errors > 0) parts.push(pc.red(`${errors} error${errors === 1 ? '' : 's'}`))
  if (warnings > 0) parts.push(pc.yellow(`${warnings} warning${warnings === 1 ? '' : 's'}`))

  if (parts.length === 0) {
    console.log(pc.green('  ✔ No issues found!\n'))
    return
  }

  console.log(`  ${parts.join(', ')}`)
  if (fixable > 0 && !didFix) console.log(pc.dim(`  ${fixable} fixable with --generate-fix\n`))
  else console.log()
}

export function printHelp(): void {
  console.log(`
  ${pc.bold('supavisor')} - Your Supabase database supervisor 🔍

  ${pc.dim('Usage:')}
    supavisor [files] [options]

  ${pc.dim('Options:')}
    --init           Create a .supavisorrc.json config file
    -p, --project    Analyze all migrations together (enables all rules)
    --generate-fix   Generate new migration file with fixes
    --json           Output results as JSON
    --quiet          Only show errors (no warnings)
    -h, --help       Show this help message
    -v               Show version

  ${pc.dim('Modes:')}
    Default:       Runs file-scoped rules (10 rules) - fast, for CI
    --project:     Adds cross-file analysis (+6 project rules) - accurate

  ${pc.dim('Config:')}
    Reads from .supavisorrc.json, .supavisorrc, supavisor.config.json,
    or "supavisor" field in package.json

  ${pc.dim('Ignoring issues:')}
    Inline:  -- supavisor-disable-next-line rule-id
    File:    .supavisorignore with rule-id:path/to/file.sql

  ${pc.dim('Examples:')}
    supavisor                                 # Lint with file-scoped rules
    supavisor --project                       # Lint with all rules (recommended)
    supavisor ./migrations/*.sql              # Lint specific files
    supavisor --generate-fix                  # Generate fix migration

  ${pc.dim('⚠️  Important:')}
    ${pc.yellow('Never modify applied migrations!')} Always create new migration files.
    Use --generate-fix to create a new migration with fixes instead.

  ${pc.dim('Rules:')}
    ${pc.cyan('File-scoped')} ${pc.dim('(always run):')}
      no-table-without-pk         Tables must have a primary key
      no-sensitive-columns        Warn on sensitive column names
      no-extension-in-public      Extensions should use "extensions"
      no-security-definer-view    Security definer views need barrier
      function-search-path        Security definer needs search_path
      auth-users-exposed          Views exposing auth.users
      ban-materialized-view-public Materialized views don't support RLS
      ban-foreign-table-public    Foreign tables don't support RLS
      rls-policy-always-true      Policies with USING(true) for writes
      rls-references-user-metadata Policies referencing user_metadata

    ${pc.cyan('Project-scoped')} ${pc.dim('(only with --project):')}
      project/table-without-rls   Public tables must enable RLS
      project/fk-without-index    Foreign keys should be indexed
      project/duplicate-index     Detect duplicate/redundant indexes
      project/policy-without-rls  Policy defined but RLS not enabled
      project/rls-without-policy  RLS enabled but no policies defined
      project/multiple-permissive Multiple permissive policies (perf)
`)
}
