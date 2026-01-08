export type {
  Severity,
  Category,
  RuleScope,
  LintResult,
  LintFix,
  RuleMeta,
  RuleContext,
  ParsedStatement,
  Rule,
  LintOptions,
  LintReport,
} from './types.js'

export {
  getOrParseFile,
  parseFiles,
  clearCache,
  getLineNumber,
  isIgnoredByCache,
} from './cache.js'

export type { CachedFile } from './cache.js'
