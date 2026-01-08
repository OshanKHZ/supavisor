import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import { resolve } from 'path'

export interface IgnoreEntry {
  ruleId: string
  file?: string
  line?: number
}

export async function loadIgnoreFile(cwd = process.cwd()): Promise<IgnoreEntry[]> {
  const ignorePath = resolve(cwd, '.supavisorignore')
  if (!existsSync(ignorePath)) return []

  const content = await readFile(ignorePath, 'utf-8')
  return content
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#'))
    .map(line => {
      const parts = line.split(':')
      const ruleId = parts[0]
      if (parts.length === 1 || parts[1] === '*') return { ruleId }
      if (parts.length === 2) return { ruleId, file: parts[1] }
      return { ruleId, file: parts[1], line: parseInt(parts[2], 10) || undefined }
    })
}

export function parseInlineDisables(source: string): Map<number, Set<string>> {
  const disables = new Map<number, Set<string>>()
  const lines = source.split('\n')
  let fileWideDisables: Set<string> | null = null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const match = line.match(/--\s*supavisor-disable(?:-next-line)?\s+(.+)/i)
    if (!match) continue

    const rules = match[1].split(',').map(r => r.trim())
    const isNextLine = line.includes('disable-next-line')

    if (isNextLine) {
      const targetLine = i + 2
      const existing = disables.get(targetLine) ?? new Set()
      rules.forEach(r => existing.add(r))
      disables.set(targetLine, existing)
    } else {
      if (!fileWideDisables) fileWideDisables = new Set()
      rules.forEach(r => fileWideDisables!.add(r))
    }
  }

  if (fileWideDisables) {
    for (let i = 1; i <= lines.length; i++) {
      const existing = disables.get(i) ?? new Set()
      fileWideDisables.forEach(r => existing.add(r))
      disables.set(i, existing)
    }
  }

  return disables
}
