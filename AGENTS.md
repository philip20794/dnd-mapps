# AGENTS.md – Arbeitsgrundlage für dnd-mapps

Dieses Repository ist `dnd-mapps`, ein lokaler virtueller Spieltisch für D&D-ähnliche Rollenspiele. Diese Datei beschreibt den aktuellen Stand und die Regeln für künftige Codex-Aufgaben. Sie ergänzt die ausführlichere technische Beschreibung in `docs/WEBAPP-FUNKTIONSWEISE.md`.

## Projektziel

Der prozedurale Battlemap-Generator soll langfristig deutlich abwechslungsreichere, strukturell reichere und auch sehr große Dungeons erzeugen.

Zielarchitektur für neue Generatorarbeit:

```text
User-Eingabe
  -> MapGenerationRequest
  -> Local Planner oder AI Planner
  -> MapPlan
  -> Layout/Geometry Generator
  -> Environment/Materials
  -> Set Dressing
  -> MapDefinition
  -> bestehende MapEngine
```

Local Planner und optionaler AI Planner müssen dasselbe `MapPlan`-Format erzeugen. KI darf die lokale, vollständig funktionierende Generierung nicht ersetzen.

## Technischer Rahmen

- Vue 3 + TypeScript + Vite
- Pinia für serialisierbaren globalen Zustand
- PixiJS 8 für Canvas-Rendering, Kamera, Animationen und Interaktion
- Vue Router mit einer Hauptroute `/`
- IndexedDB über `idb` für den lokalen Sitzungszustand
- Vitest für Unit-Tests, Playwright für E2E-Tests
- keine unnötigen Abhängigkeiten hinzufügen
- bestehende Funktionalität nicht entfernen, solange das nicht ausdrücklich beauftragt ist

Die Hauptanwendung bleibt clientseitig und hat keine Benutzerverwaltung, Rollen oder Mehrspieler-Synchronisierung. Für optionale OpenAI-Funktionen existiert unter `server/` eine kleine Firebase-Functions-Schicht. OpenAI-/Admin-Schlüssel dürfen niemals in Browser-Code, Bundles oder Pinia-Zustand gelangen. Die HTTP-Funktionen erzwingen Firebase App Check; vor der UI-Anbindung muss App Check auch im Web-Client eingerichtet werden.

## Wichtigste Dateien und Zuständigkeiten

