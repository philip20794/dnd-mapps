import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createKiApiBridge, KiApiBridgeError } from './kiApiBridge.mjs'

const input = {
  request: { seed: 42, mapType: 'dungeon', description: 'Ein Zwergentempel' },
  context: { rooms: [{ id: 'room-1', role: 'entry' }, { id: 'room-2', role: 'chamber' }] },
}
const design = {
  name: 'Zwergentempel', brief: 'Ein geheimnisvoller Zwergentempel',
  mapType: 'dungeon', biome: 'underground', settlement: 'temple', water: 'none',
  atmosphere: 'dark', terrain: 'flat', archetype: 'branching-delves',
  structure: 'branching', landmarkKind: 'altar', storyHookKind: 'ritual',
  sceneFeatureKind: 'ritual-site', roomRoles: [{ id: 'room-2', role: 'sanctum' }],
}
test('server-side ki-api bridge uses Chat Completions tool calling, never exposes the key', async () => {
  let body
  let authorization
  const bridge = createKiApiBridge({
    baseUrl: 'http://127.0.0.1:3100',
    apiKey: 'private-secret',
    fetcher: async (_url, options) => {
      body = JSON.parse(options.body)
      authorization = options.headers.Authorization
      return new Response(JSON.stringify({
        choices: [{ message: { tool_calls: [{
          type: 'function', function: { name: 'propose_map_design', arguments: JSON.stringify(design) },
        }] } }],
      }), { status: 200 })
    },
  })
  assert.deepEqual(await bridge.propose(input), { design })
  assert.equal(body.model, 'ki-api-chat')
  assert.deepEqual(body.reasoning, { effort: 'medium' })
  assert.equal(body.tool_choice.function.name, 'propose_map_design')
  assert.equal(authorization, 'Bearer private-secret')
  assert.equal(JSON.stringify(body).includes('private-secret'), false)
})

test('rejects unknown room ids and invalid / missing model output', async () => {
  const bridge = createKiApiBridge({
    baseUrl: 'http://127.0.0.1:3100',
    apiKey: 'secret',
    fetcher: async () => new Response(JSON.stringify({
      choices: [{ message: { tool_calls: [{
        type: 'function',
        function: { name: 'propose_map_design', arguments: JSON.stringify({
          ...design, roomRoles: [{ id: 'unknown', role: 'boss' }],
        }) },
      }] } }],
    })),
  })
  await assert.rejects(() => bridge.propose(input), (error) =>
    error instanceof KiApiBridgeError && error.status === 502)
  await assert.rejects(() => bridge.propose({ request: {}, context: {} }), (error) =>
    error instanceof KiApiBridgeError && error.status === 400)
})

test('responds safely to unavailable API', async () => {
  const bridge = createKiApiBridge({
    baseUrl: 'http://127.0.0.1:3100',
    apiKey: 'secret',
    fetcher: async () => { throw new Error('offline') },
  })
  await assert.rejects(() => bridge.propose(input), (error) =>
    error instanceof KiApiBridgeError && error.status === 503)
})
