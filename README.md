# DnD Mapps

DnD Mapps ist ein lokaler virtueller Spieltisch für Dungeons & Dragons und ähnliche Tabletop-Rollenspiele. Es gibt bewusst nur eine Kartenansicht, kein Backend, keine Benutzerverwaltung, keine Rollen und keine Mehrspieler-Synchronisierung.

Eine ausführliche Beschreibung der Bedienung, Architektur, Beispielkarte und Zufallskarten-Erzeugung steht in [`docs/WEBAPP-FUNKTIONSWEISE.md`](docs/WEBAPP-FUNKTIONSWEISE.md).

## Voraussetzungen

- Node.js LTS, passend zur Toolchain in `package.json`
- npm
- Moderner Browser mit WebGL/WebGPU-fähigem Canvas und IndexedDB

Das Projekt wurde mit dem offiziellen aktuellen Vue-Scaffolder (`create-vue`) erzeugt und nutzt Vue CLI nicht.

## Installation

```sh
npm install
npx playwright install chromium
```

## Entwicklung

```sh
npm run dev
```

Die Anwendung läuft standardmäßig unter `http://localhost:5173`.

## Prüfungen

```sh
npm run lint
npm run type-check
npm run test:unit -- --run
npm run test:e2e
npm run build
```

## Architektur

- `src/views`: einzige Kartenansicht
- `src/components`: Toolbar, Seitenleiste, Token-Eigenschaften und Pixi-Canvas-Bridge
- `src/stores`: Pinia-Stores für App, Karte/Türen, Tokens, Fog, Einstellungen und Sitzung
- `src/map-engine`: PixiJS-Engine, Kamera, Hexraster, Tokens, Sicht, Fog, Licht, Animationen und Ressourcen
- `src/map-objects`: wiederverwendbare Map Object Library mit Registry, Factory, Defaults, Presets und Renderern
- `src/maps`: codebasierte Karten-API, automatische Kartenladung und Beispielkarte
- `src/persistence`: IndexedDB-Persistenz über `idb`
- `e2e`: Playwright-Test

Vue verwaltet UI und serialisierbaren Zustand. PixiJS verwaltet Rendering, Kamera, Dragging, Animationen, Licht und Fog. Pinia speichert keine PixiJS-Objekte.

## Karten-API

Karten sind TypeScript-Module im Verzeichnis `src/maps` und exportieren eine `MapDefinition` als Default-Export. Dateien mit `*.map.ts` werden automatisch per `import.meta.glob` geladen. Eine Karte definiert:

- `id`, `name`, `width`, `height`, `gridSize`
- `objects` aus der Map Object Library
- geometrische `walls`
- interaktive `doors`
- `spawnPoints`
- optionale `startTokens`

Kartenkoordinaten sind logische Rastereinheiten. Die Engine rechnet sie mit `gridSize` in Pixel um; sichtbares Raster und Token-Einrasten verwenden ein pointy-top Hexraster.

## Map Object Library

Die Objektbibliothek funktioniert wie eine Component Library für PixiJS-Kartenobjekte. Karten beschreiben nur Typ, Preset, Position und Overrides. Die Bibliothek verwaltet Rendering, Animationen, Licht, Laufzeitzustand, Sicht-/Kollisionsgeometrie und Cleanup.

Verfügbare Objekttypen:

- `ground-area`, `floor`, `stone-floor`, `wood-floor`
- `stone-wall`, `wooden-door`, `stone-door`
- `column`, `crate`, `barrel`, `table`, `chair`, `rock`, `tree`, `hill-slope`, `bridge`, `wooden-barricade`, `daylight-area`
- `torch`, `candle`, `campfire`, `hearth`, `light-source`
- `water`, `river`, `fog`, `smoke`
- `spawn-point`, `decoration`, `trap`, `lever`

Das zentrale Register liegt in `src/map-objects/registry.ts`. Neue Typen werden als eigenes Modul implementiert und in `src/map-objects/index.ts` registriert.

## Presets und Prefabs

Presets liefern typisierte Defaults, die Karten überschreiben können. Beispiele:

- Boden: `packed-earth`, `dark-earth`, `cave-ground`, `meadow`, `forest-floor`, `dirt-path`, `stone-tiles`, `cracked-tiles`, `mossy-stone`, `wet-stone`, `grave-dust`, `loose-gravel`, `wood-planks`, `sand`, `snow`, `marsh`
- `small-wall-torch`, `large-wall-torch`, `rusty-iron-torch`, `brass-wall-sconce`, `blue-magic-fire`, `blue-crystal-torch`
- `altar-candle`, `short-candle`, `blue-ritual-candle`
- `small-campfire`, `large-hearth`, `magic-hearth`
- `standing-water`, `slow-river`, `fast-river`
- `old-oak`, `pine-tree`, `dead-tree`, `wooden-footbridge`, `old-forest-bridge`
- `grassy-north-rise`, `grassy-south-rise`, `rocky-north-rise`, `rocky-south-rise`
- `rough-road-barricade`, `spiked-road-barricade`
- `open-sunlight`, `forest-daylight`
- `small-rock`, `mossy-boulder`, `large-boulder`
- `closed-wooden-door`, `closed-stone-door`
- `small-crate`, `large-crate`, `small-barrel`, `large-barrel`