- `src/main.ts`, `src/App.vue`, `src/router/index.ts`: App-Start und einzige Route.
- `src/views/TabletopView.vue`: Orchestrator. Lädt Karten, verbindet Stores mit Komponenten/Engine, startet Zufallskarten, behandelt Auto-Save und Reset-Aktionen.
- `src/components/TopToolbar.vue`: Karten-/Ebenenwahl, Zufallskarte, Fog, Raster, Rotation und Reset.
- `src/components/RandomMapDialog.vue`: optionale `MapGenerationRequest`-Eingabe und KI-Verbrauchsanzeige; die Planner-Auswahl liegt nicht in der Komponente.
- `src/components/SidebarPanel.vue`, `TokenProperties.vue`, `SpellEffectPanel.vue`, `SpellRadialMenu.vue`: Token- und Zauberflächen-UI.
- `src/components/MapCanvas.vue`: Vue/PixiJS-Brücke; erzeugt eine `MapEngine` und synchronisiert Props/Events.
- `src/map-engine/MapEngine.ts`: PixiJS-Lebenszyklus, Layer, Kamera, Kartenobjekte, Tokens, Zauberflächen, Türen, Fog und DOM-/Pointer-Interaktion.
- `src/map-engine/layers.ts`: feste Zeichenreihenfolge.
- `src/map-engine/materials/MaterialRenderer.ts`: chunkweises PixiJS-Rendering und Caching statischer Material-, Kanten- und Decal-Layer.
- `src/map-engine/chunks/`: Sichtbereichsberechnung, 16×16-Index für statische Objekte, Zoom-LOD, Lazy-Mounting, Culling, LRU-Freigabe und reproduzierbares Performanceprofil. Messwerte stehen in `docs/MAP-ENGINE-PERFORMANCE.md`.
- `src/map-engine/grid`: logische Koordinaten, pointy-top-Hexraster, Snap und Kamera-Transformation.
- `src/map-engine/visibility`: Sichtpolygone aus Tokens, Kartengrenzen, Walls und geschlossenen Doors.
- `src/map-engine/fog`: Fog-Zustand und Rendering; Erkundung wird pro Karte/Ebene gesammelt.
- `src/map-engine/collision/movement.ts`: segmentbasierte Tokenbewegung gegen Walls und geschlossene Doors.
- `src/map-engine/lighting`: Lichtquellen aus aufgelösten Map Objects.
- `src/map-engine/spells`, `tokens`, `animations`, `resources`: spezialisierte Runtime-Renderer/Manager.
- `src/map-objects/types.ts`, `registry.ts`, `factory.ts`, `defaults.ts`, `validation.ts`: Map-Object-Vertrag, Presets, Defaults und Validierung.
- `src/map-objects/objects/*.ts`: registrierte Objekttypen und PixiJS-Renderer.
- `src/map-materials/`: serialisierbarer Materialvertrag, Katalog, Bodenextraktion, deterministischer Compiler und Validierung. Details stehen in `docs/MATERIAL-SYSTEM.md`.
- `src/maps/api.ts`: `MapDefinition`, `WallDefinition`, `DoorDefinition`, Ebenen, Spawnpunkte und Prefab-Merge.
- `src/maps/loader.ts`: eager `import.meta.glob('./*.map.ts')`, Validierung, ID-Prüfung und Sortierung.
- `src/maps/validation.ts`: Grenzen, IDs, Ebenen, Türreferenzen, Presets und Kartenobjekte.
- `src/maps/prefabs/common.ts`: wiederverwendbare reine Kartendaten-Helfer.
- `src/maps/randomGenerator.ts`: aktueller seedbarer, aber monolithischer Zufallsgenerator.
- `src/maps/mapGenerationRequestAdapter.ts`: kompatible Übersetzung semantischer Request-/Plan-Themen in Legacy-Merkmale für die Übergangs-MapDefinition-Erzeugung.
- `src/map-generation/service.ts`: gemeinsame Generation Pipeline: Request-Normalisierung, Seed, Planner-Auswahl, AI-Fallback, Plan-Validierung und Auswahl der passenden Geometry-Pipeline.
- `src/map-generation/aiPlannerClient.ts`: schlanker Browser-Transport zu `/api/map-plan`; keine SDKs oder Secrets im Client.
- `src/map-generation/mapDefinitionAdapter.ts`: reproduzierbare Auswahl zwischen Graph-First-Dungeon, regionenbasiertem Outdoor-Generator und erhaltenem Legacy-Fallback.
- `src/maps/dungeon-generation/topology.ts`: logischer Dungeon-Graph mit Haupt-/Nebenpfaden, Schleifen, Geheimwegen, Toren, Eingängen und Ebenenverbindungen.
- `src/maps/dungeon-generation/spatialLayout.ts`, `roomShapes.ts`, `corridorRouting.ts`: freie Platzierung, rollenabhängige Raumformen und hindernisbewusstes Korridorrouting.
- `src/maps/dungeon-generation/geometry.ts`: Floors, zusammengeführte Boundary-Walls, Doors, Secret Doors, Level Transitions und finale `MapDefinition` für Dungeon-/Cave-/Building-Pläne.
- `src/maps/outdoor-generation/regionLayout.ts`, `terrainFields.ts`: zusammenhängende Voronoi-Regionen sowie seed-basierte Höhen-, Feuchtigkeits- und Vegetationsfelder mit Übergangszonen.
- `src/maps/outdoor-generation/linearFeatures.ts`: gekrümmte Haupt-/Nebenwege, zusammenhängende Flüsse, Zuflüsse, Seen, Ufer und Brückenstellen.
- `src/maps/outdoor-generation/vegetation.ts`, `geometry.ts`: feldbasierte Vegetationscluster, geschützte Spielflächen, Landmarken, Set Dressing und finale Outdoor-`MapDefinition`.
- `src/maps/set-dressing/`: reine, gemeinsame semantische Dressing-Stufe. Sie erzeugt gewichtete Szenencluster (`camp`, `abandoned-camp`, `ruin`, `forest-edge`, `river-bank`, `dungeon-storage`, `ritual-site`) und schützt dabei Bounds, Walls, Doors, Hauptwege, Wasser und freie Szenenkerne.
- `src/maps/*.map.ts`: feste Karten, darunter `kapitel-3-barikarde.map.ts`.
- `server/src/routes.ts`: validierte HTTP-Grenzen für `POST /api/map-plan` und `GET /api/ai-usage`.
- `server/src/openAiProviders.ts`: serverseitige Provider für Responses API und Organization Costs API.
- `server/src/aiMapPlanner.ts`, `aiInspiration.ts`, `aiPlanConstraints.ts`: Luna-Orchestrierung, seed-basierte Inspiration, genau ein Reparaturversuch, fachliche Constraints und Local-Planner-Fallback.
- `server/src/firebase.ts`, `firebase.json`: Firebase-Functions-Adapter, App Check, Secrets und Hosting-Rewrites.
- `src/stores/map.ts`: Kartenliste, aktuelle Karte/Ebene und Türzustände.
- `src/stores/tokens.ts`: serialisierbare Tokens und Auswahl.
- `src/stores/fog.ts`: Fog-/Erkundungsdaten.
- `src/stores/settings.ts`: Kamera, Rotation, Raster, Animationen und Licht.
- `src/stores/spellEffects.ts`: platzierte Zauberflächen.
- `src/stores/session.ts`, `src/persistence/sessionPersistence.ts`: Snapshot, IndexedDB und Wiederherstellung.
- `src/types`: Geometrie, Session, Settings, Tokens und Zauberflächen.

