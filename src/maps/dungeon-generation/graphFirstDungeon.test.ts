import { describe, expect, it } from 'vitest'
import { createDefaultObjectRegistry } from '@/map-objects'
import { createLocalMapPlan } from '@/map-generation'
import { validateMapDefinition } from '@/maps/validation'
import { createGraphFirstDungeon } from './geometry'
import { createDungeonSpatialLayout } from './spatialLayout'
import { createDungeonTopologyGraph, type DungeonTopologyGraph } from './topology'

const reachableNodeIds = (graph: DungeonTopologyGraph): ReadonlySet<string> => {
  const adjacency = new Map<string, string[]>()
  graph.nodes.forEach((node) => adjacency.set(node.id, []))
  graph.edges.forEach((edge) => {
    adjacency.get(edge.fromId)?.push(edge.toId)
    adjacency.get(edge.toId)?.push(edge.fromId)
  })
  const start = graph.entrances[0]!.nodeId
  const seen = new Set([start])
  const queue = [start]
  while (queue.length > 0) {
    const current = queue.shift()!
    for (const next of adjacency.get(current) ?? []) {
      if (seen.has(next)) continue
      seen.add(next)
      queue.push(next)
    }
  }
  return seen
}

const dungeonPlan = (seed: number, roomCount = 32, levelCount = 2) =>
  createLocalMapPlan({
    seed,
    mapType: 'dungeon',
    size: roomCount >= 70 ? 'huge' : roomCount >= 35 ? 'large' : 'medium',
    dungeon: {
      roomCount,
      levelCount,
      entranceCount: 3,
      loops: 'many',
      deadEnds: 'many',
      secretRooms: true,
      largeHalls: true,
      bossRoom: true,
      naturalCaveRatio: 0.2,
    },
  })

