import { corsHeaders, isOriginAllowed } from './cors.js'
import { readWorkerAiConfig, type WorkerEnv } from './config.js'
import type { HttpResponse, PublicErrorBody } from './contracts.js'
import { OpenAiMapPlannerProvider, OpenAiUsageProvider } from './openAiProviders.js'
import { MAX_REQUEST_BYTES } from './requestLimits.js'
import { handleAiUsage, handleMapPlan } from './routes.js'

const jsonResponse = (
  request: Request,
  config: ReturnType<typeof readWorkerAiConfig>,
  response: HttpResponse,
): Response =>
  new Response(JSON.stringify(response.body), {
    status: response.status,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json; charset=utf-8',
      ...corsHeaders(request, config),
      ...(response.headers ?? {}),
    },
  })

const publicError = (
  request: Request,
  config: ReturnType<typeof readWorkerAiConfig>,
  status: number,
  code: string,
  message: string,
): Response =>
  jsonResponse(request, config, {
    status,
    body: { error: { code, message } } satisfies PublicErrorBody,
  })

const parseJsonBody = async (request: Request): Promise<unknown> => {
  const declaredLength = Number(request.headers.get('Content-Length') ?? '0')
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES)
    throw new RangeError('request-too-large')
  const text = await request.text()
  if (new TextEncoder().encode(text).byteLength > MAX_REQUEST_BYTES)
    throw new RangeError('request-too-large')
  return text ? (JSON.parse(text) as unknown) : undefined
}

const rateLimitKey = (request: Request): string => {
  const url = new URL(request.url)
  const origin = request.headers.get('Origin') ?? 'no-origin'
  const client = request.headers.get('CF-Connecting-IP') ?? 'unknown-client'
  return `${url.pathname}:${origin}:${client}`
}

const enforceRateLimit = async (request: Request, env: WorkerEnv): Promise<boolean> => {
  if (!env.AI_RATE_LIMITER) return true
  const result = await env.AI_RATE_LIMITER.limit({ key: rateLimitKey(request) })
  return result.success
}

export const handleWorkerRequest = async (
  request: Request,
  env: WorkerEnv,
  now: Date = new Date(),
): Promise<Response> => {
  const config = readWorkerAiConfig(env)
  const url = new URL(request.url)

  if (!isOriginAllowed(request, config))
    return publicError(request, config, 403, 'ORIGIN_NOT_ALLOWED', 'Origin ist nicht erlaubt.')

  if (request.method === 'OPTIONS')
    return new Response(null, { status: 204, headers: corsHeaders(request, config) })

  if (url.pathname === '/api/health') {
    if (request.method !== 'GET')
      return publicError(request, config, 405, 'METHOD_NOT_ALLOWED', 'Für diesen Endpunkt ist GET erforderlich.')
    return jsonResponse(request, config, {
      status: 200,
      body: {
        ok: true,
        service: 'dnd-mapps-ai-worker',
        aiConfigured: Boolean(config.apiKey),
        usageConfigured: Boolean(config.adminKey && config.projectId),
        timestampUtc: now.toISOString(),
      },
    })
  }

  if (url.pathname !== '/api/map-plan' && url.pathname !== '/api/ai-usage')
    return publicError(request, config, 404, 'NOT_FOUND', 'Endpunkt nicht gefunden.')

  if (!(await enforceRateLimit(request, env)))
    return publicError(request, config, 429, 'WORKER_RATE_LIMITED', 'Zu viele Anfragen.')

  const usageProvider = config.adminKey ? new OpenAiUsageProvider(config.adminKey) : undefined

  if (url.pathname === '/api/ai-usage')
    return jsonResponse(
      request,
      config,
      await handleAiUsage({ method: request.method }, config, usageProvider, now),
    )

  let body: unknown
  try {
    body = await parseJsonBody(request)
  } catch (error) {
    return publicError(
      request,
      config,
      error instanceof RangeError ? 413 : 400,
      error instanceof RangeError ? 'REQUEST_TOO_LARGE' : 'INVALID_JSON',
      error instanceof RangeError
        ? 'Die Anfrage ist zu groß.'
        : 'Die Anfrage enthält kein gültiges JSON.',
    )
  }
  const plannerProvider = config.apiKey
    ? new OpenAiMapPlannerProvider(config.apiKey, config.projectId)
    : undefined
  return jsonResponse(
    request,
    config,
    await handleMapPlan(
      { method: request.method, body },
      config,
      plannerProvider,
      usageProvider,
      now,
    ),
  )
}

export default {
  fetch(request: Request, env: WorkerEnv) {
    return handleWorkerRequest(request, env)
  },
} satisfies ExportedHandler<WorkerEnv>
