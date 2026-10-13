import { createSeededRandom, integer, pick, type Random } from '@/map-generation/random'
import type {
  MapPlan,
  PlanConnectionKind,
  PlanRoomRole,
  PlanScale,
} from '@/map-generation/types'

export type DungeonNodeRole =
  | 'entrance'
  | 'hub'
  | 'corridor-node'
  | 'normal-room'
  | 'hall'
  | 'encounter-room'
  | 'treasure-room'
  | 'secret-room'
  | 'boss-room'
  | 'stairs'
  | 'cave-area'
  | 'flooded-area'

export interface DungeonTopologyNode {
  readonly id: string
  readonly levelId: string
  readonly role: DungeonNodeRole
  readonly scale: PlanScale
  readonly secret: boolean
  readonly sourceId?: string
}

export type DungeonConnectionKind =
  | 'passage'
  | 'cave-passage'
  | 'collapsed-passage'
  | 'secret-passage'
  | 'locked-gate'
  | 'stairs'

export interface DungeonTopologyEdge {
  readonly id: string
  readonly fromId: string
  readonly toId: string
  readonly kind: DungeonConnectionKind
  readonly route: 'main' | 'side' | 'loop'
  readonly secret: boolean
  readonly keyNodeId?: string
}

export interface DungeonTopologyEntrance {
  readonly id: string
  readonly nodeId: string
  readonly levelId: string
}

export interface DungeonTopologyGraph {
  readonly seed: number
  readonly nodes: readonly DungeonTopologyNode[]
  readonly edges: readonly DungeonTopologyEdge[]
  readonly entrances: readonly DungeonTopologyEntrance[]
  readonly objectiveNodeIds: readonly string[]
}

const roleForRoom = (role: PlanRoomRole): DungeonNodeRole => {
  const roles: Partial<Record<PlanRoomRole, DungeonNodeRole>> = {
    entry: 'entrance',
    hall: 'hall',
    corridor: 'corridor-node',
    junction: 'hub',
    boss: 'boss-room',
    treasure: 'treasure-room',
    secret: 'secret-room',
    sanctum: 'encounter-room',
  }
  return roles[role] ?? 'normal-room'
}

const nodeTargetFor = (plan: MapPlan): number => {
  const minimums = { small: 12, medium: 24, large: 40, huge: 80, custom: 24 } as const
  const areaTarget = Math.round((plan.dimensions.width * plan.dimensions.height) / 90)
  return Math.max(
    plan.rooms.length + plan.areas.length,
    plan.dimensions.size === 'custom'
      ? Math.max(12, Math.min(120, areaTarget))
      : minimums[plan.dimensions.size],
  )
}

const connectionKind = (
  kind: PlanConnectionKind,
  secret: boolean,
  cave: boolean,
): DungeonConnectionKind => {
  if (kind === 'stairs' || kind === 'ladder' || kind === 'portal') return 'stairs'
  if (secret) return 'secret-passage'
  return cave || kind === 'tunnel' ? 'cave-passage' : 'passage'
}

const edgeKey = (a: string, b: string): string => [a, b].sort().join('|')

class DisjointSet {
  private readonly parents = new Map<string, string>()

  public constructor(ids: readonly string[]) {
    ids.forEach((id) => this.parents.set(id, id))
  }

  public find(id: string): string {
    const parent = this.parents.get(id) ?? id
    if (parent === id) return id
    const root = this.find(parent)
    this.parents.set(id, root)
    return root
  }

  public union(a: string, b: string): void {
    const left = this.find(a)
    const right = this.find(b)
    if (left !== right) this.parents.set(right, left)
  }
}

const shuffled = <T>(random: Random, values: readonly T[]): T[] => {
  const result = [...values]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = integer(random, 0, index)
    ;[result[index], result[swap]] = [result[swap]!, result[index]!]
  }
  return result
}