## Laufzeit-Datenfluss

```text
User-Interaktion
  -> Vue-Komponente
  -> TabletopView-Handler
  -> Pinia-Store oder MapEngine-Callback
  -> MapCanvas-Props/Watcher
  -> MapEngine.set* / PixiJS-Neuzeichnung
  -> Callback zurück in Vue
```

Beim Start lädt `TabletopView` alle `*.map.ts`, validiert sie, setzt die erste Karte und restauriert danach die lokale Session. Änderungen werden überwiegend mit einer Verzögerung von 350 ms gespeichert. PixiJS-Runtime-Objekte, `Container`, `Graphics`, Texturen und Engine-Instanzen dürfen nicht in Pinia oder Snapshots gelangen.

## Bestehendes Kartenformat

`MapDefinition` ist das finale Format der Engine und muss erhalten bleiben. Es enthält mindestens:

- `id`, `name`, `width`, `height`, `gridSize`
- optionale `levels` und `defaultLevelId`
- `objects: MapObjectDefinition[]`
- optionale `materialLayers` für statische visuelle Terrainflächen, Übergänge und Decals
- `walls: WallDefinition[]`
- `doors: DoorDefinition[]`
- `spawnPoints`
- optionale `startTokens`

Karten werden in logischen Rastereinheiten definiert; `gridSize` wandelt sie beim Zeichnen in Pixel um. Ein Tür-Objekt und seine `DoorDefinition` müssen dieselbe ID haben. `levelId` muss für Objekte, Walls, Doors, Spawnpunkte und Tokens auf eine gültige Ebene zeigen.

Map Objects bestehen aus Typ, optionalem Preset, Position, Größe und Overrides. Registry/Factory ergänzen Defaults und erzeugen Runtime-Renderer. Neue Generatorstufen sollen reine Daten erzeugen und weder Vue- noch PixiJS-Objekte importieren.

Statischer Boden neuer Generatorpfade wird nicht als Menge interaktiver Map Objects gespeichert. `MaterialLayerDefinition` trennt editierbare/interaktive Objekte von rein visuellen Materialien. Die Engine kompiliert diese Daten in 16×16-Chunks mit je einem Basis-, Kanten- und Decal-`Graphics`; bei normalen Kartengrößen wird die komplexe Basisebene als Textur gecacht. Feste Legacy-Karten mit `ground-area` bleiben kompatibel.

Auch nicht animierte Dekoration aus `floor`, `terrainStatic` und `objectsStatic` wird zur Laufzeit in 16×16-Chunks indexiert. Nur sichtbare Chunks werden aufgebaut; entfernte Chunks sind nicht renderbar und werden über einen begrenzten LRU-Cache freigegeben. Kameraänderungen dürfen keinen vollständigen Karten-Rebuild auslösen. Interaktive Objekte, Walls/Doors, Licht, Fog, Tokens und Spell Effects bleiben außerhalb statischer Chunk-Texturen.

Wichtige aktuelle Verhaltensregel: Sicht- und Bewegungsauswertung verwendet in der Engine explizite `map.walls` und `map.doors`. Die optionalen `getSightGeometry`-/`getCollisionGeometry`-Hooks der Map-Object-Registrierungen werden derzeit nicht automatisch in diese Berechnungen eingespeist. Ein sichtbares Objekt mit `blocksSight`/`blocksMovement` ist daher nicht allein ein sicherer Wall-/Collision-Blocker; benötigte Geometrie muss explizit erzeugt oder die Engine gezielt erweitert werden.

