import { describe, it, expect } from 'vitest'
import { checkSessionGuard, formatGuardStatus } from '../src/session-guard.js'

describe('checkSessionGuard', () => {
  it('returns ok level for empty project', async () => {
    const status = await checkSessionGuard(undefined, 200_000)
    expect(status.level).toBe('ok')
    expect(status.totalTokens).toBeGreaterThan(0)
    expect(status.percentUsed).toBeLessThan(100)
  })

  it('calculates percent used correctly', async () => {
    const status = await checkSessionGuard(undefined, 1_000_000)
    expect(status.percentUsed).toBeGreaterThanOrEqual(0)
    expect(status.modelContext).toBe(1_000_000)
  })

  it('returns critical when context exceeds 80%', async () => {
    const status = await checkSessionGuard(undefined, 10_000)
    expect(status.level).toBe('critical')
  })
})

describe('formatGuardStatus', () => {
  it('includes percentage', async () => {
    const status = await checkSessionGuard(undefined, 200_000)
    const output = formatGuardStatus(status)
    expect(output).toContain('%')
  })

  it('shows warning emoji for warning level', async () => {
    const status = await checkSessionGuard(undefined, 15_000)
    const output = formatGuardStatus(status)
    if (status.level === 'warning') {
      expect(output).toContain('⚠')
    }
  })
})