const mainPathEdges = (
  nodes: readonly DungeonTopologyNode[],
  edges: readonly DungeonTopologyEdge[],
  startId: string,
  targetId: string,
): ReadonlySet<string> => {
  const adjacency = new Map<string, { nodeId: string; edgeId: string }[]>()
  nodes.forEach((node) => adjacency.set(node.id, []))
  edges.forEach((edge) => {
    adjacency.get(edge.fromId)?.push({ nodeId: edge.toId, edgeId: edge.id })
    adjacency.get(edge.toId)?.push({ nodeId: edge.fromId, edgeId: edge.id })
  })
  const previous = new Map<string, { nodeId: string; edgeId: string }>()
  const queue = [startId]
  const seen = new Set(queue)
  while (queue.length > 0) {
    const current = queue.shift()!
    if (current === targetId) break
    for (const next of adjacency.get(current) ?? []) {
      if (seen.has(next.nodeId)) continue
      seen.add(next.nodeId)
      previous.set(next.nodeId, { nodeId: current, edgeId: next.edgeId })
      queue.push(next.nodeId)
    }
  }
  const result = new Set<string>()
  let cursor = targetId
  while (cursor !== startId) {
    const step = previous.get(cursor)
    if (!step) break
    result.add(step.edgeId)
    cursor = step.nodeId
  }
  return result
}

