#!/usr/bin/env node
import pc from 'picocolors'
import { writeFile } from 'fs/promises'
import { lintWithFixes } from '../linter/engine.js'
import { loadConfig } from '../config/loader.js'
import { printResults, printSummary, printHelp } from './formatter.js'

async function main() {
  const args = process.argv.slice(2)

  if (args.includes('--help') || args.includes('-h')) { printHelp(); process.exit(0) }
  if (args.includes('--version') || args.includes('-v')) { console.log('supavisor v0.2.0'); process.exit(0) }
  if (args.includes('--init')) { await initConfig(); process.exit(0) }

  const fix = args.includes('--generate-fix')
  const json = args.includes('--json')
  const quiet = args.includes('--quiet')
  const projectMode = args.includes('--project') || args.includes('-p')

  const config = await loadConfig()
  let files = args.filter(a => !a.startsWith('-') && (a.endsWith('.sql') || a.includes('*')))
  if (files.length === 0) files = config.include ?? ['supabase/migrations/**/*.sql']

  if (!quiet && !json) {
    console.log(pc.dim(`\n  Linting: ${files.join(', ')}`) + (projectMode ? pc.cyan(' [project mode]') : '') + '\n')
  }

  try {
    const { report, fixes } = await lintWithFixes({ files, fix, rules: config.rules, ignore: config.ignore, projectMode })

    if (fix && fixes.size > 0) {
      for (const [file, content] of fixes) {
        await writeFile(file, content, 'utf-8')
        if (!quiet && !json) {
          console.log(pc.green(`\n  ✔ Generated fix migration: ${file}`))
          console.log(pc.dim(`    Review the migration before applying it to your database`))
        }
      }
      if (!quiet && !json) console.log()
    }

    if (json) {
      console.log(JSON.stringify(report, null, 2))
    } else {
      printResults(report.results, quiet)
      printSummary(report.errorCount, report.warningCount, report.fixableCount, fix)
    }

    process.exit(report.errorCount > 0 ? 1 : 0)
  } catch (err) {
    console.error(pc.red('\n  Error:'), err instanceof Error ? err.message : err)
    process.exit(2)
  }
}

const DEFAULT_CONFIG = `{
  "$schema": "https://raw.githubusercontent.com/oshankhz/supavisor/main/schema.json",
  "include": ["supabase/migrations/**/*.sql"],
  "ignore": ["**/node_modules/**"],
  "rules": {
    "no-table-without-pk": "error",
    "no-fk-without-index": "warning",
    "require-rls": "error",
    "no-sensitive-columns": "warning",
    "no-extension-in-public": "warning",
    "no-security-definer-view": "error",
    "function-search-path": "warning",
    "auth-users-exposed": "error",
    "multiple-permissive-policies": "warning",
    "policy-exists-rls-disabled": "error",
    "rls-enabled-no-policy": "warning",
    "duplicate-index": "warning",
    "rls-references-user-metadata": "error",
    "ban-materialized-view-public": "warning",
    "ban-foreign-table-public": "warning",
    "rls-policy-always-true": "warning"
  }
}
`

async function initConfig() {
  await writeFile('.supavisorrc.json', DEFAULT_CONFIG, 'utf-8')
  console.log(pc.green('  ✔ Created .supavisorrc.json\n'))
}

main()
