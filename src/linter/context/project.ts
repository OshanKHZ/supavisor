import type { ParsedStatement } from '../../core/types.js'

export interface ProjectContext {
  tables: Map<string, TableInfo>
  indexes: Map<string, IndexInfo[]>
  policies: Map<string, PolicyInfo[]>
  views: Map<string, ViewInfo>
  functions: Map<string, FunctionInfo>
  extensions: Set<string>
}

export interface TableInfo {
  name: string
  schema: string
  hasPrimaryKey: boolean
  hasRls: boolean
  columns: ColumnInfo[]
  foreignKeys: ForeignKeyInfo[]
  file: string
  line: number
}

export interface ColumnInfo { name: string; type: string; nullable: boolean }
export interface ForeignKeyInfo { columns: string[]; refTable: string; refColumns: string[] }
export interface IndexInfo { name: string; table: string; columns: string[]; unique: boolean; file: string; line: number }
export interface PolicyInfo { name: string; table: string; command: string; permissive: boolean; roles: string[]; file: string; line: number }
export interface ViewInfo { name: string; schema: string; securityInvoker: boolean; referencesAuthUsers: boolean; file: string; line: number }
export interface FunctionInfo { name: string; schema: string; securityDefiner: boolean; hasSearchPath: boolean; file: string; line: number }

export function createProjectContext(): ProjectContext {
  return { tables: new Map(), indexes: new Map(), policies: new Map(), views: new Map(), functions: new Map(), extensions: new Set() }
}

export function updateContext(ctx: ProjectContext, statements: ParsedStatement[], file: string): void {
  for (const stmt of statements) {
    const handlers: Record<string, () => void> = {
      CreateStmt: () => processCreateTable(ctx, stmt, file),
      AlterTableStmt: () => processAlterTable(ctx, stmt, file),
      IndexStmt: () => processCreateIndex(ctx, stmt, file),
      CreatePolicyStmt: () => processCreatePolicy(ctx, stmt, file),
      ViewStmt: () => processCreateView(ctx, stmt, file),
      CreateFunctionStmt: () => processCreateFunction(ctx, stmt, file),
      CreateExtensionStmt: () => ctx.extensions.add(stmt.node.extname),
      DropStmt: () => processDropStmt(ctx, stmt),
    }
    handlers[stmt.type]?.()
  }
}

function processCreateTable(ctx: ProjectContext, stmt: ParsedStatement, file: string): void {
  const { relation, tableElts = [] } = stmt.node
  if (!relation?.relname) return

  const schema = relation.schemaname ?? 'public'
  const fullName = `${schema}.${relation.relname}`

  let hasPk = false
  const columns: ColumnInfo[] = []
  const foreignKeys: ForeignKeyInfo[] = []

  for (const elt of tableElts) {
    if (elt.ColumnDef) {
      columns.push({
        name: elt.ColumnDef.colname,
        type: elt.ColumnDef.typeName?.names?.map((n: any) => n.String?.sval).join('.') ?? 'unknown',
        nullable: !elt.ColumnDef.constraints?.some((c: any) => c.Constraint?.contype === 'CONSTR_NOTNULL'),
      })

      for (const c of elt.ColumnDef.constraints ?? []) {
        if (c.Constraint?.contype === 'CONSTR_PRIMARY') hasPk = true
        if (c.Constraint?.contype === 'CONSTR_FOREIGN') {
          foreignKeys.push({
            columns: [elt.ColumnDef.colname],
            refTable: c.Constraint.pktable?.relname ?? 'unknown',
            refColumns: c.Constraint.pk_attrs?.map((a: any) => a.String?.sval) ?? [],
          })
        }
      }
    }

    if (elt.Constraint?.contype === 'CONSTR_PRIMARY') hasPk = true
    if (elt.Constraint?.contype === 'CONSTR_FOREIGN') {
      foreignKeys.push({
        columns: elt.Constraint.fk_attrs?.map((a: any) => a.String?.sval) ?? [],
        refTable: elt.Constraint.pktable?.relname ?? 'unknown',
        refColumns: elt.Constraint.pk_attrs?.map((a: any) => a.String?.sval) ?? [],
      })
    }
  }

  ctx.tables.set(fullName, { name: relation.relname, schema, hasPrimaryKey: hasPk, hasRls: false, columns, foreignKeys, file, line: stmt.line })
}

