import { describe, it, expect } from 'vitest'
import { computeBudgetStatus, formatBudgetStatus } from '../src/budget.js'
import type { ProjectSummary } from '../src/types.js'

function mockProject(name: string, cost: number): ProjectSummary {
  return {
    project: name,
    projectPath: `/projects/${name}`,
    sessions: [],
    totalCostUSD: cost,
    totalSavingsUSD: 0,
    totalApiCalls: 0,
    totalProxiedCostUSD: 0,
  }
}

describe('computeBudgetStatus', () => {
  it('returns null when budget is undefined', () => {
    const status = computeBudgetStatus([mockProject('a', 50)], undefined)
    expect(status).toBeNull()
  })

  it('returns null when budget is disabled', () => {
    const status = computeBudgetStatus([mockProject('a', 50)], { monthlyUsd: 100, alertAtPercent: 80, enabled: false })
    expect(status).toBeNull()
  })

  it('calculates percent used correctly', () => {
    const status = computeBudgetStatus([mockProject('a', 50)], { monthlyUsd: 100, alertAtPercent: 80, enabled: true })
    expect(status).not.toBeNull()
    expect(status!.percentUsed).toBe(50)
    expect(status!.remainingUsd).toBe(50)
    expect(status!.exceeded).toBe(false)
    expect(status!.alerting).toBe(false)
  })

  it('flags alerting when percent >= threshold', () => {
    const status = computeBudgetStatus([mockProject('a', 80)], { monthlyUsd: 100, alertAtPercent: 80, enabled: true })
    expect(status!.alerting).toBe(true)
    expect(status!.exceeded).toBe(false)
  })

  it('flags exceeded when over budget', () => {
    const status = computeBudgetStatus([mockProject('a', 120)], { monthlyUsd: 100, alertAtPercent: 80, enabled: true })
    expect(status!.exceeded).toBe(true)
    expect(status!.alerting).toBe(true)
  })

  it('aggregates costs across multiple projects', () => {
    const status = computeBudgetStatus(
      [mockProject('a', 30), mockProject('b', 40)],
      { monthlyUsd: 100, alertAtPercent: 80, enabled: true },
    )
    expect(status!.spentUsd).toBe(70)
    expect(status!.percentUsed).toBe(70)
  })
})

describe('formatBudgetStatus', () => {
  it('includes budget and spent amounts', () => {
    const status = computeBudgetStatus([mockProject('a', 50)], { monthlyUsd: 100, alertAtPercent: 80, enabled: true })!
    const output = formatBudgetStatus(status)
    expect(output).toContain('100')
    expect(output).toContain('50')
  })

  it('warns when over budget', () => {
    const status = computeBudgetStatus([mockProject('a', 120)], { monthlyUsd: 100, alertAtPercent: 80, enabled: true })!
    const output = formatBudgetStatus(status)
    expect(output).toContain('OVER BUDGET')
  })

  it('warns when approaching budget', () => {
    const status = computeBudgetStatus([mockProject('a', 85)], { monthlyUsd: 100, alertAtPercent: 80, enabled: true })!
    const output = formatBudgetStatus(status)
    expect(output).toContain('Approaching')
  })
})
