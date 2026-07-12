export type NodeVersionCheck = {
  version: string
  ok: boolean
  warning?: string
}

export function nodeVersionCheck(): NodeVersionCheck {
  const version = process.version
  const [majorStr] = version.slice(1).split('.')
  const major = parseInt(majorStr ?? '0', 10)

  if (major < 22) {
    return { version, ok: false, warning: `requires Node.js >= 22.13.0` }
  }

  return { version, ok: true }
}
