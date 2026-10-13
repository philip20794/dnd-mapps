const normalizedBaseUrl = (baseUrl: string | undefined): string =>
  baseUrl?.trim().replace(/\/$/, '') ?? ''

/** Resolves the public Worker endpoint without ever reading server-side secrets. */
export const aiApiUrl = (
  path: `/api/${string}`,
  baseUrl: string | undefined = import.meta.env.VITE_AI_API_BASE_URL,
): string => {
  const base = normalizedBaseUrl(baseUrl)
  return base ? `${base}${path}` : path
}
