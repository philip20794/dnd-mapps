# DnD Mapps – Funktionsweise der Web-App

Diese Dokumentation beschreibt den aktuellen Stand des Codes. Sie erklärt, was die Anwendung kann, wie die Teile zusammenspielen, wie normale Karten aufgebaut sind und wie der Zufallskarten-Generator arbeitet.

## 1. Zweck der Anwendung

`dnd-mapps` ist ein lokaler virtueller Spieltisch für Dungeons & Dragons und ähnliche Rollenspiele. Die App zeigt eine interaktive Battlemap und stellt dafür folgende Funktionen bereit:

- mehrere fest im Code definierte Karten
- prozedural erzeugte Zufallskarten
- verschiebbare Spieler-, NSC- und Monster-Tokens
- ein optionales Pointy-Top-Hexraster mit Einrasten
- Kamera-Zoom, Verschieben und Rotation in 90-Grad-Schritten
- Sichtbereiche, Sichtwinkel, Wände und Türen
- Fog of War mit optional gespeicherter Erkundung
- Lichtquellen und animierte Kartenobjekte
- platzierbare Zauberflächen
- mehrere Ebenen, sofern eine Karte sie definiert
- automatische lokale Speicherung im Browser

Die App hat kein Backend, keine Anmeldung und keine Mehrspieler-Synchronisierung. Alles läuft in einem Browser und wird nur in dessen IndexedDB gespeichert.

## 2. Verwendete Technik

| Aufgabe | Technik |
| --- | --- |
| Oberfläche und Komponenten | Vue 3 |
| globaler Zustand | Pinia |
| Navigation | Vue Router |
| Karten-Rendering | PixiJS |
| lokale Speicherung | IndexedDB über `idb` |
| Entwicklung und Build | Vite + TypeScript |
| Unit-Tests | Vitest |
| Browser-Tests | Playwright |

Vue verwaltet die Oberfläche und serialisierbare Daten. PixiJS verwaltet das Canvas, die Zeichenreihenfolge, Interaktionen und Animationen. PixiJS-Objekte werden bewusst nicht in Pinia gespeichert.

## 3. Ablauf beim Start

Der Start läuft in dieser Reihenfolge ab:

1. `src/main.ts` erzeugt die Vue-App, registriert Pinia und den Router und mountet die App in `#app`.
2. Der Router zeigt unter `/` die einzige Hauptansicht `TabletopView.vue`.
3. `TabletopView` ruft `loadMapDefinitions()` auf.
4. Der Loader importiert alle Dateien `src/maps/*.map.ts` automatisch und direkt beim Build über `import.meta.glob(..., { eager: true })`.
5. Jede geladene Karte wird validiert. Doppelte Karten-IDs, unbekannte Objekte oder Presets, falsche Maße, ungültige Ebenen und fehlerhafte Türverweise brechen das Laden mit einer verständlichen Meldung ab.
6. Die Karten werden nach ihrem deutschen Anzeigenamen sortiert und in den Map-Store geschrieben.
7. Danach versucht der Session-Store, den letzten Zustand aus IndexedDB wiederherzustellen.
8. Gibt es keinen gespeicherten Zustand, werden die Start-Tokens der ersten Karte eingesetzt und die Kamera auf die Karte eingepasst.
9. Gibt es einen Zustand, werden unter anderem Karte, Tokens, Türen, Fog, Kamera, Ebenen, Zauberflächen und die zuletzt generierte Zufallskarte wiederhergestellt.

## 4. Datenfluss und Architektur

```text
Benutzer
   │ Klick, Drag-and-drop, Mausrad, Tastatur
   ▼
Vue-Komponenten
   │ Events
   ▼
TabletopView
   │ schreibt Zustand
   ▼
Pinia-Stores ───────────────► Session-Store ─► IndexedDB
   │ Props / Watcher
   ▼
MapCanvas
   │ synchronisiert Daten
   ▼
MapEngine (PixiJS)
   │ zeichnet und meldet Interaktionen zurück
   └────────────────────────► Vue-Komponenten
```

