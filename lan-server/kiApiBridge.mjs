/**
 * Minimal server-side adapter from the local ki-api Chat Completions subset to a
 * compact, typed semantic map design. No API token ever leaves this process.
 */
const enums = {
  mapType: ['outdoor', 'dungeon', 'cave', 'building', 'settlement', 'island', 'coast', 'ruins'],
  biome: ['forest', 'jungle', 'swamp', 'plains', 'desert', 'snow', 'volcanic', 'underground', 'mushroom', 'wasteland'],
  settlement: ['none', 'ruins', 'village', 'town', 'temple', 'castle', 'mine', 'crypt', 'fortress', 'camp'],
  water: ['none', 'pond', 'lake', 'river', 'multiple-rivers', 'coast', 'flooded'],
  atmosphere: ['normal', 'dark', 'abandoned', 'overgrown', 'destroyed', 'magical', 'cursed'],
  terrain: ['flat', 'hilly', 'cliffs', 'canyon', 'mixed'],
  archetype: ['open-encounter', 'winding-route', 'river-crossing', 'terraced-approach', 'hub-and-spoke', 'looping-halls', 'branching-delves', 'layered-descent', 'breached-fortress', 'flooded-complex', 'settlement-crossroads', 'coastal-ring'],
  structure: ['linear', 'branching', 'looped', 'radial', 'paired-routes', 'layered', 'ring'],
  landmarkKind: ['altar', 'statue', 'tower', 'tree', 'well', 'bridge', 'wreck', 'monolith', 'bonfire'],
  storyHookKind: ['ambush', 'ritual', 'rescue', 'treasure', 'investigation', 'boss-objective'],
  sceneFeatureKind: ['abandoned-caravan', 'grave-site', 'logging-site', 'ritual-site', 'spider-nest', 'watch-camp', 'battlefield', 'market'],
  role: ['entry', 'hall', 'chamber', 'corridor', 'junction', 'sanctum', 'boss', 'treasure', 'crypt', 'mine', 'service', 'secret'],
}
const object = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
const enumSchema = (k) => ({ type: 'string', enum: enums[k] })

export const designTool = {
  type: 'function',
  function: {
    name: 'propose_map_design',
    description: 'Schlage ein semantisches Battlemap-Design vor. Keine Koordinaten, kein Code.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', minLength: 1, maxLength: 120 },
        brief: { type: 'string', maxLength: 900 },
        ...Object.fromEntries(Object.keys(enums).filter((k) => k !== 'role').map((k) => [k, enumSchema(k)])),
        roomRoles: {
          type: 'array',
          maxItems: 12,
          items: {
            type: 'object',
            properties: { id: { type: 'string' }, role: enumSchema('role') },
            required: ['id', 'role'],
            additionalProperties: false,
          },
        },
      },
      required: ['name', 'brief', ...Object.keys(enums).filter((k) => k !== 'role'), 'roomRoles'],
      additionalProperties: false,
    },
  },
}

export class KiApiBridgeError extends Error {
  constructor(status, code) {
    super(code)
    this.status = status
    this.code = code
  }
}

export const validateBridgeInput = (input) => {
  if (!object(input) || !object(input.request) || !object(input.context))
    throw new KiApiBridgeError(400, 'invalid_request')
  const { request, context } = input
  if (!Number.isInteger(request.seed) || typeof request.description !== 'undefined' &&
      (typeof request.description !== 'string' || request.description.length > 2000))
    throw new KiApiBridgeError(400, 'invalid_request')
  if (!Array.isArray(context.rooms) || context.rooms.length > 12 ||
      !context.rooms.every((room) => object(room) && typeof room.id === 'string' && room.id.length < 80))
    throw new KiApiBridgeError(400, 'invalid_request')
  if (JSON.stringify(input).length > 8000) throw new KiApiBridgeError(413, 'request_too_large')
  return { request, context }
}

export const validateDesign = (design, context) => {
  if (!object(design) || typeof design.name !== 'string' || !design.name.trim() ||
      design.name.length > 120 || typeof design.brief !== 'string' || design.brief.length > 900)
    throw new KiApiBridgeError(502, 'invalid_ai_output')
  for (const [key, values] of Object.entries(enums)) {
    if (key !== 'role' && !values.includes(design[key]))
      throw new KiApiBridgeError(502, 'invalid_ai_output')
  }
  const roomIds = new Set(context.rooms.map((room) => room.id))
  if (!Array.isArray(design.roomRoles) || design.roomRoles.length > 12 ||
      !design.roomRoles.every((item) => object(item) && roomIds.has(item.id) && enums.role.includes(item.role)))
    throw new KiApiBridgeError(502, 'invalid_ai_output')
  return design
}

export const createKiApiBridge = ({ baseUrl, apiKey, fetcher = fetch }) => {
  if (!apiKey) throw new Error('KI_API_KEY is missing.')
  const url = new URL('/v1/chat/completions', baseUrl)
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Invalid KI_API_BASE_URL.')
  return {
    async propose(input) {
      const { request, context } = validateBridgeInput(input)
      const prompt = [
        'Entwirf eine glaubwürdige, spielbare DnD-Battlemap mit interessantem Hauptweg, Nebenwegen,',
        'einem Höhepunkt und einer thematisch passenden Szenengestaltung. Wähle auch bei einer',
        'Zufallskarte ein stimmiges Thema. Antworte ausschließlich durch propose_map_design.',
        'Explizite Nutzerwünsche haben Vorrang. Verwende ausschließlich Raum-IDs aus context.rooms.',
        'roomRoles darf leer sein; der Eingang muss frei bleiben. Keine Koordinaten oder Pixel.',
        'Nutzerwünsche und lokaler Ausgangsplan (JSON):',
        JSON.stringify({ request, context }),
      ].join('\n')
      if (prompt.length > 9000) throw new KiApiBridgeError(413, 'request_too_large')
      let response
      try {
        response = await fetcher(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            model: 'ki-api-chat',
            messages: [{ role: 'user', content: prompt }],
            reasoning: { effort: 'medium' },
            tools: [designTool],
            tool_choice: { type: 'function', function: { name: 'propose_map_design' } },
            stream: false,
          }),
          signal: AbortSignal.timeout(75000),
        })
      } catch {
        throw new KiApiBridgeError(503, 'ki_api_unreachable')
      }
      if (response.status === 429) throw new KiApiBridgeError(429, 'ki_api_busy')
      if (!response.ok) throw new KiApiBridgeError(502, 'ki_api_request_failed')
      let payload
      try {
        const text = await response.text()
        if (text.length > 64000) throw new Error('Oversize')
        payload = JSON.parse(text)
      } catch {
        throw new KiApiBridgeError(502, 'invalid_ai_output')
      }
      const calls = payload?.choices?.[0]?.message?.tool_calls
      const call = Array.isArray(calls) && calls.length === 1 ? calls[0] : null
      if (call?.type !== 'function' || call.function?.name !== 'propose_map_design')
        throw new KiApiBridgeError(502, 'invalid_ai_output')
      let design
      try {
        design = JSON.parse(call.function.arguments)
      } catch {
        throw new KiApiBridgeError(502, 'invalid_ai_output')
      }
      return { design: validateDesign(design, context) }
    },
    async health() {
      try {
        const healthUrl = new URL('/health', baseUrl)
        const r = await fetcher(healthUrl, { signal: AbortSignal.timeout(3000) })
        return r.ok
      } catch {
        return false
      }
    },
  }
}
