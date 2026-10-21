import type { MapGenerationRequest, MapPlan } from './types.js'
import { LocalMapPlanner } from './localPlanner.js'
import { parseMapPlan } from './validation.js'

export interface PlanQualityReport {
  readonly score: number
  readonly unreachableNodeIds: readonly string[]
  readonly distinctRoomRoles: number
  readonly loopCount: number
}

/** Scores semantic connectivity and encounter variety without rendering PixiJS geometry. */
export const assessMapPlanQuality = (plan: MapPlan): PlanQualityReport => {
  const nodes = [...plan.areas, ...plan.rooms]
  const ids = new Set(nodes.map((node) => node.id))
  const adjacency = new Map(nodes.map((node) => [node.id, new Set<string>()]))
  for (const connection of plan.connections) {
    if (!ids.has(connection.fromId) || !ids.has(connection.toId)) continue
    adjacency.get(connection.fromId)!.add(connection.toId)
    adjacency.get(connection.toId)!.add(connection.fromId)
  }
  const visited = new Set<string>()
  const queue = ids.has(plan.startArea.targetId) ? [plan.startArea.targetId] : []
  while (queue.length) {
    const id = queue.shift()!
    if (visited.has(id)) continue
    visited.add(id)
    for (const next of adjacency.get(id) ?? []) if (!visited.has(next)) queue.push(next)
  }
  const unreachableNodeIds = nodes.filter((node) => !visited.has(node.id)).map((node) => node.id)
  const distinctRoomRoles = new Set(plan.rooms.map((room) => room.role)).size
  const loopCount = plan.connections.filter((connection) => connection.loop).length
  const branchCount = [...adjacency.values()].filter((neighbors) => neighbors.size >= 3).length
  const score =
    (nodes.length === 0 ? 0 : (visited.size / nodes.length) * 100) +
    distinctRoomRoles * 4 +
    Math.min(loopCount, 3) * 5 +
    Math.min(branchCount, 6) * 2 +
    new Set(plan.storyHooks.map((hook) => hook.kind)).size * 2
  return { score, unreachableNodeIds, distinctRoomRoles, loopCount }
}

/**
 * Compare three reproducible semantic variants. The chosen plan keeps the
 * requested seed so all later layout/rendering randomness remains reproducible.
 */
export const chooseBestLocalPlan = (
  request: MapGenerationRequest,
  planner: LocalMapPlanner = new LocalMapPlanner(),
): MapPlan => {
  if (request.seed === undefined) throw new Error('Quality selection needs an explicit seed.')
  const seed = request.seed
  // Fix the original randomly selected map type/size. Otherwise the quality
  // score would favor dungeons over outdoor maps simply because they have rooms.
  const initial = parseMapPlan(planner.plan(request))
  const candidates = [seed, (seed ^ 0x9e3779b9) >>> 0, (seed ^ 0x85ebca6b) >>> 0]
  let best: MapPlan | undefined
  let bestScore = -Infinity
  for (const candidateSeed of candidates) {
    const plan = candidateSeed === seed ? initial : parseMapPlan(planner.plan({
      ...request,
      mapType: request.mapType ?? initial.theme.mapType,
      size: request.size ?? initial.dimensions.size,
      seed: candidateSeed,
    }))
    const report = assessMapPlanQuality(plan)
    const score = report.unreachableNodeIds.length ? -Infinity : report.score
    if (!best || score > bestScore) {
      best = plan
      bestScore = score
    }
  }
  // Rebase purely semantic choices to the user's canonical reproducibility seed.
  return parseMapPlan({ ...best!, id: `local-plan-${seed >>> 0}`, seed })
}