describe('Graph-First Dungeon Generator', () => {
  it('erzeugt aus demselben MapPlan deterministisch dieselbe Topologie und Geometrie', () => {
    const plan = dungeonPlan(7001, 40, 3)
    expect(createGraphFirstDungeon(plan)).toEqual(createGraphFirstDungeon(plan))
  })

  it('hält über viele Seeds alle wichtigen und normalen Räume erreichbar', () => {
    for (let seed = 1; seed <= 60; seed += 1) {
      const graph = createDungeonTopologyGraph(dungeonPlan(seed, 24, 3))
      const reachable = reachableNodeIds(graph)
      expect(reachable.size, `Seed ${seed}`).toBe(graph.nodes.length)
      expect(graph.objectiveNodeIds.every((id) => reachable.has(id)), `Seed ${seed}`).toBe(true)
      expect(graph.entrances).toHaveLength(3)
      expect(graph.entrances.every((entry) => reachable.has(entry.nodeId))).toBe(true)
    }
  })

  it('erzeugt Schleifen, Seitenpfade, Geheimverbindungen und optionale Torstrukturen', () => {
    const graphs = Array.from({ length: 50 }, (_, index) =>
      createDungeonTopologyGraph(dungeonPlan(8000 + index, 40, 2)),
    )
    expect(graphs.every((graph) => graph.edges.length - graph.nodes.length + 1 >= 4)).toBe(true)
    expect(graphs.some((graph) => graph.edges.some((edge) => edge.route === 'loop'))).toBe(true)
    expect(graphs.some((graph) => graph.edges.some((edge) => edge.secret))).toBe(true)
    expect(graphs.some((graph) => graph.edges.some((edge) => edge.kind === 'locked-gate'))).toBe(true)
    expect(graphs.some((graph) => graph.edges.some((edge) => edge.kind === 'collapsed-passage'))).toBe(true)
  })

  it('streut Raumformen und Korridorarten breit', { timeout: 10_000 }, () => {
    const shapes = new Set<string>()
    const corridorStyles = new Set<string>()
    for (let seed = 1; seed <= 45; seed += 1) {
      const graph = createDungeonTopologyGraph(dungeonPlan(9000 + seed, 24, 1))
      createDungeonSpatialLayout(graph).rooms.forEach((room) => shapes.add(room.shape))
      if (seed <= 14) {
        const generated = createGraphFirstDungeon(dungeonPlan(9000 + seed, 24, 1))
        generated.routing.corridors.forEach((corridor) => corridorStyles.add(corridor.style))
      }
    }
    expect(shapes).toEqual(
      new Set([
        'rectangle',
        'long-hall',
        'l-shape',
        't-shape',
        'cross-shape',
        'irregular',
        'natural-cave',
        'great-hall',
      ]),
    )
    expect(corridorStyles.size).toBeGreaterThanOrEqual(5)
    expect(corridorStyles.has('collapsed')).toBe(true)
  })

  it('liefert valide Walls, Doors und Level-Transitions über viele Seeds', () => {
    const registry = createDefaultObjectRegistry()
    for (let seed = 1; seed <= 18; seed += 1) {
      const { map, topology } = createGraphFirstDungeon(dungeonPlan(10000 + seed, 32, 3))
      const errors = validateMapDefinition(map, registry)
      expect(errors, `Seed ${seed}: ${errors.join(' | ')}`).toHaveLength(0)
      expect(map.doors.length).toBeGreaterThan(0)
      expect(new Set(map.doors.map((door) => door.id)).size).toBe(map.doors.length)
      expect(
        map.doors.every(
          (door) => door.segment.a.x !== door.segment.b.x || door.segment.a.y !== door.segment.b.y,
        ),
      ).toBe(true)
      const wallKeys = map.walls.map((wall) =>
        JSON.stringify([wall.levelId, wall.a.x, wall.a.y, wall.b.x, wall.b.y]),
      )
      expect(new Set(wallKeys).size).toBe(wallKeys.length)
      const crossLevelEdges = topology.edges.filter((edge) => edge.kind === 'stairs')
      expect(map.objects.filter((object) => object.transition)).toHaveLength(crossLevelEdges.length * 2)
    }
  })

  it('unterstützt sehr große Dungeons mit mindestens 80 Räumen in akzeptabler Laufzeit', () => {
    const plan = dungeonPlan(424242, 80, 4)
    const startedAt = performance.now()
    const generated = createGraphFirstDungeon(plan)
    const elapsed = performance.now() - startedAt

    expect(generated.topology.nodes.length).toBeGreaterThanOrEqual(80)
    expect(generated.layout.rooms).toHaveLength(generated.topology.nodes.length)
    expect(generated.map.width).toBeGreaterThan(60)
    expect(generated.map.height).toBeGreaterThan(60)
    expect(reachableNodeIds(generated.topology).size).toBe(generated.topology.nodes.length)
    expect(elapsed).toBeLessThan(5_000)
  })

  it('platziert Räume ohne starres Zellraster und ohne Rechtecküberlappungen', () => {
    const graph = createDungeonTopologyGraph(dungeonPlan(31337, 40, 1))
    const layout = createDungeonSpatialLayout(graph)
    for (let leftIndex = 0; leftIndex < layout.rooms.length; leftIndex += 1) {
      const left = layout.rooms[leftIndex]!
      for (let rightIndex = leftIndex + 1; rightIndex < layout.rooms.length; rightIndex += 1) {
        const right = layout.rooms[rightIndex]!
        if (left.levelId !== right.levelId) continue
        const overlaps =
          left.x < right.x + right.width &&
          left.x + left.width > right.x &&
          left.y < right.y + right.height &&
          left.y + left.height > right.y
        expect(overlaps, `${left.nodeId} überlappt ${right.nodeId}`).toBe(false)
      }
    }
    expect(new Set(layout.rooms.map((room) => room.x)).size).toBeGreaterThan(10)
    expect(new Set(layout.rooms.map((room) => room.y)).size).toBeGreaterThan(10)
  })
})
