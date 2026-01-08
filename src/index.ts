// Core types
export type { Severity, Category, RuleScope, LintResult, LintFix, RuleMeta, RuleContext, ParsedStatement, Rule, LintOptions, LintReport } from './core/index.js'
export { parseFiles, getOrParseFile, clearCache, getLineNumber, isIgnoredByCache } from './core/index.js'
export type { CachedFile } from './core/index.js'

// Parser
export { parseSQL, getNodeType, findNodes, getTableName, getColumnNames, getFunctionName, getViewName, referencesAuthUsers, containsPattern } from './parser/index.js'

// Linter
export { lint, lintWithFixes, allRules, ruleMap, projectRules, createProjectContext, updateContext } from './linter/index.js'
export type { ProjectRule, ProjectContext, TableInfo, ColumnInfo, ForeignKeyInfo, IndexInfo, PolicyInfo, ViewInfo, FunctionInfo } from './linter/index.js'

// Config
export { loadConfig, defineConfig, loadIgnoreFile, parseInlineDisables } from './config/index.js'
export type { SupavisorConfig, IgnoreEntry } from './config/index.js'
