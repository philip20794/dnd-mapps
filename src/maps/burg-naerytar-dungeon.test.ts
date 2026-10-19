import { describe, expect, it } from 'vitest'
import { createDefaultObjectRegistry, resolveMapObject } from '@/map-objects'
import burgNaerytarDungeonMap, { burgNaerytarDungeonMapId } from './burg-naerytar-dungeon.map'
import {
  hasNaerytarCell,
  naerytarAreas,
  naerytarDeepWaterCells,
  naerytarIslandCells,
  naerytarLakeCells,
  naerytarRoutes,
  naerytarWalkableCells,
  parseCellKey,
} from './burg-naerytar-dungeon/geometry'
import { naerytarTerrainMetrics } from './burg-naerytar-dungeon/terrain'
import { loadMapDefinitions } from './loader'
import { validateMapDefinition } from './validation'

function key(x: number, y: number): string {
  return `${x},${y}`
}

function centerKey(areaNumber: number): string {
  const area = naerytarAreas.find((entry) => entry.number === areaNumber)
  if (!area) throw new Error(`Unbekannter Bereich ${areaNumber}`)
  return key(Math.floor(area.center.x), Math.floor(area.center.y))
}

function canReach(start: string, target: string, cells: ReadonlySet<string>): boolean {
  const queue = [start]
  const visited = new Set([start])
  for (let index = 0; index < queue.length; index += 1) {
    const current = parseCellKey(queue[index]!)
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const next = key(current.x + dx, current.y + dy)
      if (!cells.has(next) || visited.has(next)) continue
      if (next === target) return true
      visited.add(next)
      queue.push(next)
    }
  }
  return start === target
}

describe('Burg Naerytar – Höhlen-Dungeon', () => {
  it('wird als feste, valide Karte über den vorhandenen Loader geladen', () => {
    expect(burgNaerytarDungeonMap.id).toBe(burgNaerytarDungeonMapId)
    expect(burgNaerytarDungeonMap.name).toBe('Burg Naerytar – Höhlen-Dungeon')
    expect(loadMapDefinitions().some((map) => map.id === burgNaerytarDungeonMapId)).toBe(true)
    expect(validateMapDefinition(burgNaerytarDungeonMap, createDefaultObjectRegistry())).toEqual([])
    expect('generation' in burgNaerytarDungeonMap).toBe(false)
    expect(burgNaerytarDungeonMap.doors).toEqual([])
    expect('startTokens' in burgNaerytarDungeonMap).toBe(false)
  })

  it('enthält alle 13 dokumentierten Bereiche an begehbaren Positionen', () => {
    expect(naerytarAreas.map((area) => area.number)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13,
    ])
    for (const area of naerytarAreas) expect(hasNaerytarCell(area.center), area.name).toBe(true)

    const taggedAreas = new Set(
      burgNaerytarDungeonMap.objects
        .flatMap((object) => object.tags ?? [])
        .filter((tag) => tag.startsWith('area-')),
    )
    for (let number = 1; number <= 13; number += 1)
      expect(taggedAreas.has(`area-${number.toString().padStart(2, '0')}`)).toBe(true)
  })

  it('hält Schatzroute, Ostweg und Heiligtumsabzweig vollständig erreichbar', () => {
    for (const route of naerytarRoutes) {
      for (let index = 0; index < route.areas.length - 1; index += 1) {
        const start = centerKey(route.areas[index]!)
        const target = centerKey(route.areas[index + 1]!)
        expect(
          canReach(start, target, naerytarWalkableCells),
          `${route.id}: ${start} -> ${target}`,
        ).toBe(true)
      }
    }
  })

  it('lässt die Teleportationskammer nur durch den östlichen Höhlenmund verlassen', () => {
    const outgoing: { readonly x: number; readonly y: number }[] = []
    for (const cell of naerytarWalkableCells) {
      const point = parseCellKey(cell)
      if (point.x > 16 || point.y > 11) continue
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const next = { x: point.x + dx, y: point.y + dy }
        if ((next.x > 16 || next.y > 11) && naerytarWalkableCells.has(key(next.x, next.y)))
          outgoing.push(next)
      }
    }
    expect(outgoing.length).toBeGreaterThan(0)
    expect(outgoing.every((point) => point.x >= 16 && point.y <= 11)).toBe(true)
  })

  it('modelliert einen dominanten See mit Tiefwasser, Inseln und separater Brutstätte', () => {
    expect(naerytarTerrainMetrics.lakeCells).toBeGreaterThan(240)
    expect(naerytarTerrainMetrics.deepWaterCells).toBeGreaterThan(90)
    expect(naerytarIslandCells.size).toBeGreaterThan(10)
    expect([...naerytarDeepWaterCells].every((cell) => naerytarLakeCells.has(cell))).toBe(true)
    expect([...naerytarIslandCells].every((cell) => !naerytarDeepWaterCells.has(cell))).toBe(true)
    // Area 8 is a separate breeding pool, reached over land rather than by open water.
    expect(canReach(centerKey(6), centerKey(8), naerytarLakeCells)).toBe(false)
    expect(canReach(centerKey(6), centerKey(8), naerytarWalkableCells)).toBe(true)
  })

  it('setzt Gameplay-Walls, den Kran, den Teleportkreis, Nebel und genau zwei Eingangslichter', () => {
    expect(burgNaerytarDungeonMap.walls.length).toBeGreaterThan(100)
    expect(burgNaerytarDungeonMap.walls.filter((wall) => wall.blocksSight).length).toBeGreaterThan(
      90,
    )
    expect(burgNaerytarDungeonMap.walls.every((wall) => wall.blocksMovement)).toBe(true)
    expect(
      burgNaerytarDungeonMap.objects.some(
        (object) => object.id === 'naerytar-09-cargo-crane' && object.type === 'cargo-crane',
      ),
    ).toBe(true)
    expect(
      burgNaerytarDungeonMap.objects.some(
        (object) =>
          object.id === 'naerytar-13-teleport-circle' &&
          object.preset === 'ritual-runes' &&
          object.color === 0x34383a &&
          (object.light === undefined || object.light === null),
      ),
    ).toBe(true)
    expect(
      burgNaerytarDungeonMap.objects.filter((object) => object.type === 'fog').length,
    ).toBeGreaterThanOrEqual(4)
    expect(burgNaerytarDungeonMap.objects.filter((object) => object.type === 'torch')).toHaveLength(
      2,
    )
    const registry = createDefaultObjectRegistry()
    const litObjects = burgNaerytarDungeonMap.objects
      .map((object, index) => resolveMapObject(object, registry, index))
      .filter((object) => object.light)
    expect(litObjects.map((object) => object.id)).toEqual([
      'naerytar-01-lantern-west',
      'naerytar-01-lantern-east',
    ])
    expect(burgNaerytarDungeonMap.spawnPoints).toHaveLength(1)
    expect(burgNaerytarDungeonMap.spawnPoints[0]?.tags).toContain('area-01')
  })
})