## Bestehendes Zufallssystem

`src/maps/randomGenerator.ts` exportiert `createRandomMap({ dark, seed?, features? })` und `randomMapId === 'zufallskarte'`.

Die aktuelle Oberfläche übergibt eine optionale `MapGenerationRequest` an `MapGenerationService`. Dieser erstellt einmalig einen Seed, plant lokal oder ruft bei aktivierter KI den sicheren `/api/map-plan`-Endpunkt auf und fällt bei Fehlern lokal zurück. Der validierte `MapPlan` wird zusammen mit Request, Seed und unkritischen Planner-Metadaten an der generierten `MapDefinition` gespeichert und daher über die bestehende Session-Persistenz erhalten. Dungeon-, Cave- und Building-Pläne laufen über den Graph-First-Generator. Outdoor-, Settlement-, Island-, Coast- und Ruins-Pläne laufen über den regionenbasierten Outdoor-Generator. Der alte `createRandomMap`-Pfad bleibt für bestehende Aufrufer als Legacy-Fallback erhalten.

- `seed` wird optional übergeben; ohne Seed wird ein zufälliger 32-Bit-Wert verwendet.
- `mulberry32` liefert deterministische Zufallszahlen für denselben Seed.
- Die Oberfläche bietet aktuell keinen Seed an und speichert den Seed nicht separat, sondern die fertige `MapDefinition`.
- Die Kartengröße wird zufällig auf Breite 30–48 und Höhe 26–42 gesetzt; `gridSize` ist 48.
- Merkmale werden normalisiert: `river -> water`, `ship -> outdoor + water`, Landschaftsmerkmale -> `outdoor`; `dungeon` entfernt inkompatible Outdoor-Merkmale.
- Danach wählt der Generator aus 13 thematischen Vorlagen die passendste Vorlage und entscheidet bei Gleichstand zufällig.
- Builder ergänzen Gelände, Wege, Gebäude, Wasser, Dungeons, Walls, Doors, Licht, Nebel und Set Dressing.
- Eine passende Story-Szene wird mit 82 % Wahrscheinlichkeit ergänzt.
- `dark` ändert Paletten, Namenszusatz, Lichtquellen und die Sichtweite des Starthelden.
- Der alte Dungeon-Builder mit 3×3/4×4 Zellen bleibt vorerst im Legacy-Generator erhalten, ist aber nicht mehr der Hauptpfad der MapPlan-Pipeline. Der neue Pfad erzeugt zuerst einen Topologiegraphen, platziert freie Raumformen und routet anschließend Korridore, Doors, Walls und Ebenenübergänge.
- Der neue Outdoor-Pfad erzeugt zuerst semantische Voronoi-Regionen, danach kohärente Terrain-Felder, Kurvenwege und Wasserläufe. Vegetation wird aus lokaler Dichte abgeleitet; Start, Landmarken, Wege, Brücken und Wasser werden von zufälligen Blockern freigehalten.
- Nach der Dungeon- bzw. Outdoor-Geometrie folgt eine gemeinsame Set-Dressing-Stufe. Sie verteilt keine unverbundenen Einzelprops als Hauptmechanik, sondern setzt kontextabhängige Cluster aus MapPlan, Raumrolle, Region, Biom und Atmosphäre. Die finale `MapDefinition` erhält nur geprüfte Szenenobjekte.
- Jede neue Zufallskarte überschreibt wegen der festen ID die vorherige Zufallskarte. Session-Persistenz speichert nur die zuletzt generierte Karte.

Neue Generatorfeatures sollen langfristig in `MapGenerationRequest`/`MapPlan` ausdrückbar sein und nicht direkt UI- oder Renderer-Details als Eingabe verlangen. Der Local Planner und der AI Planner müssen semantisch dasselbe Planformat erzeugen; erst nach dem Plan folgen Geometrie, Materialien und Set Dressing.

## Regeln für neue Generatorfeatures

