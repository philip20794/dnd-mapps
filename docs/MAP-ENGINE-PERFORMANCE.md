# MapEngine-Performance und statisches Chunking

Stand: September 2026

## Gemessene Engpässe

Vor dem Umbau erzeugte `MapEngine.renderMap()` für jedes sichtbare `MapObjectDefinition` sofort ein
eigenes Runtime-Objekt. Materialterrain war bereits in 16×16-Chunks organisiert, sämtliche Chunks
wurden aber unabhängig vom Viewport gezeichnet. Zusätzlich führte jede über Vue/Pinia
zurückgespiegelte Kameraänderung über `setSettings()` erneut einen vollständigen Kartenaufbau aus.

Die Messungen unten stammen aus dem reproduzierbaren Vitest-Profil
`src/map-engine/chunks/performance.test.ts`. Zeiten sind CPU-Zeiten der Generierung beziehungsweise
der reinen Chunk-/Sichtbarkeitsanalyse und keine garantierten Browser-FPS. Der Renderknotenwert ist
ein stabiler Proxy aus Runtime-Wurzeln, Chunk-Containern und Material-Graphics; interne Kinder
einzelner Objekt-Renderer werden bewusst nicht geschätzt.

## Vorher/Nachher

Gemessener Ausschnitt nach Chunking: 40×30 Rastereinheiten bei Zoom 0,7.

| Szenario | Kartenmaß | Map Objects | Material-Chunks | Generierung | Renderknoten vorher | sichtbar nachher | Chunkvorbereitung |
|---|---:|---:|---:|---:|---:|---:|---:|
| Outdoor | 50×50 | 152 | 16 | 66,3 ms | 248 | 160 | 9,9 ms |
| Outdoor | 100×100 | 646 | 49 | 170,4 ms | 940 | 233 | 21,9 ms |
| Outdoor | 150×150 | 1.346 | 100 | 331,2 ms | 1.946 | 315 | 50,0 ms |
| Dungeon, 120 Räume/4 Ebenen | 109×98 | 359 | 124 | 191,5 ms | 1.103 | 130 | 4,0 ms |
| Komplexes Outdoor | 150×150 | 1.448 | 100 | 264,5 ms | 2.048 | 333 | 58,9 ms |

Die Werte schwanken mit Maschine und paralleler Testlast. Entscheidend sind die reproduzierbaren
Seeds, Szenarien und Größenverhältnisse; Tests verwenden deshalb großzügige Zeitgrenzen und prüfen
vor allem die Reduktion sichtbarer Renderknoten.

## Implementierter Renderpfad

- Materialbasis, Terrain-Kanten und Material-Decals bleiben in 16×16-Chunks organisiert.
- Material-Chunks außerhalb des gepolsterten Kameraausschnitts erhalten `renderable = false`.
- Nicht animierte Objekte der Layer `floor`, `terrainStatic` und `objectsStatic` werden räumlich in
  16×16-Chunks indexiert.
- Statische Objekt-Renderer werden erst erzeugt, wenn ihr Chunk sichtbar wird.
- Verlassene Chunks bleiben für schnelles Zurückschwenken in einem Cache; oberhalb von 64
  behaltenen Chunks werden die ältesten unsichtbaren Chunks freigegeben.
- Kleine Vegetation und Mikrodekoration werden im Kartenüberblick per Zoom-LOD ausgelassen.
  Landmarken und semantisches Set Dressing bleiben sichtbar.
- Materialkarten mit höchstens 24 Chunks dürfen ihre komplexe Basisebene über `cacheAsTexture()`
  als RenderTexture cachen. Dekorationschunks werden bewusst nicht zusätzlich gecacht: Ein
  Browservergleich zeigte, dass deren initiale Texturerzeugung teurer ist als Lazy-Mounting und
  Culling. Bei großen Karten wäre außerdem der GPU-Speicheraufwand zu hoch.
- PixiJS-Culling ist mit festen `cullArea`-Rechtecken aktiviert. Dadurch sind keine teuren
  Bounds-Berechnungen pro Frame nötig. Dynamische/interaktive Runtime-Container bleiben eigene
  Objekte, erhalten aber ebenfalls eine feste Cull-Fläche für ihren rein visuellen Renderanteil.
- Kamera-, Zoom- und Rotationsänderungen bauen die Karte nicht mehr neu auf. Ein kompletter
  `renderMap()`-Lauf bleibt nur für echte Karten-, Ebenen-, Door- oder Rasteränderungen nötig.

Interaktive Daten bleiben getrennt: Tokens, Doors, Walls, Licht, Fog, Spell Effects, Animationen und
interaktive Objekte werden nicht in statische RenderTextures eingebrannt. Sicht und Bewegung lesen
weiterhin direkt aus `map.walls` und `map.doors`.

## Texture Atlases

Im Repository existieren weiterhin keine geeigneten Terrain-/Objekt-Atlanten. Deshalb wurde kein
künstliches Assetpaket erzeugt. Das Materialsystem besitzt bereits Atlas-Referenzen; künftige
Sprites können innerhalb desselben Chunk-Lebenszyklus über Atlas-Frames oder `TilingSprite`
gerendert werden. Die Sichtbarkeits-, LOD- und Cachelogik muss dafür nicht geändert werden.

## Verbleibende Grenzen

- Animierte Flüsse und andere dynamische Terrainobjekte werden weiterhin einzeln erzeugt.
- Das Hexraster ist weiterhin eine große zusammenhängende Graphics-Geometrie; bei deutlich mehr
  als 150×150 Zellen sollte ein eigener Grid-Chunk- oder Zoom-LOD-Pfad gemessen werden.
- Fog-Polygone, Lichtquellen und sehr große Wall-Mengen sind bewusst nicht Teil des statischen
  Chunk-Caches und benötigen bei noch größeren Karten eigene Messungen.
- Im vollständig herausgezoomten Überblick ist naturgemäß die ganze Karte sichtbar. Dort reduziert
  LOD kleine Dekoration; räumliches Culling greift erst beim Hineinzoomen.
- Der Performance-Test ist ein CPU-/Strukturbenchmark. Verlässliche FPS- oder GPU-Zeiten brauchen
  später einen browser- und hardwaregebundenen Benchmark.