### Zentrale Dateien

| Datei/Ordner | Verantwortung |
| --- | --- |
| `src/views/TabletopView.vue` | verbindet UI, Stores, Engine, Generator und Speicherung |
| `src/components/TopToolbar.vue` | Kartenwahl, Zufallskarte, Fog, Raster, Drehung und Reset |
| `src/components/SidebarPanel.vue` | Token-Bibliothek, Token-Eigenschaften und Zauberflächen |
| `src/components/MapCanvas.vue` | Brücke zwischen Vue und `MapEngine` |
| `src/map-engine/MapEngine.ts` | PixiJS-Rendering, Kamera und Canvas-Interaktionen |
| `src/stores` | serialisierbarer Anwendungszustand |
| `src/maps` | Kartenformat, feste Karten, Loader, Validierung und Zufallsgenerator |
| `src/map-objects` | registrierte Objekttypen, Presets und Renderer |
| `src/persistence` | IndexedDB-Zugriff |

## 5. Bedienung und Interaktionen

### Karten und Kamera

- Die Toolbar wählt eine feste oder die aktuell generierte Karte aus.
- Das Mausrad zoomt auf die Mausposition.
- Mittlere/rechte Maustaste oder Leertaste plus Ziehen verschieben die Karte.
- „90 Grad drehen“ schaltet zwischen 0, 90, 180 und 270 Grad um.
- „Kamera“ im Reset-Menü passt die Karte erneut in den sichtbaren Bereich ein.
- Kameraänderungen werden nach 350 ms ohne weitere Änderung automatisch gespeichert.

### Tokens

- Held, Magier, Goblin und Skelett stehen als Vorlagen in der Seitenleiste.
- Eine Vorlage wird per Drag-and-drop auf die Karte gezogen.
- Die Mausposition wird von Bildschirm- über Kamera- in Kartenkoordinaten umgerechnet.
- Bei aktivem „Hex einrasten“ wird die Position auf das nächste Hexzentrum gesetzt.
- Vorhandene Tokens lassen sich ziehen, auswählen, bearbeiten und löschen.
- Name, Größe, Rotation, Sichtweite, Sichtwinkel und Sichtaktivierung sind editierbar.
- Ein Token darf die Kartengrenze oder ein bewegungsblockierendes Wand-/Türsegment nicht überqueren.

### Türen

Eine interaktive Tür benötigt zwei Einträge mit derselben ID:

1. ein sichtbares Kartenobjekt, zum Beispiel `wooden-door`
2. eine `DoorDefinition` mit Segment, Anfangszustand und Blockierregeln

Beim Anklicken wechselt der Zustand zwischen `open` und `closed`. Eine geschlossene Tür kann Sicht und Bewegung blockieren. Der Zustand wird pro Karte gespeichert.

### Zauberflächen

- Langes Drücken auf ein Token öffnet ein Radialmenü.
- Nach Auswahl einer Form zeigt die Engine eine Vorschau.
- Ein Klick platziert die Form; Aura-/Emanationsformen können an den Zaubernden gebunden sein.
- Ausgewählte Formen lassen sich verschieben, skalieren, drehen oder löschen.
- Größen werden intern aus Fuß in Rastereinheiten umgerechnet.

### Ebenen

Eine Karte kann mehrere Ebenen besitzen. Objekte, Wände, Türen, Tokens und Zauberflächen können über `levelId` einer Ebene zugeordnet werden. Übergangsobjekte können ein Token zu einer Zielposition auf einer anderen Ebene bewegen. Karten ohne Ebenendefinition verwenden intern die Ebene `ground`.

## 6. Rendering mit PixiJS

`MapCanvas.vue` erzeugt genau eine `MapEngine`. Vue-Watcher übertragen jede relevante Änderung an die Engine: Karte, Ebene, Tokens, Türen, Einstellungen, Fog und Zauberflächen.

Die Engine zeichnet in einer festen Reihenfolge:

