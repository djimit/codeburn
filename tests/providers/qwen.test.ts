import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, mkdir, writeFile, rm } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'

import { createQwenProvider } from '../../src/providers/qwen.js'
import type { ParsedProviderCall } from '../../src/providers/types.js'

let tmpDir: string

async function createSessionFile(content: string): Promise<string> {
  const dir = join(tmpDir, 'qwen-session')
  await mkdir(dir, { recursive: true })
  const path = join(dir, 'session.jsonl')
  await writeFile(path, content)
  return path
}

describe('qwen provider', () => {
  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'qwen-test-'))
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('parses a basic JSONL session', async () => {
    const lines = [
      JSON.stringify({
        uuid: 'u1',
        sessionId: 'sess-001',
        timestamp: '2026-04-15T10:00:05Z',
        type: 'user',
        cwd: '/home/user/project',
        message: { role: 'user', parts: [{ text: 'write a function' }] },
      }),
      JSON.stringify({
        uuid: 'u2',
        sessionId: 'sess-001',
        timestamp: '2026-04-15T10:00:10Z',
        type: 'assistant',
        model: 'qwen-plus',
        message: { role: 'assistant', parts: [{ text: 'Here is the code' }] },
        usageMetadata: {
          promptTokenCount: 500,
          candidatesTokenCount: 300,
          thoughtsTokenCount: 50,
          totalTokenCount: 850,
          cachedContentTokenCount: 100,
        },
      }),
    ].join('\n')

    const path = await createSessionFile(lines)
    const provider = createQwenProvider()
    const source = { path, project: 'test', provider: 'qwen' }
    const calls: ParsedProviderCall[] = []
    for await (const call of provider.createSessionParser(source, new Set()).parse()) calls.push(call)

    expect(calls).toHaveLength(1)
    expect(calls[0]!.model).toBe('qwen-plus')
    expect(calls[0]!.inputTokens).toBe(500)
    expect(calls[0]!.outputTokens).toBe(300)
    expect(calls[0]!.reasoningTokens).toBe(50)
    expect(calls[0]!.cacheReadInputTokens).toBe(100)
    expect(calls[0]!.costUSD).toBeGreaterThan(0)
  })

  it('maps tool names from functionCall parts', async () => {
    const lines = [
      JSON.stringify({
        uuid: 'u1',
        sessionId: 'sess-002',
        timestamp: '2026-04-15T10:00:05Z',
        type: 'user',
        message: { role: 'user', parts: [{ text: 'read a file' }] },
      }),
      JSON.stringify({
        uuid: 'u2',
        sessionId: 'sess-002',
        timestamp: '2026-04-15T10:00:10Z',
        type: 'assistant',
        model: 'qwen-plus',
        message: {
          role: 'assistant',
          parts: [
            { text: 'Reading...' },
            { functionCall: { name: 'read_file', args: { path: 'test.ts' } } },
            { functionCall: { name: 'execute_command', args: { cmd: 'ls' } } },
          ],
        },
        usageMetadata: {
          promptTokenCount: 200,
          candidatesTokenCount: 100,
          thoughtsTokenCount: 0,
          totalTokenCount: 300,
          cachedContentTokenCount: 0,
        },
      }),
    ].join('\n')

    const path = await createSessionFile(lines)
    const provider = createQwenProvider()
    const source = { path, project: 'test', provider: 'qwen' }
    const calls: ParsedProviderCall[] = []
    for await (const call of provider.createSessionParser(source, new Set()).parse()) calls.push(call)

    expect(calls[0]!.tools).toContain('Read')
    expect(calls[0]!.tools).toContain('Bash')
  })

  it('skips entries without usageMetadata', async () => {
    const lines = [
      JSON.stringify({
        uuid: 'u1',
        sessionId: 'sess-003',
        timestamp: '2026-04-15T10:00:05Z',
        type: 'user',
        message: { role: 'user', parts: [{ text: 'hi' }] },
      }),
      JSON.stringify({
        uuid: 'u2',
        sessionId: 'sess-003',
        timestamp: '2026-04-15T10:00:10Z',
        type: 'assistant',
        model: 'qwen3-coder',
        message: { role: 'assistant', parts: [{ text: 'Hello' }] },
      }),
    ].join('\n')

    const path = await createSessionFile(lines)
    const provider = createQwenProvider()
    const source = { path, project: 'test', provider: 'qwen' }
    const calls: ParsedProviderCall[] = []
    for await (const call of provider.createSessionParser(source, new Set()).parse()) calls.push(call)

    expect(calls).toHaveLength(0)
  })

  it('returns empty for missing file', async () => {
    const provider = createQwenProvider()
    const source = { path: join(tmpDir, 'nonexistent.jsonl'), project: 'test', provider: 'qwen' }
    const calls: ParsedProviderCall[] = []
    for await (const call of provider.createSessionParser(source, new Set()).parse()) calls.push(call)
    expect(calls).toHaveLength(0)
  })

  it('has correct name and displayName', () => {
    const provider = createQwenProvider()
    expect(provider.name).toBe('qwen')
    expect(provider.displayName).toBe('Qwen')
  })
})
