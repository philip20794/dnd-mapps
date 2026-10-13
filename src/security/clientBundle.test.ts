import { build, type Rollup } from 'vite'
import { describe, expect, it } from 'vitest'

const outputText = (outputs: Rollup.RollupOutput | Rollup.RollupOutput[]): string =>
  (Array.isArray(outputs) ? outputs : [outputs])
    .flatMap((output) => output.output)
    .map((item) => ('code' in item ? item.code : typeof item.source === 'string' ? item.source : ''))
    .join('\n')

describe('Client-Bundle-Sicherheit', () => {
  it('bundelt keine serverseitigen OpenAI-Secrets oder Secret-Namen', async () => {
    const apiSentinel = 'sk-client-bundle-must-not-contain-this'
    const adminSentinel = 'admin-client-bundle-must-not-contain-this'
    process.env.OPENAI_API_KEY = apiSentinel
    process.env.OPENAI_ADMIN_KEY = adminSentinel
    try {
      const output = await build({ logLevel: 'silent', build: { write: false } })
      if (!('output' in output) && !Array.isArray(output)) throw new Error('Unerwarteter Watch-Build.')
      const text = outputText(output as Rollup.RollupOutput | Rollup.RollupOutput[])
      expect(text).not.toContain(apiSentinel)
      expect(text).not.toContain(adminSentinel)
      expect(text).not.toContain('OPENAI_API_KEY')
      expect(text).not.toContain('OPENAI_ADMIN_KEY')
    } finally {
      delete process.env.OPENAI_API_KEY
      delete process.env.OPENAI_ADMIN_KEY
    }
  }, 30_000)
})