function processAlterTable(ctx: ProjectContext, stmt: ParsedStatement, file: string): void {
  const { relation, cmds = [] } = stmt.node
  if (!relation?.relname) return

  const schema = relation.schemaname ?? 'public'
  const fullName = `${schema}.${relation.relname}`
  const table = ctx.tables.get(fullName)

  for (const cmd of cmds) {
    const subtype = cmd.AlterTableCmd?.subtype

    if (subtype === 'AT_EnableRowSecurity') {
      if (table) table.hasRls = true
      else ctx.tables.set(fullName, { name: relation.relname, schema, hasPrimaryKey: true, hasRls: true, columns: [], foreignKeys: [], file, line: stmt.line })
    }

    if (subtype === 'AT_DisableRowSecurity' && table) table.hasRls = false

    if (cmd.AlterTableCmd?.def?.Constraint?.contype === 'CONSTR_FOREIGN' && table) {
      const c = cmd.AlterTableCmd.def.Constraint
      table.foreignKeys.push({
        columns: c.fk_attrs?.map((a: any) => a.String?.sval) ?? [],
        refTable: c.pktable?.relname ?? 'unknown',
        refColumns: c.pk_attrs?.map((a: any) => a.String?.sval) ?? [],
      })
    }
  }
}

function processCreateIndex(ctx: ProjectContext, stmt: ParsedStatement, file: string): void {
  const { idxname, relation, indexParams = [], unique } = stmt.node
  if (!relation?.relname || !idxname) return

  const fullTable = `${relation.schemaname ?? 'public'}.${relation.relname}`
  const columns = indexParams.map((p: any) => p.IndexElem?.name).filter(Boolean)

  const arr = ctx.indexes.get(fullTable) ?? []
  arr.push({ name: idxname, table: fullTable, columns, unique: unique === true, file, line: stmt.line })
  ctx.indexes.set(fullTable, arr)
}

function processCreatePolicy(ctx: ProjectContext, stmt: ParsedStatement, file: string): void {
  const { policy_name, table, cmd_name, permissive, roles = [] } = stmt.node
  if (!table?.relname || !policy_name) return

  const fullTable = `${table.schemaname ?? 'public'}.${table.relname}`
  const arr = ctx.policies.get(fullTable) ?? []
  arr.push({
    name: policy_name,
    table: fullTable,
    command: (cmd_name ?? 'all').toUpperCase(),
    permissive: permissive !== false,
    roles: roles.map((r: any) => r.RoleSpec?.rolename ?? 'public'),
    file,
    line: stmt.line,
  })
  ctx.policies.set(fullTable, arr)
}

function processCreateView(ctx: ProjectContext, stmt: ParsedStatement, file: string): void {
  const { view, options = [] } = stmt.node
  if (!view?.relname) return

  const schema = view.schemaname ?? 'public'
  const fullName = `${schema}.${view.relname}`
  const securityInvoker = options.some((o: any) =>
    o.DefElem?.defname === 'security_invoker' && ['true', '1', 'yes', 'on'].includes(o.DefElem?.arg?.String?.sval?.toLowerCase())
  )
  const raw = stmt.raw.toLowerCase()
  const referencesAuthUsers = raw.includes('auth.users') || raw.includes('"auth"."users"')

  ctx.views.set(fullName, { name: view.relname, schema, securityInvoker, referencesAuthUsers, file, line: stmt.line })
}

function processCreateFunction(ctx: ProjectContext, stmt: ParsedStatement, file: string): void {
  const { funcname = [], options = [] } = stmt.node
  const name = funcname.map((n: any) => n.String?.sval).filter(Boolean).join('.') || 'unknown'

  const securityDefiner = options.some((o: any) => o.DefElem?.defname === 'security' && o.DefElem?.arg?.String?.sval === 'definer')
  const hasSearchPath = options.some((o: any) => o.DefElem?.defname === 'set' && o.DefElem?.arg?.VariableSetStmt?.name === 'search_path')

  ctx.functions.set(name, { name, schema: 'public', securityDefiner, hasSearchPath, file, line: stmt.line })
}

function processDropStmt(ctx: ProjectContext, stmt: ParsedStatement): void {
  const { objects = [], removeType } = stmt.node
  for (const obj of objects) {
    const name = obj.List?.items?.[0]?.String?.sval
    if (name && removeType === 'OBJECT_TABLE') ctx.tables.delete(`public.${name}`)
  }
}
