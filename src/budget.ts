import type { ProjectSummary } from './types.js'
import { getCurrency, convertCost, formatCost } from './currency.js'

export type BudgetStatus = {
  enabled: boolean
  monthlyUsd: number
  alertAtPercent: number
  spentUsd: number
  percentUsed: number
  remainingUsd: number
  exceeded: boolean
  alerting: boolean
}

export function computeBudgetStatus(
  projects: ProjectSummary[],
  budget: { monthlyUsd: number; alertAtPercent: number; enabled: boolean } | undefined,
): BudgetStatus | null {
  if (!budget || !budget.enabled) return null

  const totalSpent = projects.reduce((sum, p) => sum + p.totalCostUSD, 0)
  const percentUsed = budget.monthlyUsd > 0 ? (totalSpent / budget.monthlyUsd) * 100 : 0
  const remaining = budget.monthlyUsd - totalSpent

  return {
    enabled: true,
    monthlyUsd: budget.monthlyUsd,
    alertAtPercent: budget.alertAtPercent,
    spentUsd: totalSpent,
    percentUsed: Math.round(percentUsed * 10) / 10,
    remainingUsd: Math.round(remaining * 100) / 100,
    exceeded: totalSpent >= budget.monthlyUsd,
    alerting: percentUsed >= budget.alertAtPercent,
  }
}

export function formatBudgetStatus(status: BudgetStatus): string {
  const { code: currencyCode } = getCurrency()
  const spent = formatCost(status.spentUsd)
  const budget = formatCost(status.monthlyUsd)
  const remaining = formatCost(Math.max(0, status.remainingUsd))

  const lines = [
    '',
    `  Budget: ${budget}/month (${currencyCode})`,
    `  Spent:  ${spent} (${status.percentUsed}%)`,
    `  Remaining: ${remaining}`,
  ]

  if (status.exceeded) {
    lines.push(`  ⚠ OVER BUDGET by ${formatCost(Math.abs(status.remainingUsd))}`)
  } else if (status.alerting) {
    lines.push(`  ⚠ Approaching budget (${status.percentUsed}% >= ${status.alertAtPercent}% threshold)`)
  }

  lines.push('')
  return lines.join('\n')
}
