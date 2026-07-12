import { getAllProviders } from './providers/index.js'
import { readConfig } from './config.js'
import { nodeVersionCheck, type NodeVersionCheck } from './doctor-checks.js'

export type ProviderDiag = {
  name: string
  displayName: string
  detected: boolean
  sessionCount: number
  path?: string
  warnings: string[]
}

export type DoctorReport = {
  node: NodeVersionCheck
  providers: ProviderDiag[]
  configPath: string
}

export async function runDoctor(): Promise<DoctorReport> {
  const providers = await getAllProviders()

  const diagnostics: ProviderDiag[] = []
  for (const provider of providers) {
    const diag: ProviderDiag = {
      name: provider.name,
      displayName: provider.displayName,
      detected: false,
      sessionCount: 0,
      warnings: [],
    }

    try {
      const sessions = await provider.discoverSessions()
      diag.sessionCount = sessions.length
      diag.detected = sessions.length > 0
    } catch (err) {
      diag.warnings.push(err instanceof Error ? err.message : String(err))
    }

    diagnostics.push(diag)
  }

  return {
    node: nodeVersionCheck(),
    providers: diagnostics,
    configPath: getConfigDir() + '/config.json',
  }
}

function getConfigDir(): string {
  return process.env['CODEBURN_CONFIG_DIR'] ?? `${process.env['HOME'] ?? '~'}/.config/codeburn`
}

export function formatDoctorReport(report: DoctorReport): string {
  const lines: string[] = []

  lines.push('')
  lines.push('  CodeBurn Doctor')
  lines.push('  ' + '='.repeat(40))
  lines.push('')

  lines.push(`  Node.js: ${report.node.version} ${report.node.ok ? '✓' : '✗ ' + report.node.warning}`)
  lines.push('')

  const detected = report.providers.filter(p => p.detected)
  const undetected = report.providers.filter(p => !p.detected && p.warnings.length === 0)
  const errored = report.providers.filter(p => p.warnings.length > 0)

  lines.push(`  Providers: ${detected.length} detected, ${undetected.length} not found, ${errored.length} errors`)
  lines.push('')

  for (const p of report.providers) {
    const status = p.detected ? '✓' : (p.warnings.length > 0 ? '✗' : '·')
    const detail = p.detected ? `(${p.sessionCount} sessions)` : (p.warnings.length > 0 ? p.warnings[0]! : 'not found')
    lines.push(`  ${status} ${p.displayName.padEnd(20)} ${detail}`)
  }

  lines.push('')
  lines.push(`  Config: ${report.configPath}`)
  lines.push('')

  return lines.join('\n')
}
