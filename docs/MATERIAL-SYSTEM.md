# Material- und Terrain-System

## Datenfluss

```text
MapPlan / Geometry
  -> serialisierbare MaterialLayerDefinition
  -> Material-Compiler (Zellen, Varianten, Kanten, Chunks)
  -> PixiJS MaterialRenderer
  -> gecachte Basis-, Kanten- und Decal-Layer
```

`MapDefinition.materialLayers` enthält ausschließlich statische visuelle Bodeninformation. Türen,
Tokens, Lichtquellen, Übergänge, Wasseranimationen und Set-Dressing bleiben normale
`MapObjectDefinition`s. Dadurch verändern rein optische Details weder Sicht noch Kollision und
müssen nicht als Vue-Komponenten oder einzelne Runtime-Objekte verwaltet werden.

## Aktueller Renderpfad

- Ein Material-Layer wird deterministisch in standardmäßig 16×16 Zellen große Chunks kompiliert.
- Pro Chunk existieren nur drei PixiJS-`Graphics`: Basis, Übergänge/Kanten und Decals.
- Bei bis zu 24 Chunks wird die komplexeste Basisebene mit PixiJS `cacheAsTexture()` gecacht.
  Größere Karten behalten die bereits kompakte Graphics-Geometrie, weil viele RenderTextures beim
  Kartenwechsel mehr Erzeugungszeit und GPU-Speicher kosten würden als sie einsparen.
- Materialvarianten, Rotation, Skalierung und enge Farbvariation werden aus Layer-Seed und
  Zellposition abgeleitet.
- Übergänge entstehen aus Materialnachbarschaften. Wasser verwendet Uferkanten, harte Materialien
  rauere Kanten und Stein/Holz klarere Kanten.
- Dirt, Risse, Moos, Laub, kleine Steine, Unebenheiten und Uferdetails sind materialabhängige,
  deterministische Decals. Zusätzliche explizite Decals können in der MapDefinition gespeichert
  werden.

Die Chunk-Grenzen sind reine Performancegrenzen und haben keinen Einfluss auf das Kartenformat.
Große Karten erzeugen damit wenige Dutzend gecachte Pixi-Container statt tausender DisplayObjects.

## Texturen und Atlanten

Im Repository liegen aktuell keine geeigneten Terrain-Assets. Deshalb verwendet der Renderer
prozedurale Varianten und erzeugt keine Platzhalter-Bilddateien. `MaterialTextureSet` und die
Atlas-Frames im Materialkatalog sind bereits als stabile Erweiterungspunkte vorhanden.

Wenn hochwertige Assets ergänzt werden, sollte der Renderer innerhalb eines Chunks Atlas-Frames
oder `TilingSprite` verwenden und das Ergebnis weiterhin pro Chunk cachen. Interaktive Objekte
dürfen dabei nicht in die statische RenderTexture eingebrannt werden.

## Kompatibilität

Bestehende feste Karten mit `ground-area` funktionieren unverändert. Die neuen Dungeon- und
Outdoor-Pipelines extrahieren Bodenflächen in Material-Layer; animierte Flüsse und Wasserflächen
bleiben als schlanke Overlays erhalten. Das ermöglicht eine schrittweise Migration weiterer Karten.
