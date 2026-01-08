export type Severity = 'error' | 'warning' | 'info'
export type Category = 'security' | 'performance' | 'best-practice' | 'supabase'
export type RuleScope = 'file' | 'project' // file = self-contained, project = needs cross-file context

export interface LintResult {
  ruleId: string
  severity: Severity
  message: string
  file: string
  line?: number
  column?: number
  fix?: LintFix
  docs?: string
}

export interface LintFix {
  description: string
  sql: string
}

export interface RuleMeta {
  id: string
  name: string
  description: string
  severity: Severity
  category: Category
  scope?: RuleScope // defaults to 'file' if not specified
  docs?: string
}

export interface RuleContext {
  file: string
  source: string
  report: (result: Omit<LintResult, 'ruleId' | 'file'>) => void
  getAllStatements: () => ParsedStatement[]
}

export interface ParsedStatement {
  type: string
  node: any
  raw: string
  line: number
}

export interface Rule {
  meta: RuleMeta
  check: (statements: ParsedStatement[], context: RuleContext) => void
}

export interface LintOptions {
  files: string[]
  fix?: boolean
  rules?: Record<string, Severity | 'off'>
  ignore?: string[]
  projectMode?: boolean
}

export interface LintReport {
  results: LintResult[]
  errorCount: number
  warningCount: number
  fixableCount: number
}