Karten-Prefabs liegen in `src/maps/prefabs`. Sie erzeugen wiederverwendbare Räume, Wandabschnitte, Türen, Lagerplätze oder Feuerstellen als reine Kartendaten.

## Neue Karte hinzufügen

Bodenbereiche werden mit `ground-area` oder dem Helfer `groundArea(...)`/`floorArea(...)` angelegt. Eine Karte kann grobe Bereiche frei kombinieren, zum Beispiel:

```ts
groundArea('room-floor', 2, 2, 8, 6, 'cracked-tiles')
groundArea('forest-edge', 10, 4, 5, 7, 'forest-floor')
groundArea('wooden-bridge', 14, 8, 4, 2, 'wood-planks')
```

Die Bodenrenderer erzeugen pro Rasterzelle deterministische Variation: Risse in Fliesen, Maserung und Astloecher in Holz, Steine in Erde und Hoehlenboden, Gras, Blueten, Blaetter oder feuchte Sumpfflaechen. Wenn das Hexraster aktiviert ist, wird es ueber den Bodenflaechen und unter Tokens/Objekten gezeichnet.

1. Datei `src/maps/meine-karte.map.ts` erstellen.
2. `defineMap(...)` verwenden.
3. Objekte nur über registrierte Objekttypen und Presets beschreiben.
4. Wände und Türen als Geometrie ergänzen.
5. Anwendung starten. Der Loader findet die Karte automatisch.

Der Loader meldet verständliche Fehler bei doppelten IDs, unbekannten Objekttypen, unbekannten Presets, ungültigen Maßen, ungültigen Positionen und fehlenden Türreferenzen.

## Neuen Objekttyp hinzufügen

1. Neues Modul unter `src/map-objects/objects` anlegen.
2. `MapObjectRegistration` mit Defaults, Presets, Validierung, Renderfunktion und optionaler Sicht-/Kollisionsgeometrie definieren.
3. Cleanup und Animationen über `RuntimeMapObject.cleanup` und `AnimationManager` registrieren.
4. Registrierungsfunktion in `src/map-objects/index.ts` aufrufen.

## Neues Preset hinzufügen

Presets werden im passenden Objektmodul ergänzt. Ein Preset setzt nur Defaults. Karten können einzelne Werte wie Größe, Lichtfarbe, Lichtreichweite, Animationsgeschwindigkeit oder Sichtblockierung überschreiben.

## Neue Animation hinzufügen

Animationen laufen über `AnimationManager`. Registriere eine zeitbasierte Update-Funktion mit `register(...)` und gib den Dispose-Callback im Runtime-Cleanup frei. Animationen respektieren globale Deaktivierung, reduzierte Bewegung und pausierte Browser-Tabs.

## Sicht, Licht und Fog of War

Sicht und Licht sind getrennt:

- Sicht berechnet sichtbare Bereiche anhand von Tokens, Sichtweite, optionalem Sichtwinkel, Wänden und geschlossenen Türen.
- Licht zeichnet weiche radiale Lichtscheine für Fackeln und Feuerstellen.
- Fog of War unterscheidet aktuell sichtbar, bereits erkundet und unbekannt.

Wenn Fog deaktiviert ist, bleibt die Karte vollständig sichtbar. Wenn Fog aktiviert ist, verdecken unbekannte Bereiche alle darunterliegenden Layer. Optional kann Erkundung gespeichert oder nur aktuelle Sicht angezeigt werden.

## Lokales Speicherformat

Der Zustand wird versioniert in IndexedDB gespeichert:

- ausgewählte Karte
- platzierte Tokens und Token-Einstellungen
- Türzustände
- Fog-Einstellungen und erkundete Polygone
- Kamera, Raster, Animationen und Beleuchtung

Das aktuelle Schema ist `version: 1`.

## Aktueller Funktionsumfang

- Beispielkarten „Alte Krypta“ und „3. Kapitel Barikarde“
- Token-Bibliothek mit Held, Magier, Goblin und Skelett
- Drag-and-drop aus der Seitenleiste
- Verschieben vorhandener Tokens auf der Karte
- Token-Eigenschaften bearbeiten und löschen
- Kamera-Zoom auf Mausposition
- Kartenverschiebung mit mittlerer/rechter Maustaste oder Leertaste
- Hexraster und Hex-Einrasten
- wandbasierte Sichtberechnung
- Fog of War mit gespeicherter Erkundung
- klickbare Türen mit gespeicherten Zuständen
- wiederverwendbare Fackeln, Feuerstellen, Flüsse, Rauch und Nebel
- IndexedDB-Speicherung
- Unit- und E2E-Tests

## Bewusst noch nicht umgesetzt

- kein visueller Karteneditor
- kein Backend
- keine Mehrspieler-Synchronisierung
- keine getrennte Spielleiter-/Spieleransicht
- keine Rollen oder Berechtigungen
- keine externen Grafikassets
- keine wandbasierte Lichtabschattung
- keine komplexe Kollisions- oder Pfadfindungslogik
