import { estimateContextBudget } from './context-budget.js'

export type GuardLevel = 'ok' | 'warning' | 'critical'

export type SessionGuardStatus = {
  level: GuardLevel
  totalTokens: number
  modelContext: number
  percentUsed: number
  warnings: string[]
  suggestions: string[]
}

const WARNING_THRESHOLD = 0.6
const CRITICAL_THRESHOLD = 0.8

export async function checkSessionGuard(
  projectPath: string | undefined,
  modelContext: number = 200_000,
): Promise<SessionGuardStatus> {
  const budget = await estimateContextBudget(projectPath, modelContext)
  const percentUsed = budget.total / budget.modelContext
  const warnings: string[] = []
  const suggestions: string[] = []

  let level: GuardLevel = 'ok'
  if (percentUsed >= CRITICAL_THRESHOLD) {
    level = 'critical'
  } else if (percentUsed >= WARNING_THRESHOLD) {
    level = 'warning'
  }

  if (budget.mcpTools.count > 5) {
    warnings.push(`${budget.mcpTools.count} MCP tools loaded (${budget.mcpTools.tokens} tokens)`)
    suggestions.push('Scope MCP tools to only those used in this project')
  }

  if (budget.skills.count > 3) {
    warnings.push(`${budget.skills.count} skills loaded (${budget.skills.tokens} tokens)`)
    suggestions.push('Remove unused skills from .claude/skills/')
  }

  if (budget.memory.tokens > 5000) {
    warnings.push(`Memory files consume ${budget.memory.tokens} tokens`)
    suggestions.push('Trim CLAUDE.md files or split into smaller chunks')
  }

  return {
    level,
    totalTokens: budget.total,
    modelContext,
    percentUsed: Math.round(percentUsed * 1000) / 10,
    warnings,
    suggestions,
  }
}

export function formatGuardStatus(status: SessionGuardStatus): string {
  const lines: string[] = []
  const pct = status.percentUsed

  if (status.level === 'ok') {
    lines.push(`  Context: ${pct}% of ${status.modelContext.toLocaleString()} tokens ✓`)
  } else if (status.level === 'warning') {
    lines.push(`  Context: ${pct}% of ${status.modelContext.toLocaleString()} tokens ⚠`)
  } else {
    lines.push(`  Context: ${pct}% of ${status.modelContext.toLocaleString()} tokens ✗`)
  }

  for (const w of status.warnings) {
    lines.push(`    ⚠ ${w}`)
  }
  for (const s of status.suggestions) {
    lines.push(`    → ${s}`)
  }

  return lines.join('\n')
}
