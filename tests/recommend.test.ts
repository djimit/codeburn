import { describe, it, expect } from 'vitest'
import { recommendModel } from '../src/compare-stats.js'
import type { ModelStats } from '../src/compare-stats.js'

function mockStats(overrides: Partial<ModelStats>): ModelStats {
  return {
    model: 'test',
    calls: 0,
    cost: 0,
    outputTokens: 0,
    inputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    totalTurns: 0,
    editTurns: 0,
    oneShotTurns: 0,
    retries: 0,
    selfCorrections: 0,
    editCost: 0,
    firstSeen: '',
    lastSeen: '',
    ...overrides,
  }
}

describe('recommendModel', () => {
  it('returns null for empty stats', () => {
    expect(recommendModel([])).toBeNull()
  })

  it('returns null when no model meets min edits', () => {
    const stats = [mockStats({ model: 'a', editTurns: 5, oneShotTurns: 5, editCost: 1 })]
    expect(recommendModel(stats, 10)).toBeNull()
  })

  it('recommends the model with best one-shot rate and low cost', () => {
    const stats = [
      mockStats({ model: 'cheap-efficient', editTurns: 50, oneShotTurns: 40, editCost: 5, cost: 10 }),
      mockStats({ model: 'expensive-rare', editTurns: 50, oneShotTurns: 10, editCost: 50, cost: 100 }),
    ]
    const rec = recommendModel(stats, 10)
    expect(rec).not.toBeNull()
    expect(rec!.model).toBe('cheap-efficient')
  })

  it('includes reason with one-shot rate and cost', () => {
    const stats = [
      mockStats({ model: 'claude', editTurns: 100, oneShotTurns: 80, editCost: 10, cost: 20 }),
    ]
    const rec = recommendModel(stats, 10)
    expect(rec!.reason).toContain('one-shot rate')
    expect(rec!.reason).toContain('cost/edit')
  })

  it('scores are between 0 and 1', () => {
    const stats = [
      mockStats({ model: 'a', editTurns: 20, oneShotTurns: 15, editCost: 5, cost: 10 }),
      mockStats({ model: 'b', editTurns: 30, oneShotTurns: 10, editCost: 20, cost: 40 }),
    ]
    const rec = recommendModel(stats, 10)
    expect(rec!.score).toBeGreaterThanOrEqual(0)
    expect(rec!.score).toBeLessThanOrEqual(1)
  })
})