1. Zuerst den Datenvertrag definieren: Request, Plan und MapDefinition-Erzeugung getrennt halten.
2. Seed und alle Zufallsentscheidungen explizit durchreichen; kein unkontrolliertes `Math.random()` in Planner-, Layout- oder Testcode.
3. Für gleiche Anfrage plus Seed reproduzierbare Ergebnisse garantieren.
4. Generatorcode von Vue, Pinia, PixiJS, DOM und Browser-APIs trennen.
5. Geometrie für begehbare Räume, Sicht, Türen und Kollision ausdrücklich erzeugen; Dekoration darf nicht versehentlich Gameplay-Geometrie ersetzen.
6. Große Karten auf Objektanzahl, Wall-/Door-Segmentanzahl, Fog-Polygonzahl, Renderzeit und IndexedDB-Größe prüfen.
7. Keine riesige neue Datei erzeugen: Planner, Plan-Typen, Layout, Environment/Materials, Set Dressing und Validierung in fokussierte Module aufteilen.
8. Bestehende Presets/Registry wiederverwenden; neue Objekttypen nur ergänzen, wenn ein vorhandener Typ fachlich nicht ausreicht.
9. MapDefinition vor Übergabe an die Engine validieren. Zusätzlich Plan-Validierung für Bounds, Erreichbarkeit, Raumverbindungen, Türreferenzen und Levels vorsehen.
10. AI-Ausgaben strikt validieren und normalisieren; niemals ungeprüfte Modellantwort direkt als MapDefinition rendern.
11. Generatorfehler müssen ohne Seitenabsturz verständlich in die bestehende Fehlerbehandlung gelangen.
12. Bestehende Karten, Tokens, Fog, Sicht, Licht, Doors, Ebenen, Kollision und Session-Restore nicht regressiv verändern.

## Tests und Prüfungen

Relevante vorhandene Tests:

- `src/maps/validation.test.ts`: feste Karten, Zufallskarten über viele Seeds, Merkmale, Dungeon-Geometrie, Presets und Validierungsfehler.
- `src/maps/dungeon-generation/graphFirstDungeon.test.ts`: Determinismus, Erreichbarkeit, Schleifen, Eingänge, Raum-/Korridorvielfalt, Doors/Walls, Ebenen und 80-Raum-Performance.
- `src/maps/outdoor-generation/regionBasedOutdoor.test.ts`: Determinismus, Regionskonnektivität, Dichtefelder, Wege/Flüsse/Zuflüsse, Ufer/Brücken, geschützte Spielflächen, Biome, Validierung und Großkarten-Performance.
- `src/maps/set-dressing/setDressing.test.ts`: deterministische Szenencluster, freie Lager-/Ritualkerne sowie Platzierungsregeln für Innenflächen, Walls, Doors, Wasser und Hauptwege.
- `src/map-materials/materialSystem.test.ts`: Materialextraktion, deterministische Varianten, Rotation/Skalierung, Kanten, Validierung und Integration beider Generatorpfade.
- `src/map-engine/chunks/chunking.test.ts`, `performance.test.ts`: Klassifizierung, räumliche Chunks, Rotation/Sichtbereich, Zoom-LOD und reproduzierbare 50×50-/100×100-/150×150-/Großkartenprofile.
- `src/map-objects/registry.test.ts`: Registry, Presets, Overrides, unbekannte Typen und Serialisierung.
- `src/map-engine/visibility/visibility.test.ts`: Ray-/Tür-/Wall-basierte Sicht.
- `src/map-engine/collision/movement.test.ts`: Segmentüberschneidung, Bounds und Door-/Wall-Bewegungsblocker.
- `src/map-engine/fog/fogState.test.ts`: Erkundung und Begrenzung der gespeicherten Polygone.
- `src/map-engine/grid/coordinates.test.ts`: Hex-/Pixel-/Kameraumrechnung.
- `src/map-engine/spells/geometry.test.ts`, `src/stores/spellEffects.test.ts`: Zauberflächen.
- `src/components/RandomMapDialog.test.ts`: Merkmalsabhängigkeiten und Dialogzustand.
- `src/stores/session.test.ts`, `src/persistence/sessionPersistence.test.ts`: Snapshot/IndexedDB/Restore.
- `e2e/tabletop.spec.ts`: Laden fester Karten und Erzeugen einer Zufallskarte im Browser.
- `server/src/routes.test.ts`: fehlende Konfiguration, ungültige Requests/Responses, Rate Limits, sichere Fehler und UTC-Usage.
- `src/security/clientBundle.test.ts`: baut den Client mit Sentinel-Secrets und prüft, dass sie nicht im Bundle landen.

Nach Änderungen mindestens ausführen:

```sh
npm run type-check
npm run test:unit -- --run
```

Bei UI-, Canvas-, Loader- oder Generatoränderungen zusätzlich:

```sh
npm run test:e2e
npm run build
```

