export type AiProviderErrorKind = 'rate_limit' | 'upstream' | 'invalid_response'

export class AiProviderError extends Error {
  constructor(
    readonly kind: AiProviderErrorKind,
    readonly retryAfterSeconds?: number,
  ) {
    super(kind)
    this.name = 'AiProviderError'
  }
}

export const retryAfterSecondsFrom = (value: string | null | undefined): number | undefined => {
  if (!value) return undefined
  const seconds = Number(value)
  return Number.isFinite(seconds) && seconds >= 0 ? Math.ceil(seconds) : undefined
}