1. `background`
2. `floor`
3. `grid`
4. `terrainStatic`
5. `terrainAnimated`
6. `objectsStatic`
7. `interactiveObjects`
8. `wallsDoors`
9. `effects`
10. `spellEffects`
11. `tokens`
12. `light`
13. `fog`
14. `selection`

Dadurch liegen beispielsweise Bodenflächen unter Objekten, Tokens unter Licht/Fog und Auswahlmarkierungen ganz oben.

Kartenkoordinaten sind logische Rastereinheiten. Zum Zeichnen werden sie mit `gridSize` multipliziert. Bei `gridSize: 48` wird aus Position `(5, 10)` die Pixelposition `(240, 480)` vor Kamera-Transformationen.

## 7. Kartenformat

Jede feste Karte exportiert eine `MapDefinition` als Standardexport:

```ts
defineMap({
  id: 'meine-karte',
  name: 'Meine Karte',
  width: 30,
  height: 20,
  gridSize: 48,
  objects: [],
  walls: [],
  doors: [],
  spawnPoints: [],
  startTokens: [],
})
```

Die wichtigsten Bestandteile sind:

- `objects`: sichtbare Böden, Bäume, Felsen, Gebäude, Feuer, Wasser, Türen und Dekorationen
- `walls`: Liniensegmente für Sicht- und/oder Bewegungssperren
- `doors`: schaltbare Liniensegmente für Sicht und Bewegung
- `spawnPoints`: markierte Startbereiche
- `startTokens`: Tokens, die beim erstmaligen Öffnen oder Token-Reset eingesetzt werden
- `levels`: optionale Ebenen

### Objektbibliothek

Ein Kartenobjekt beschreibt hauptsächlich Typ, Preset, Position, Größe und optionale Überschreibungen. Das zentrale Register ergänzt daraus Defaults und wählt den passenden Renderer.

Beispiel:

```ts
{
  id: 'tree-1',
  type: 'tree',
  preset: 'old-oak',
  position: { x: 4, y: 3 },
}
```

Das Preset bestimmt das Grundaussehen; die Karte kann einzelne Werte wie Farbe, Größe, Rotation, Licht oder Layer überschreiben.

Wichtig für den aktuellen Stand: Die eigentliche Sicht- und Bewegungsauswertung liest die expliziten Einträge in `map.walls` und `map.doors`. Die Felder `blocksSight` und `blocksMovement` an beliebigen sichtbaren Objekten reichen allein momentan nicht aus, um Tokens oder Sichtstrahlen zu blockieren. Für zuverlässige Blocker muss daher zusätzlich passende Wand-/Türgeometrie in der Karte existieren.

## 8. Die Karte „3. Kapitel Barikarde“

Die Datei `src/maps/kapitel-3-barikarde.map.ts` ist eine vollständig von Hand definierte Karte.

### Grunddaten

| Eigenschaft | Wert |
| --- | --- |
| ID | `kapitel-3-barikarde` |
| Name | `3. Kapitel Barikarde` |
| Größe | 36 × 22 Rastereinheiten |
| Rastergröße | 48 Pixel |
| ungedrehte Zeichenfläche | 1728 × 1056 Pixel |
| Ebenen | keine expliziten, daher `ground` |
| Türen | keine |
| Spawnpunkte | keine |

### Aufbau

- `groundObjects` erzeugt die Wiese, Hügelbereiche, Waldränder, lockeren Kies und den zertrampelten Bereich an der Barrikade.
- `pathObjects` baut den leicht gebogenen Ost-West-Weg aus mehreren Bodenflächen und zusätzlichen Fahrspuren.
- `hillSlopeObjects` zeichnet die Höhenkonturen im Norden und Süden.
- `natureObjects` verteilt Bäume und Felsen um den Weg.
- `undergrowthObjects` ergänzt Büsche und Dickicht.
- `vehicleObjects` setzt je einen Wagen und Ochsen vor beziehungsweise hinter die Barrikade.
- `barricadeObjects` erzeugt die Stachelbarrikade, Felsen, Warnpfosten und eine Vorratskiste.
- `lightObjects` legt eine schwache Tageslichtfläche über die ganze Karte.