export const createDungeonTopologyGraph = (plan: MapPlan): DungeonTopologyGraph => {
  const random = createSeededRandom((plan.seed ^ 0x51f15e) >>> 0)
  const cave = plan.theme.mapType === 'cave'
  const levels = plan.levels.length > 0 ? plan.levels : [{ id: 'ground' }]
  const secretTargets = new Set(
    plan.specialFeatures
      .filter((feature) => feature.kind === 'secret-room')
      .map((feature) => feature.targetId)
      .filter((id): id is string => Boolean(id)),
  )
  const nodes: DungeonTopologyNode[] = [
    ...plan.areas.map((area) => ({
      id: area.id,
      levelId: area.levelId,
      role: area.kind === 'flooded-area' ? ('flooded-area' as const) : area.kind === 'cavern' ? ('cave-area' as const) : area.id === plan.startArea.targetId ? ('entrance' as const) : ('normal-room' as const),
      scale: area.size,
      secret: secretTargets.has(area.id),
      sourceId: area.id,
    })),
    ...plan.rooms.map((room) => ({
      id: room.id,
      levelId: room.levelId,
      role: roleForRoom(room.role),
      scale: room.size,
      secret: room.role === 'secret' || secretTargets.has(room.id),
      sourceId: room.id,
    })),
  ]
  if (!nodes.some((node) => node.id === plan.startArea.targetId)) {
    nodes.unshift({
      id: plan.startArea.targetId,
      levelId: plan.startArea.levelId,
      role: 'entrance',
      scale: 'medium',
      secret: false,
    })
  }

  const syntheticRoles: readonly DungeonNodeRole[] = cave
    ? ['cave-area', 'normal-room', 'corridor-node', 'encounter-room', 'flooded-area', 'hub']
    : ['normal-room', 'normal-room', 'corridor-node', 'hall', 'encounter-room', 'hub', 'treasure-room']
  const scales: readonly PlanScale[] = ['small', 'medium', 'medium', 'medium', 'large']
  for (let index = nodes.length; index < nodeTargetFor(plan); index += 1) {
    const level = levels[index % levels.length]!
    nodes.push({
      id: `generated-room-${index + 1}`,
      levelId: level.id,
      role: pick(random, syntheticRoles),
      scale: pick(random, scales),
      secret: false,
    })
  }
  if (secretTargets.size > 0 && !nodes.some((node) => node.secret)) {
    const index = Math.max(1, nodes.length - 2)
    nodes[index] = { ...nodes[index]!, role: 'secret-room', secret: true }
  }

  const byId = new Map(nodes.map((node) => [node.id, node]))
  const usedPairs = new Set<string>()
  const edges: DungeonTopologyEdge[] = []
  const addEdge = (
    fromId: string,
    toId: string,
    kind: DungeonConnectionKind,
    route: DungeonTopologyEdge['route'] = 'side',
    secret = false,
  ): void => {
    if (fromId === toId || !byId.has(fromId) || !byId.has(toId)) return
    const key = edgeKey(fromId, toId)
    if (usedPairs.has(key)) return
    usedPairs.add(key)
    edges.push({ id: `dungeon-edge-${edges.length + 1}`, fromId, toId, kind, route, secret })
  }

  for (const connection of plan.connections) {
    const from = byId.get(connection.fromId)
    const to = byId.get(connection.toId)
    if (!from || !to) continue
    const secret = connection.secret === true || from.secret || to.secret
    addEdge(
      from.id,
      to.id,
      from.levelId !== to.levelId ? 'stairs' : connectionKind(connection.kind, secret, cave),
      connection.loop ? 'loop' : 'side',
      secret,
    )
  }

  const disjoint = new DisjointSet(nodes.map((node) => node.id))
  edges.forEach((edge) => disjoint.union(edge.fromId, edge.toId))
  const ordered = [
    ...nodes.filter((node) => node.id === plan.startArea.targetId),
    ...shuffled(random, nodes.filter((node) => node.id !== plan.startArea.targetId)),
  ]
  for (let index = 1; index < ordered.length; index += 1) {
    const node = ordered[index]!
    const root = disjoint.find(ordered[0]!.id)
    if (disjoint.find(node.id) === root) continue
    const connected = ordered.slice(0, index).filter((entry) => disjoint.find(entry.id) === root)
    const sameLevel = connected.filter((entry) => entry.levelId === node.levelId)
    const parent = pick(random, sameLevel.length > 0 ? sameLevel : connected)
    const secret = node.secret || parent.secret
    addEdge(
      parent.id,
      node.id,
      parent.levelId !== node.levelId ? 'stairs' : connectionKind('corridor', secret, cave),
      'side',
      secret,
    )
    disjoint.union(parent.id, node.id)
  }

  const loopRatios = {
    linear: 0.02,
    branching: 0.06,
    looped: 0.2,
    radial: 0.09,
    'paired-routes': 0.13,
    layered: 0.08,
    ring: 0.22,
  } as const
  const desiredLoops = Math.max(
    plan.layout.connectionStructure === 'linear' ? 0 : 1,
    Math.round(nodes.length * loopRatios[plan.layout.connectionStructure]),
  )
  let addedLoops = edges.filter((edge) => edge.route === 'loop').length
  for (let attempts = 0; addedLoops < desiredLoops && attempts < nodes.length * 30; attempts += 1) {
    const from = pick(random, nodes)
    const candidates = nodes.filter(
      (node) => node.levelId === from.levelId && node.id !== from.id && !usedPairs.has(edgeKey(node.id, from.id)),
    )
    if (candidates.length === 0) continue
    const to = pick(random, candidates)
    addEdge(from.id, to.id, cave ? 'cave-passage' : 'passage', 'loop')
    addedLoops += 1
  }

  const objectiveNodes = nodes.filter((node) => node.role === 'boss-room' || node.role === 'treasure-room')
  const objectiveNodeIds = (objectiveNodes.length > 0 ? objectiveNodes : [nodes[nodes.length - 1]!]).map((node) => node.id)
  const startId = byId.has(plan.startArea.targetId) ? plan.startArea.targetId : nodes[0]!.id
  const mainIds = mainPathEdges(nodes, edges, startId, objectiveNodeIds[0]!)
  let routedEdges = edges.map((edge) => (mainIds.has(edge.id) && edge.route !== 'loop' ? { ...edge, route: 'main' as const } : edge))

  if (plan.specialFeatures.some((feature) => feature.kind === 'collapsed-passage') || random() < 0.28) {
    const collapsedIndex = routedEdges.findIndex(
      (edge) => edge.kind === 'passage' && edge.route !== 'main' && !edge.secret,
    )
    if (collapsedIndex >= 0)
      routedEdges = routedEdges.map((edge, index) =>
        index === collapsedIndex ? { ...edge, kind: 'collapsed-passage' as const } : edge,
      )
  }

  if (nodes.length >= 10 && objectiveNodeIds.length > 0 && random() < 0.55) {
    const targetId = objectiveNodeIds[0]!
    const gateIndex = routedEdges.findIndex((edge) => edge.toId === targetId || edge.fromId === targetId)
    const keyCandidates = nodes.filter((node) => node.id !== targetId && !node.secret && node.id !== startId)
    if (gateIndex >= 0 && keyCandidates.length > 0) {
      const keyNodeId = pick(random, keyCandidates).id
      routedEdges = routedEdges.map((edge, index) =>
        index === gateIndex ? { ...edge, kind: 'locked-gate' as const, keyNodeId } : edge,
      )
    }
  }

  const entrances: DungeonTopologyEntrance[] = plan.entrances
    .map((entrance) => {
      const node = byId.get(entrance.targetId)
      return node ? { id: entrance.id, nodeId: node.id, levelId: node.levelId } : undefined
    })
    .filter((entry): entry is DungeonTopologyEntrance => Boolean(entry))
  if (entrances.length === 0) {
    const start = byId.get(startId)!
    entrances.push({ id: 'entrance-1', nodeId: start.id, levelId: start.levelId })
  }

  return { seed: plan.seed, nodes, edges: routedEdges, entrances, objectiveNodeIds }
}
