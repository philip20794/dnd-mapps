# Wiederverwendbare Kartenelemente und visuelle Qualität

## Bestehende Architektur

Alle platzierbaren Props (Bäume, Steine, Truhen, Lichtquellen, Türen, gemauerte Objektwände
usw.) werden über `src/map-objects/registry.ts` registriert und durch Presets beschrieben.
`MapObjectDefinition` ist das einzige persistierte Format. Generatoren und feste Karten
verwenden vorhandene Typen, Presets und `src/maps/prefabs/common.ts` anstelle kopierter
Zeichencode-Varianten. Die Runtime wird über `createRuntimeObject` aufgelöst.

Bodenmaterialien liegen in `src/map-materials/` und werden chunkweise gerendert.
Interaktive Gegenstände dürfen nicht als dekorative Textur den Zustand verlieren.

## Architektur für Begrenzungsmauern

`WallDefinition` bleibt weiterhin die verbindliche Geometrie für Sicht und Kollision.
Die neue optionale Eigenschaft `appearance` kann `stone` oder `cave` sein:

- `stone`: behauene Mauern mit Steinquadern, Fugen, abgeschrägten Kanten und Schatten
- `cave`: unregelmäßiger Fels mit variierenden Steinformen und raueren Oberflächen
- ohne `appearance`: unsichtbare Sicht-/Kollisionsbegrenzung, kompatibel zu alten Karten

`src/map-engine/walls/wallGeometry.ts` erzeugt aus einem Segment deterministische,
grafikunabhängige Steine. `WallRenderer.ts` malt alle Segmente einer Ebene in ein einziges
PixiJS-`Graphics`; es entstehen keine einzelnen DisplayObjects pro Stein. Die visuelle
Mauer besitzt keine Interaktion und verändert weder Segment-Endpunkte noch Türen, Fog oder
Kollision. Die Darstellung verwendet keine externen Texturen.

Der Graph-First-Generator vergibt den Stil passend zur Kartenart, die Naerytar-Höhle
nutzt `cave`, und neu mit dem Editor angelegte Wände verwenden `stone`.
Das Karteneditor-Overlay zeigt weiterhin Auswahl, Endpunkte und Bearbeitungslinien.

## Regeln für weitere Grafiküberarbeitungen

- Ein Prop-Typ wird **einmal** zentral implementiert und für alle Karten über Presets
  parametriert; nicht verschiedene Renderfunktionen je Karte kopieren.
- Qualitätsmerkmale über gemeinsam nutzbare Stilmittel und Stilvarianten steuern:
  Materialpalette, Lichtkante, Kontaktschatten, deterministische Oberflächendetails.
- Prozedurales Material und statisches Dressing zusammenfassen oder cachen;
  keine Tausenden individueller Vue- oder PixiJS-Objekte für reine Dekoration.
- Optik darf Erreichbarkeit, Sichtregeln, Interaktion, Fog, Tokenbewegung und
  gespeicherte Karten nicht stillschweigend ändern.
- Visuelle Prüfung auf Desktop und Touchgerät ergänzen. Unit-Tests können die
  Reproduzierbarkeit prüfen, aber nicht beurteilen, ob die Mauern überzeugend aussehen.

## CI/CD

`.github/workflows/firebase-hosting.yml` ist der einzige Test-/Build-/Deploy-Workflow:
PRs nach `main` testen und bauen ohne Live-Deployment; ein Push nach `main` testet,
baut und deployed anschließend das Artefakt.

`.github/workflows/auto-merge-green-pr.yml` reagiert auf den erfolgreichen
PR-Workflow, sucht den noch offenen, nicht als Entwurf markierten PR mit exakt
dem geprüften Head-Commit, und merged ihn als Squash. Das löst den Push-Workflow
aus. Weil ein mit dem integrierten GitHub-Token ausgeführter Merge keinen Push-Workflow\nauslöst, startet der Merge-Workflow `firebase-hosting.yml` anschließend ausdrücklich per\n`workflow_dispatch`. Fehlgeschlagene Prüfungen blockieren den Merge.
Es wird kein ungeprüfter PR-Code in einem privilegierten Workflow ausgeführt.


## Sichtbare Maueroberflächen am Fog-Rand

Die normale Fog-Sicht und die Bewegungskollision bleiben am tatsächlichen
Wandsegment stehen. Die bereits berechneten `visibleBlockers` enthalten jedoch
diejenigen Wand-Teilstücke, die ein Held tatsächlich sehen kann. Der FogRenderer
zeichnet **nur diese sichtbaren Teilstücke** nochmals mit dem gemeinsamen
`drawWallSurfaces`-Renderer über die Fog-Textur. Dadurch sind Steinoberfläche,
Fugen und Mauerstärke auch am Sichtabbruch erkennbar. Nur an den Schnittenden
werden 0,04 Rastereinheiten (ca. 6 cm bei einem 1,5-m-Rasterfeld) überlappt,
um kleine Darstellungsrisse zu vermeiden.

Die vollständige Wandposition und ihre zufälligen Steinvarianten werden dabei
weiter vom ursprünglichen Wandsegment abgeleitet, nicht von der Sichtöffnung.
So verändern sich Fugen und Farben nicht, wenn Spieler Tokens bewegen.
Nicht sichtbare Wände und Inhalte hinter der Mauer werden **nicht** aufgehellt.
Für nicht dekorierte Sichtblocker und Türen bleibt die vorhandene Kontrastlinie.
Die Erkundungsmaske und die Sichtfeld-Rasterisierung werden nicht verändert.