Die sichtbare Barrikade ist nicht selbst die einzige Kollisionsquelle. Zusätzlich erzeugt `movementBlocker(...)` ein senkrechtes Segment von `(17.55, 7.4)` bis `(17.55, 13.75)`. Es blockiert Bewegung, aber nicht die Sicht. Dadurch kann ein Token nicht durch die Straßensperre gezogen werden, die Spielfiguren können jedoch hindurchsehen.

Die Karte startet mit einem Helden bei `(5.5, 10.4)`. Seine Sichtweite ist 9 Rastereinheiten, sein Sichtwinkel ist unbegrenzt und die Sichtberechnung ist aktiv.

## 9. Zufallskarten – Bedienung

Es gibt zwei Wege:

### Direkter Button „Zufallskarte“

- Wurde noch nie konfiguriert, wird ohne Merkmale generiert.
- Ist Fog gerade aktiv, wird beim ersten Schnellstart automatisch `Dunkel` verwendet.
- Wurde der Konfigurationsdialog schon benutzt, verwendet der Button die zuletzt gewählte Kombination erneut.

### „Karte konfigurieren“

Der Dialog bietet Merkmale aus vier Gruppen:

| Gruppe | Merkmale |
| --- | --- |
| Ort | Outdoor, Dungeon |
| Landschaft | Wald, Schnee, Sumpf, Wüste, Ruinen, Siedlung |
| Elemente | Fluss, Wasser, Schiff |
| Atmosphäre | Dunkel |

Regeln und Abhängigkeiten:

- `Fluss` ergänzt automatisch `Wasser`.
- `Schiff` ergänzt automatisch `Outdoor` und `Wasser`.
- `Wald`, `Sumpf`, `Wüste` und `Siedlung` ergänzen automatisch `Outdoor`.
- `Dungeon` entfernt `Outdoor`, `Wald`, `Sumpf`, `Wüste`, `Siedlung` und `Schiff`.
- Eine Outdoor-Auswahl entfernt umgekehrt `Dungeon`.
- Wird `Wasser` ausgeschaltet, werden auch `Fluss` und `Schiff` entfernt.
- `Schnee`, `Ruinen`, `Wasser`, `Fluss` und `Dunkel` können auch mit einem Dungeon kombiniert werden.
- Ohne Auswahl entscheidet der Generator vollständig zufällig zwischen allen Grundvorlagen.

## 10. Zufallskarten – interner Algorithmus

Der Einstieg ist `createRandomMap(options)` in `src/maps/randomGenerator.ts`.

### Schritt 1: Seed und Zufallszahlen

- Über die API kann ein fester `seed` übergeben werden.
- Die Oberfläche übergibt keinen Seed; dort wird mit `Math.random()` ein 32-Bit-Seed erzeugt.
- Aus dem Seed erzeugt `mulberry32` eine deterministische Folge von Zufallszahlen.
- Derselbe Seed mit denselben Merkmalen erzeugt deshalb dieselbe Auswahl und Geometrie.
- Der fertige Karteninhalt wird gespeichert, nicht der Seed als eigenes Feld.

### Schritt 2: Merkmale normalisieren

`normalizeRandomMapFeatures()` ergänzt Abhängigkeiten und löst Dungeon-/Outdoor-Widersprüche auf. Das schützt auch Aufrufe außerhalb des Dialogs vor ungültigen Kombinationen.

### Schritt 3: Kartengröße festlegen

- Breite: zufällig 30 bis 48 Rastereinheiten
- Höhe: zufällig 26 bis 42 Rastereinheiten
- Rastergröße: immer 48 Pixel

Danach wird ein leerer Generierungskontext mit Arrays für Objekte, Wände und Türen aufgebaut.

### Schritt 4: Grundvorlage wählen

Der Generator besitzt 13 Grundvorlagen:

1. Waldweg
2. Weiler am Handelsweg
3. Ruinen
4. Sumpfübergang
5. Höhenlager
6. verlassener Bauernhof
7. Höhleneingang
8. gemauerter Dungeon
9. Höhlenlabyrinth
10. heiliger Hain
11. verschneiter Pass
12. verbranntes Schlachtfeld
13. Wüstenoase

Bei `Dungeon` kommen nur Dungeon-Vorlagen infrage. Bei einer Outdoor-Auswahl kommen nur Outdoor-Vorlagen infrage. Anschließend erhält jede mögliche Vorlage einen Punkt für jedes passende gewünschte Spezialmerkmal. Aus den Vorlagen mit der höchsten Punktzahl wird zufällig eine gewählt.

Beispiel: Für `Outdoor + Sumpf + Fluss` passt der Sumpfübergang mit seinen Merkmalen `outdoor`, `swamp`, `water` und `river` besser als ein allgemeines Höhenlager.

### Schritt 5: Vorlage bauen

Jede Vorlage hat eine eigene Builder-Funktion. Sie setzt eine Grundfläche und kombiniert passende Helfer, zum Beispiel:

- gewundene Wege und Nebenpfade
- Flüsse, Teiche und Brücken
- Gebäude mit Wand- und Türsegmenten
- Felder, Zäune, Lager und Ladung
- Bäume in Clustern, Unterholz, Felsen und Hügel
- Nebel, Feuer, Fackeln und Tageslicht
- thematische Bodenflecken

Die Positionen, Größen, Presets, Farben und Mengen werden innerhalb kontrollierter Bereiche variiert.

### Schritt 6: optionale Story-Szene

Hat die gewählte Vorlage Story-Szenen, wird mit 82 % Wahrscheinlichkeit eine hinzugefügt. Mögliche Szenen sind:

- verlassener Karren
- Grabstelle
- Holzfällerlager
- Ritualplatz
- Spinnennest
- Wachlager

Eine Story-Szene ist kein Textabschnitt, sondern eine zusammengehörige Gruppe sichtbarer Objekte. Ihr Typ fließt außerdem in den erzeugten Kartennamen ein.

### Schritt 7: zusätzlich gewählte Merkmale überlagern

`addSelectedFeatureLayers()` prüft, was die Vorlage bereits enthält, und ergänzt nur fehlende Elemente:

- `Schnee` verändert den Grundboden und ergänzt in Dungeons Schnee-/Nasssteinflächen.
- `Wald` garantiert eine höhere Baumdichte und Unterholz.
- `Sumpf` ergänzt Schlamm, Nassflächen, ein Wasserbecken und Schilf.
- `Fluss` ergänzt einen horizontalen, vertikalen oder unterirdischen Fluss.
- `Wasser` ergänzt einen Teich, falls noch kein Wasser existiert.
- `Schiff` erzeugt eine Wasserbucht plus Schiff oder Wrack.
- `Ruinen` ergänzt Mauern, Säulen und Geröll, falls die Vorlage noch keine Ruine besitzt.
- `Siedlung` ergänzt ein Gebäude, falls die Vorlage noch keine Bebauung besitzt.

Dadurch werden Merkmale kombiniert und nicht nur als Filter für eine fertige Karte benutzt.

### Schritt 8: Licht und Dunkelheit

- Helle Karten verwenden hellere Paletten und normalerweise eine `daylight-area`.
- Dunkle Karten verwenden dunklere Paletten und platzieren passende Lichtobjekte wie Fackeln, Kerzen, Feuer oder magische Lichter.
- `Dunkel` beeinflusst außerdem Namenszusätze und reduziert die Sichtweite des erzeugten Starthelden von 9 auf 7.

### Schritt 9: Name und Start-Token

Der Name besteht aus einem zufälligen Vorlagennamen, optionaler Story-Bezeichnung, einem hellen/dunklen Zusatz und `(hell)` beziehungsweise `(dunkel)`.

Jede Zufallskarte erhält einen Helden. Die Builder können eine sinnvolle Startposition festlegen; sonst liegt sie mittig nahe dem unteren Rand.

