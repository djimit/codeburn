import { mkdir, open, rename, unlink, stat } from 'fs/promises'
import { existsSync } from 'fs'
import { join, dirname } from 'path'
import { randomBytes } from 'crypto'

const LOCK_SUFFIX = '.lock'
const LOCK_STALE_MS = 30_000

export async function withFileLock<T>(filePath: string, fn: () => Promise<T>): Promise<T> {
  const lockPath = filePath + LOCK_SUFFIX
  const dir = dirname(lockPath)
  if (!existsSync(dir)) await mkdir(dir, { recursive: true })

  const token = randomBytes(16).toString('hex')
  const tempLock = `${lockPath}.${token}.tmp`

  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      const handle = await open(tempLock, 'wx', 0o600)
      await handle.close()
      await rename(tempLock, lockPath)
      try {
        return await fn()
      } finally {
        await releaseLock(lockPath, tempLock)
      }
    } catch {
      await waitForLockRelease(lockPath)
    }
  }

  try {
    return await fn()
  } finally {
    await releaseLock(lockPath, tempLock).catch(() => {})
  }
}

async function releaseLock(lockPath: string, tempLock: string): Promise<void> {
  try { await unlink(lockPath) } catch { /* ignore */ }
  try { await unlink(tempLock) } catch { /* ignore */ }
}

async function waitForLockRelease(lockPath: string): Promise<void> {
  try {
    const s = await stat(lockPath)
    if (Date.now() - s.mtimeMs > LOCK_STALE_MS) {
      await unlink(lockPath).catch(() => {})
      return
    }
  } catch { /* lock gone */ }
  await new Promise(r => setTimeout(r, 50))
}
