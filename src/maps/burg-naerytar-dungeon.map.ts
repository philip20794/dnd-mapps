import { defineMap } from './api'
import { createNaerytarObjects } from './burg-naerytar-dungeon/dressing'
import {
  createNaerytarWalls,
  naerytarMapHeight,
  naerytarMapWidth,
} from './burg-naerytar-dungeon/geometry'
import { createNaerytarMaterialLayer } from './burg-naerytar-dungeon/terrain'

export const burgNaerytarDungeonMapId = 'burg-naerytar-dungeon'

/**
 * Handgefertigte 5-Fuß-Rasterumsetzung von Karte 6.4.
 * Bereichsnummern und Namen stehen zentral in burg-naerytar-dungeon/geometry.ts;
 * sie bleiben als area-XX-Tags für die Spielleitung und Tests erhalten, werden aber nicht gerendert.
 */
export default defineMap({
  id: burgNaerytarDungeonMapId,
  name: 'Burg Naerytar – Höhlen-Dungeon',
  width: naerytarMapWidth,
  height: naerytarMapHeight,
  gridSize: 48,
  objects: createNaerytarObjects(),
  materialLayers: [createNaerytarMaterialLayer()],
  walls: createNaerytarWalls(),
  doors: [],
  spawnPoints: [
    {
      id: 'burg-naerytar-dungeon-player-entry',
      name: 'Spielereingang – Bereich 1',
      position: { x: 46.5, y: 25.5 },
      radius: 1.5,
      tags: ['player', 'entrance', 'area-01'],
    },
  ],
})
