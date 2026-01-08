import { readFile } from 'fs/promises'
import { parseSQL } from '../parser/sql.js'
import type { ParsedStatement } from './types.js'

export interface CachedFile {
  path: string
  content: string
  statements: ParsedStatement[]
  lineMap: number[]
  inlineDisables: Map<number, Set<string>>
  fileWideDisables: Set<string>
}

const fileCache = new Map<string, CachedFile>()

export async function getOrParseFile(filePath: string): Promise<CachedFile> {
  const existing = fileCache.get(filePath)
  if (existing) return existing

  const content = await readFile(filePath, 'utf-8')
  const statements = await parseSQL(content)
  const lineMap = buildLineMap(content)
  const { inlineDisables, fileWideDisables } = parseDisableComments(content)

  const cached: CachedFile = { path: filePath, content, statements, lineMap, inlineDisables, fileWideDisables }
  fileCache.set(filePath, cached)
  return cached
}

export async function parseFiles(filePaths: string[], concurrency = 10): Promise<CachedFile[]> {
  const results: CachedFile[] = []
  for (let i = 0; i < filePaths.length; i += concurrency) {
    const batch = filePaths.slice(i, i + concurrency)
    const batchResults = await Promise.all(batch.map(getOrParseFile))
    results.push(...batchResults)
  }
  return results
}

export function clearCache(): void {
  fileCache.clear()
}

function buildLineMap(content: string): number[] {
  const lineMap: number[] = [0]
  let offset = 0
  for (const char of content) {
    offset++
    if (char === '\n') lineMap.push(offset)
  }
  return lineMap
}

export function getLineNumber(lineMap: number[], offset: number): number {
  let low = 0, high = lineMap.length - 1
  while (low < high) {
    const mid = Math.floor((low + high + 1) / 2)
    if (lineMap[mid] <= offset) low = mid
    else high = mid - 1
  }
  return low + 1
}

function parseDisableComments(source: string) {
  const inlineDisables = new Map<number, Set<string>>()
  const fileWideDisables = new Set<string>()
  const lines = source.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    const nextLineMatch = line.match(/--\s*supavisor-disable-next-line\s+(.+)/i)
    if (nextLineMatch) {
      const rules = nextLineMatch[1].split(',').map(r => r.trim())
      const targetLine = i + 2
      const existing = inlineDisables.get(targetLine) ?? new Set()
      rules.forEach(r => existing.add(r))
      inlineDisables.set(targetLine, existing)
      continue
    }

    if (i < 10) {
      const fileMatch = line.match(/--\s*supavisor-disable\s+(.+)/i)
      if (fileMatch && !line.includes('-next-line')) {
        fileMatch[1].split(',').map(r => r.trim()).forEach(r => fileWideDisables.add(r))
      }
    }
  }

  return { inlineDisables, fileWideDisables }
}

export function isIgnoredByCache(
  cached: CachedFile,
  ruleId: string,
  line?: number,
  objectName?: string
): boolean {
  if (cached.fileWideDisables.has(ruleId) || cached.fileWideDisables.has('*')) return true

  if (line) {
    const lineDisables = cached.inlineDisables.get(line)
    if (lineDisables?.has(ruleId) || lineDisables?.has('*')) return true
  }

  if (objectName) {
    const lines = cached.content.split('\n')
    const normalizedName = objectName.toLowerCase().split('.').pop() ?? ''

    for (let i = 0; i < lines.length; i++) {
      const lineLower = lines[i].toLowerCase()
      if (lineLower.includes('create') && lineLower.includes(normalizedName)) {
        for (let j = i - 1; j >= Math.max(0, i - 3); j--) {
          const prevLine = lines[j]
          const match = prevLine.match(/--\s*supavisor-disable-next-line\s+(.+)/i)
          if (match) {
            const rules = match[1].split(',').map(r => r.trim())
            if (rules.includes(ruleId) || rules.includes('*')) return true
          }
          if (prevLine.trim() && !prevLine.trim().startsWith('--')) break
        }
        break
      }
    }
  }

  return false
}
