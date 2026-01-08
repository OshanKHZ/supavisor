import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import { resolve } from 'path'
import type { Severity } from '../core/types.js'

export interface SupavisorConfig {
  rules?: Record<string, Severity | 'off'>
  ignore?: string[]
  include?: string[]
}

const CONFIG_FILES = ['.supavisorrc', '.supavisorrc.json', '.supavisorrc.js', 'supavisor.config.json', 'supavisor.config.js']

const DEFAULT_CONFIG: SupavisorConfig = {
  rules: {},
  ignore: ['**/node_modules/**'],
  include: ['supabase/migrations/**/*.sql'],
}

export async function loadConfig(cwd = process.cwd()): Promise<SupavisorConfig> {
  for (const filename of CONFIG_FILES) {
    const filepath = resolve(cwd, filename)
    if (!existsSync(filepath)) continue

    try {
      if (filename.endsWith('.js')) {
        const mod = await import(`file://${filepath}`)
        return mergeConfig(DEFAULT_CONFIG, mod.default ?? mod)
      }
      const parsed = JSON.parse(await readFile(filepath, 'utf-8'))
      return mergeConfig(DEFAULT_CONFIG, parsed)
    } catch {
      // skip invalid config
    }
  }

  const pkgPath = resolve(cwd, 'package.json')
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(await readFile(pkgPath, 'utf-8'))
      if (pkg.supavisor) return mergeConfig(DEFAULT_CONFIG, pkg.supavisor)
    } catch {
      // skip
    }
  }

  return DEFAULT_CONFIG
}

function mergeConfig(base: SupavisorConfig, override: Partial<SupavisorConfig>): SupavisorConfig {
  return {
    rules: { ...base.rules, ...override.rules },
    ignore: override.ignore ?? base.ignore,
    include: override.include ?? base.include,
  }
}

export function defineConfig(config: SupavisorConfig): SupavisorConfig {
  return config
}