### Schritt 10: Karte in die App übernehmen

Alle Zufallskarten haben absichtlich dieselbe ID `zufallskarte`. `upsertGeneratedMap()` ersetzt daher die vorherige Zufallskarte, statt immer neue Einträge in der Kartenauswahl anzulegen. Danach werden Tokens, Zauberflächen und Fog dieser Karte zurückgesetzt, die Kamera wird eingepasst und die neue Karte automatisch gespeichert.

Folge: In einer Sitzung existiert immer nur die zuletzt generierte Zufallskarte. Die fertige `MapDefinition` wird in IndexedDB gespeichert und beim nächsten Start wiederhergestellt.

## 11. Besonderheit des Dungeon-Generators

Dungeon und Höhlen verwenden einen eigenen rasterbasierten Algorithmus:

1. Die Karte wird in 3 × 3 oder bei größeren Karten in bis zu 4 × 4 Zellen eingeteilt.
2. Die Zellen werden mit dem Seed gemischt.
3. In ausgewählten Zellen entstehen 7 bis maximal 12 rechteckige Räume.
4. Als Start der Verbindungsreihenfolge dient der am weitesten unten liegende Raum.
5. Von dort wird jeweils der nächste räumlich nächste Raum gewählt.
6. Räume werden mit zwei Rastereinheiten breiten L-förmigen Korridoren verbunden; Höhlen können teilweise breitere Korridore erhalten.
7. Zusätzlich entstehen ein bis drei mögliche Schleifen, damit der Dungeon nicht nur eine lineare Kette ist.
8. Aus den Übergängen zwischen begehbaren und nicht begehbaren Rasterzellen werden zusammenhängende Wandsegmente erzeugt.
9. An Raumverbindungen werden Türen platziert. Die sichtbare Tür und ihre `DoorDefinition` erhalten dieselbe ID.
10. Räume bekommen thematisches Inventar, Nebel und bei dunklen Karten Lichtquellen. Höhlen können Wasserbecken enthalten.
11. Der Startheld erscheint im unteren Startraum.

Der Dungeon ist damit echte Geometrie mit Sicht- und Bewegungswänden, nicht nur eine zufällige Dekoration.

## 12. Sicht, Licht und Fog of War

### Sicht

Für jedes Token mit aktivierter Sicht wird ein Sichtpolygon berechnet:

- voller Kreis: 96 Strahlen
- begrenzter Sichtkegel: 40 Strahlen
- maximale Länge: `visionRange`
- Richtung: Token-Rotation
- Hindernisse: Kartenrand, sichtblockierende Wandsegmente und geschlossene Türen

Die Strahlen werden zusätzlich auf Endpunkte von Hindernissen ausgerichtet, damit Ecken sauberer abgebildet werden.

### Licht

Radiale Lichtquellen und Tageslichtflächen sind getrennt vom normalen Token-Sichtbereich. Ein Lichtbereich erweitert die aufgedeckte Fläche nur, wenn das Token das Licht geometrisch erreichen beziehungsweise wahrnehmen kann. Geschlossene sichtblockierende Türen und Wände begrenzen auch diese Berechnung.

### Fog

Bei aktivem Fog kennt die App drei Zustände:

- aktuell sichtbar: transparent
- früher erkundet: teilweise abgedunkelt
- unbekannt: vollständig verdeckt

Mit „Erkundung speichern“ werden neue Sichtpolygone pro `Karten-ID:Ebenen-ID` gesammelt. Pro Schlüssel bleiben höchstens die letzten 160 Polygone erhalten. Bei „Nur aktuelle Sicht“ wird keine Historie verwendet.

## 13. Bewegung und Kollision

Beim Ziehen eines Tokens prüft die Engine:

1. Liegt der Zielpunkt einschließlich Tokenradius innerhalb der Karte?
2. Schneidet oder unterschreitet die Bewegungslinie den Sicherheitsabstand zu einer blockierenden Wand?
3. Ist eine betroffene Tür geschlossen und `blocksMovementWhenClosed` aktiv?

