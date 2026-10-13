import type { WorkerAiConfig } from './config.js'

const normalizedOrigin = (request: Request): string | null =>
  request.headers.get('Origin')?.trim().replace(/\/$/, '') || null

export const isOriginAllowed = (request: Request, config: WorkerAiConfig): boolean => {
  const origin = normalizedOrigin(request)
  return origin === null || config.allowedOrigins.has(origin)
}

export const corsHeaders = (
  request: Request,
  config: WorkerAiConfig,
): Readonly<Record<string, string>> => {
  const origin = normalizedOrigin(request)
  if (!origin || !config.allowedOrigins.has(origin)) return { Vary: 'Origin' }
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Accept,Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}
