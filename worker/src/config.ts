export interface WorkerEnv {
  readonly OPENAI_API_KEY?: string
  readonly OPENAI_ADMIN_KEY?: string
  readonly OPENAI_PROJECT_ID?: string
  readonly AI_DAILY_BUDGET_USD?: string
  readonly ALLOWED_ORIGINS?: string
  readonly AI_RATE_LIMITER?: RateLimitBinding
}

export interface RateLimitBinding {
  limit(options: { readonly key: string }): Promise<{ readonly success: boolean }>
}

export interface WorkerAiConfig {
  readonly apiKey?: string
  readonly adminKey?: string
  readonly projectId?: string
  readonly dailyBudgetUsd?: number
  readonly allowedOrigins: ReadonlySet<string>
}

const optionalText = (value: string | undefined): string | undefined => value?.trim() || undefined

const optionalPositiveNumber = (value: string | undefined): number | undefined => {
  if (value === undefined || value.trim() === '') return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined
}

export const readWorkerAiConfig = (environment: WorkerEnv): WorkerAiConfig => ({
  apiKey: optionalText(environment.OPENAI_API_KEY),
  adminKey: optionalText(environment.OPENAI_ADMIN_KEY),
  projectId: optionalText(environment.OPENAI_PROJECT_ID),
  dailyBudgetUsd: optionalPositiveNumber(environment.AI_DAILY_BUDGET_USD),
  allowedOrigins: new Set(
    (environment.ALLOWED_ORIGINS ?? '')
      .split(',')
      .map((origin) => origin.trim().replace(/\/$/, ''))
      .filter(Boolean),
  ),
})
