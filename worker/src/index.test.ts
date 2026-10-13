import { describe, expect, it } from 'vitest'
import type { WorkerEnv } from './config.js'
import { handleWorkerRequest } from './index.js'

const env = (overrides: Partial<WorkerEnv> = {}): WorkerEnv => ({
  ALLOWED_ORIGINS: 'https://dnd-mapps.web.app,http://localhost:5173',
  ...overrides,
})

describe('Cloudflare Worker HTTP boundary', () => {
  it('liefert Health ohne Secrets auszugeben', async () => {
    const response = await handleWorkerRequest(
      new Request('https://worker.example/api/health'),
      env({ OPENAI_API_KEY: 'must-not-leak' }),
      new Date('2026-09-28T12:00:00.000Z'),
    )
    expect(response.status).toBe(200)
    const body = await response.text()
    expect(body).toContain('"aiConfigured":true')
    expect(body).not.toContain('must-not-leak')
  })

  it('setzt CORS nur für erlaubte Origins', async () => {
    const allowed = await handleWorkerRequest(
      new Request('https://worker.example/api/health', {
        headers: { Origin: 'https://dnd-mapps.web.app' },
      }),
      env(),
    )
    const denied = await handleWorkerRequest(
      new Request('https://worker.example/api/health', {
        headers: { Origin: 'https://evil.example' },
      }),
      env(),
    )
    expect(allowed.headers.get('Access-Control-Allow-Origin')).toBe('https://dnd-mapps.web.app')
    expect(allowed.headers.get('Vary')).toBe('Origin')
    expect(denied.status).toBe(403)
    expect(denied.headers.get('Access-Control-Allow-Origin')).toBeNull()
  })

  it('beantwortet erlaubte Preflight-Anfragen', async () => {
    const response = await handleWorkerRequest(
      new Request('https://worker.example/api/map-plan', {
        method: 'OPTIONS',
        headers: {
          Origin: 'http://localhost:5173',
          'Access-Control-Request-Method': 'POST',
        },
      }),
      env(),
    )
    expect(response.status).toBe(204)
    expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST')
  })

  it('antwortet bei Worker-Rate-Limit mit 429', async () => {
    const response = await handleWorkerRequest(
      new Request('https://worker.example/api/map-plan', {
        method: 'POST',
        headers: { Origin: 'http://localhost:5173', 'Content-Type': 'application/json' },
        body: '{}',
      }),
      env({ AI_RATE_LIMITER: { limit: async () => ({ success: false }) } }),
    )
    expect(response.status).toBe(429)
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'WORKER_RATE_LIMITED' },
    })
  })

  it('liefert ohne OpenAI-Key einen validen lokalen Fallback', async () => {
    const response = await handleWorkerRequest(
      new Request('https://worker.example/api/map-plan', {
        method: 'POST',
        headers: { Origin: 'http://localhost:5173', 'Content-Type': 'application/json' },
        body: JSON.stringify({ seed: 123, mapType: 'outdoor' }),
      }),
      env(),
    )
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      source: 'local-fallback',
      debug: { fallbackReason: 'not-configured', seed: 123 },
    })
  })

  it('weist zu große Requests vor der Planung zurück', async () => {
    const response = await handleWorkerRequest(
      new Request('https://worker.example/api/map-plan', {
        method: 'POST',
        headers: { Origin: 'http://localhost:5173', 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: 'x'.repeat(33_000) }),
      }),
      env(),
    )
    expect(response.status).toBe(413)
  })
})
