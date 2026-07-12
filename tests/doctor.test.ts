import { describe, it, expect } from 'vitest'
import { runDoctor, formatDoctorReport } from '../src/doctor.js'
import { nodeVersionCheck } from '../src/doctor-checks.js'

describe('nodeVersionCheck', () => {
  it('returns ok for current Node version', () => {
    const result = nodeVersionCheck()
    expect(result.ok).toBe(true)
    expect(result.version).toMatch(/^v\d+/)
  })
})

describe('runDoctor', () => {
  it('returns a report with providers', async () => {
    const report = await runDoctor()
    expect(report).toBeDefined()
    expect(report.providers.length).toBeGreaterThan(0)
    expect(report.node).toBeDefined()
    expect(report.configPath).toContain('config.json')
  })

  it('detects providers without errors', async () => {
    const report = await runDoctor()
    for (const provider of report.providers) {
      expect(provider).toHaveProperty('name')
      expect(provider).toHaveProperty('displayName')
      expect(provider).toHaveProperty('detected')
      expect(provider).toHaveProperty('sessionCount')
    }
  })
})

describe('formatDoctorReport', () => {
  it('formats a report without crashing', async () => {
    const report = await runDoctor()
    const output = formatDoctorReport(report)
    expect(output).toContain('CodeBurn Doctor')
    expect(output).toContain('Node.js')
    expect(output).toContain('Providers:')
  })
})