Der Sicherheitsabstand beträgt mindestens `0.08`, sonst 75 % des Tokenradius. Bei einer ungültigen Bewegung verwirft die Engine den Zielpunkt und setzt das Token auf seine Ausgangsposition zurück.

Das ist eine segmentbasierte Kollisionsprüfung, keine vollständige Physik- oder Wegfindungs-Engine. Andere Tokens werden derzeit nicht als Kollisionshindernisse behandelt.

## 14. Speicherung

Die Datenbank heißt `dnd-mapps-session`, der Object Store `sessions` und der aktuelle Datensatz `current`.

Gespeichert werden:

- ausgewählte Karte
- alle platzierten Tokens
- Zauberflächen
- die zuletzt generierte Zufallskarte als vollständige Kartendefinition
- Türzustände pro Karte
- aktuelle Ebene pro Karte
- Fog-Einstellungen und erkundete Polygone
- Kamera, Kartenrotation, Raster-, Animations- und Lichteinstellungen
- Speicherzeitpunkt

Das Schema hat aktuell Version 1. Änderungen werden typischerweise mit 350 ms Verzögerung automatisch gespeichert. Reset-Funktionen können Kamera, Tokens, Fog oder die ganze Sitzung getrennt zurücksetzen.

Die Speicherung ist browser- und profilgebunden. Ein anderer Browser oder ein anderes Gerät sieht die Daten nicht.

## 15. Validierung und Tests

Der Loader validiert feste Karten vor der Benutzung. Zufallskarten werden in den Unit-Tests über viele Seeds und Merkmalskombinationen geprüft.

Vorhandene Tests decken unter anderem ab:

- Kartenvalidierung und Objektregister
- helle und dunkle Zufallskarten
- Namens- und Layoutvielfalt
- Merkmalskombinationen und Abhängigkeiten
- Dungeon-Wände und Türen
- Sicht, Fog, Hexkoordinaten und Kollision
- Speicherung und Wiederherstellung
- Zauberflächen
- Konfigurationsdialog
- grundlegende Browserabläufe mit Playwright

Die wichtigsten Befehle sind:

```sh
npm run type-check
npm run test:unit -- --run
npm run test:e2e
npm run build
```

## 16. Grenzen des aktuellen Systems

- kein Backend und keine Synchronisierung zwischen Geräten
- keine getrennte Spielleiter-/Spieleransicht
- keine Benutzer, Rollen oder Berechtigungen
- kein visueller Karteneditor
- nur eine gespeicherte Zufallskarte gleichzeitig
- kein in der Oberfläche eingebbarer oder sichtbarer Seed
- keine Token-gegen-Token-Kollision
- keine Wegfindung
- sichtbare Objekt-Blocker benötigen aktuell zusätzliche Einträge in `walls` oder `doors`
- Licht wird grafisch weich dargestellt, die Fog-Lichtgeometrie wird aber segmentbasiert begrenzt
- gespeicherte Daten haben aktuell keine Export-/Import-Oberfläche

## 17. Wo Änderungen vorgenommen werden

| gewünschte Änderung | wichtigste Stelle |
| --- | --- |
| neue feste Karte | neue Datei `src/maps/*.map.ts` |
| neues Kartenmerkmal | `RandomMapFeature`, Dialogoptionen, Normalisierung und Feature-Layer |
| neue Zufallskartenvorlage | neuer Builder plus Eintrag in `randomMapTemplates` |
| neuer Objekttyp | Modul unter `src/map-objects/objects` und Registrierung |
| neues Preset | passendes Objektmodul |
| neue Token-Vorlage | `src/types/tokens.ts` |
| neue Zauberform | `src/types/spells.ts` und gegebenenfalls Renderer/Geometrie |
| andere Speicherstruktur | Session-Typ, Store und Schema-Migration |
| andere Sichtregeln | `src/map-engine/visibility/visibility.ts` |
| andere Kollisionsregeln | `src/map-engine/collision/movement.ts` |
