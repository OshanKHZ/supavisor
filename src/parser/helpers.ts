export function getNodeType(node: any): string {
  return Object.keys(node)[0]
}

export function findNodes(node: any, type: string): any[] {
  const results: any[] = []

  function traverse(obj: any) {
    if (!obj || typeof obj !== 'object') return
    if (Array.isArray(obj)) {
      obj.forEach(traverse)
      return
    }
    if (type in obj) results.push(obj[type])
    Object.values(obj).forEach(traverse)
  }

  traverse(node)
  return results
}

export function getTableName(node: any): string | null {
  if (!node?.relation?.relname) return null
  const { schemaname, relname } = node.relation
  return schemaname ? `${schemaname}.${relname}` : relname
}

export function getColumnNames(node: any): string[] {
  return (node?.tableElts ?? [])
    .filter((elt: any) => elt.ColumnDef?.colname)
    .map((elt: any) => elt.ColumnDef.colname)
}

export function getFunctionName(node: any): string | null {
  if (!node?.funcname) return null
  return node.funcname.map((p: any) => p.String?.sval ?? p.str).filter(Boolean).join('.')
}

export function getViewName(node: any): string | null {
  if (!node?.view?.relname) return null
  const { schemaname, relname } = node.view
  return schemaname ? `${schemaname}.${relname}` : relname
}

export function referencesAuthUsers(node: any): boolean {
  const str = JSON.stringify(node).toLowerCase()
  return str.includes('"schemaname":"auth"') && str.includes('"relname":"users"')
}

export function containsPattern(node: any, pattern: RegExp): boolean {
  return pattern.test(JSON.stringify(node))
}
