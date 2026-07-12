import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

import type { ProjectSummary, DateRange } from './types.js'
import { scanAndDetect, type WasteFinding } from './optimize.js'

export type ApplyResult = {
  applied: number
  skipped: number
  fixes: Array<{ title: string; path: string }>
}

export async function applyOptimizeFixes(
  projects: ProjectSummary[],
  periodLabel: string,
  dateRange?: DateRange,
): Promise<ApplyResult> {
  const result: ApplyResult = { applied: 0, skipped: 0, fixes: [] }

  if (projects.length === 0) return result

  const { findings } = await scanAndDetect(projects, dateRange)

  for (const finding of findings) {
    if (finding.fix.type === 'file-content') {
      const dir = join(process.cwd(), '.claude')
      if (!existsSync(dir)) await mkdir(dir, { recursive: true })
      const targetPath = finding.fix.path.startsWith('/')
        ? finding.fix.path
        : join(process.cwd(), finding.fix.path)
      await writeFile(targetPath, finding.fix.content, 'utf-8')
      result.applied++
      result.fixes.push({ title: finding.title, path: targetPath })
    } else {
      result.skipped++
    }
  }

  return result
}
