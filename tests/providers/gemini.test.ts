import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, mkdir, writeFile, rm } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'

import { createGeminiProvider } from '../../src/providers/gemini.js'
import type { ParsedProviderCall } from '../../src/providers/types.js'

let tmpDir: string

async function createSessionFile(sessionId: string, content: string): Promise<string> {
  const dir = join(tmpDir, sessionId)
  await mkdir(dir, { recursive: true })
  const path = join(dir, 'session.jsonl')
  await writeFile(path, content)
  return path
}

describe('gemini provider', () => {
  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'gemini-test-'))
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('parses a basic JSONL session with user and gemini messages', async () => {
    const lines = [
      JSON.stringify({
        sessionId: 'sess-001',
        startTime: '2026-04-15T10:00:00Z',
        projectHash: 'abc123',
      }),
      JSON.stringify({
        id: 'msg-user-1',
        timestamp: '2026-04-15T10:00:05Z',
        type: 'user',
        content: 'write a function',
      }),
      JSON.stringify({
        id: 'msg-gemini-1',
        timestamp: '2026-04-15T10:00:10Z',
        type: 'gemini',
        model: 'gemini-3-pro',
        tokens: { input: 100, output: 200, cached: 50, thoughts: 10 },
        content: 'Here is the function',
      }),
    ].join('\n')

    const path = await createSessionFile('sess-001', lines)
    const provider = createGeminiProvider(tmpDir)
    const source = { path, project: 'test', provider: 'gemini' }
    const calls: ParsedProviderCall[] = []
    for await (const call of provider.createSessionParser(source, new Set()).parse()) calls.push(call)

    expect(calls).toHaveLength(1)
    expect(calls[0]!.model).toBe('gemini-3-pro')
    expect(calls[0]!.inputTokens).toBe(50) // 100 - 50 cached
    expect(calls[0]!.outputTokens).toBe(200)
    expect(calls[0]!.cacheReadInputTokens).toBe(50)
    expect(calls[0]!.reasoningTokens).toBe(10)
    expect(calls[0]!.costUSD).toBeGreaterThan(0)
  })

  it('parses a single JSON session (Gemini CLI <=0.38)', async () => {
    const session = JSON.stringify({
      sessionId: 'sess-002',
      startTime: '2026-04-15T10:00:00Z',
      messages: [
        { id: 'msg-1', timestamp: '2026-04-15T10:00:05Z', type: 'user', content: 'hello' },
        {
          id: 'msg-2',
          timestamp: '2026-04-15T10:00:10Z',
          type: 'gemini',
          model: 'gemini-3-pro',
          tokens: { input: 500, output: 300, cached: 100, thoughts: 0 },
          content: 'Hi there',
        },
      ],
    })

    const path = await createSessionFile('sess-002', session)
    const provider = createGeminiProvider(tmpDir)
    const source = { path, project: 'test', provider: 'gemini' }
    const calls: ParsedProviderCall[] = []
    for await (const call of provider.createSessionParser(source, new Set()).parse()) calls.push(call)

    expect(calls).toHaveLength(1)
    expect(calls[0]!.inputTokens).toBe(400) // 500 - 100 cached
    expect(calls[0]!.outputTokens).toBe(300)
  })

  it('maps tool names from toolCalls', async () => {
    const lines = [
      JSON.stringify({ sessionId: 'sess-003', startTime: '2026-04-15T10:00:00Z' }),
      JSON.stringify({ id: 'u1', timestamp: '2026-04-15T10:00:05Z', type: 'user', content: 'read a file' }),
      JSON.stringify({
        id: 'g1',
        timestamp: '2026-04-15T10:00:10Z',
        type: 'gemini',
        model: 'gemini-3-pro',
        tokens: { input: 100, output: 50, cached: 0, thoughts: 0 },
        content: 'Reading file',
        toolCalls: [
          { id: 'tc-1', name: 'read_file', args: {} },
          { id: 'tc-2', name: 'run_command', args: { command: 'ls -la' } },
        ],
      }),
    ].join('\n')

    const path = await createSessionFile('sess-003', lines)
    const provider = createGeminiProvider(tmpDir)
    const source = { path, project: 'test', provider: 'gemini' }
    const calls: ParsedProviderCall[] = []
    for await (const call of provider.createSessionParser(source, new Set()).parse()) calls.push(call)

    expect(calls[0]!.tools).toContain('Read')
    expect(calls[0]!.tools).toContain('Bash')
    expect(calls[0]!.bashCommands.length).toBeGreaterThan(0)
  })

  it('skips messages with zero tokens', async () => {
    const lines = [
      JSON.stringify({ sessionId: 'sess-004', startTime: '2026-04-15T10:00:00Z' }),
      JSON.stringify({ id: 'u1', timestamp: '2026-04-15T10:00:05Z', type: 'user', content: 'hi' }),
      JSON.stringify({
        id: 'g1',
        timestamp: '2026-04-15T10:00:10Z',
        type: 'gemini',
        model: 'gemini-3-pro',
        tokens: { input: 0, output: 0, cached: 0, thoughts: 0 },
        content: '',
      }),
    ].join('\n')

    const path = await createSessionFile('sess-004', lines)
    const provider = createGeminiProvider(tmpDir)
    const source = { path, project: 'test', provider: 'gemini' }
    const calls: ParsedProviderCall[] = []
    for await (const call of provider.createSessionParser(source, new Set()).parse()) calls.push(call)

    expect(calls).toHaveLength(0)
  })

  it('deduplicates messages across parser runs', async () => {
    const lines = [
      JSON.stringify({ sessionId: 'sess-005', startTime: '2026-04-15T10:00:00Z' }),
      JSON.stringify({ id: 'u1', timestamp: '2026-04-15T10:00:05Z', type: 'user', content: 'hi' }),
      JSON.stringify({
        id: 'g1',
        timestamp: '2026-04-15T10:00:10Z',
        type: 'gemini',
        model: 'gemini-3-pro',
        tokens: { input: 100, output: 50, cached: 0, thoughts: 0 },
        content: 'Hello',
      }),
    ].join('\n')

    const path = await createSessionFile('sess-005', lines)
    const provider = createGeminiProvider(tmpDir)
    const source = { path, project: 'test', provider: 'gemini' }
    const seenKeys = new Set<string>()

    const calls1: ParsedProviderCall[] = []
    for await (const call of provider.createSessionParser(source, seenKeys).parse()) calls1.push(call)

    const calls2: ParsedProviderCall[] = []
    for await (const call of provider.createSessionParser(source, seenKeys).parse()) calls2.push(call)

    expect(calls1).toHaveLength(1)
    expect(calls2).toHaveLength(0)
  })

  it('returns empty for missing file', async () => {
    const provider = createGeminiProvider(tmpDir)
    const source = { path: join(tmpDir, 'nonexistent.jsonl'), project: 'test', provider: 'gemini' }
    const calls: ParsedProviderCall[] = []
    for await (const call of provider.createSessionParser(source, new Set()).parse()) calls.push(call)
    expect(calls).toHaveLength(0)
  })

  it('has correct name and displayName', () => {
    const provider = createGeminiProvider(tmpDir)
    expect(provider.name).toBe('gemini')
    expect(provider.displayName).toBe('Gemini')
  })
})