Für neue Generatorstufen sind insbesondere Tests auf deterministische Gleichheit, gültige MapDefinition, Erreichbarkeit, Merkmalskombinationen, Door-/Wall-Konsistenz und große Karten erforderlich. Visuelle Browser-Regressionen sind durch die vorhandenen E2E-Tests nur teilweise abgedeckt.

## Risiken für den geplanten Umbau

- `randomGenerator.ts` ist ein großer direkter MapDefinition-Builder; Extraktion ohne Verhaltensregression ist anspruchsvoll.
- `MapPlan` besitzt für Dungeon-/Cave-/Building-Karten Graph-, Layout-, Room-Shape-, Corridor-, Geometry- und semantische Set-Dressing-Stufen sowie für Outdoor-Typen Region-, Field-, Linear-Feature-, Vegetation-, Geometry- und Set-Dressing-Stufen. Materials bleiben weiter ausbaufähig.
- Der UI-Generator verwirft den Seed; reproduzierbare Fehlerberichte und Wiederholung benötigen ein persistiertes Request-/Seed-Modell.
- `zufallskarte` ist eine feste Singleton-ID; mehrere Varianten oder Historie erfordern eine bewusste Änderung von Map-Store und Session-Format.
- Sicht/Kollision verwenden derzeit explizite Walls/Doors, nicht automatisch Map-Object-Geometrie.
- Map-Validierung prüft keine globale Erreichbarkeit, Überlappung, Raumkonnektivität oder Pfadqualität.
- Sehr große Karten können weiterhin durch Fog-Polygone, dynamische Wasserobjekte, sehr viele Walls/Lichter und IndexedDB-Snapshots langsam oder groß werden. Materialterrain und statische Dekoration besitzen Chunk-Culling und Zoom-LOD; dynamische Systeme noch nicht durchgehend.
- Der Produktions-Build meldet bereits einen JavaScript-Chunk über 500 kB; zusätzliche Generator-/Planerlogik sollte die Bundlegröße nicht unnötig weiter erhöhen.
- Die aktuelle Bewegung prüft keine Token-gegen-Token-Kollision und besitzt keine Wegfindung.
- KI-Integration birgt Secret-Leak-, Schema- und Prompt-Injection-Risiken und darf nicht als Browser-API implementiert werden.
- Tests decken Datenvalidierung und Kerngeometrie gut ab, aber noch keine realistischen Performance-Grenzen oder umfassende visuelle Qualität.

## Arbeitsweise

Vor einer Änderung betroffene Datenflüsse und Tests prüfen. Kleine, reversible Schritte bevorzugen. Generatorlogik zuerst als reine Funktionen und Datenverträge testen; erst danach in `TabletopView` oder die Engine integrieren. Keine MapEngine-Neuschreibung, wenn eine neue Generatorstufe lediglich eine valide `MapDefinition` liefern muss.


## Verbindliche Regeln für wiederverwendbare Grafik und CI/CD

- Bäume, Felsen, Mauern, Deko und interaktive Objekte sind zentral registrierte Map Objects mit Presets; neue Karten verwenden dieselben Renderer. Keine kopierten objektbezogenen Grafikimplementierungen in Map-Dateien.
- Bodenmaterial bleibt im Materialsystem. Dekorative Walls verwenden `WallDefinition.appearance` und die gemeinsamen Module `src/map-engine/walls/`; die Geometrie für Bewegung, Türen und Sicht bleibt davon unabhängig. Bei Stiländerungen deterministische Tests und Sichtprüfung ergänzen.
- Neue Darstellungen müssen eine nachvollziehbare Materialwirkung (Form, Struktur, Kantenlicht, Schatten) liefern, lesbar bei üblichen Zoomstufen sein und große Karten nicht unnötig verlangsamen. Details siehe `docs/VISUAL-COMPONENTS.md`.
- Jede KI-Änderung erfolgt als Pull Request nach `main`. **Wenn der gesamte PR-Test-/Build-Workflow grün ist, wird der nicht als Draft markierte PR automatisch als Squash gemergt**. Dafür `auto-merge-green-pr.yml` beibehalten; kein händisches Mergen eines roten PRs. Der Merge löst über `firebase-hosting.yml` den erneuten Build und danach Firebase Hosting aus. Secrets gehören ausschließlich in GitHub Actions.
- Keine parallelen Firebase-CLI-Deploy-Workflows einchecken; es darf nur einen Live-Deployment-Pfad geben.
