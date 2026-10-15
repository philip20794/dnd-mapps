# Karteneditor-Architektur

Der Karteneditor verwendet weiterhin `MapDefinition` als einzigen Kartenvertrag und die vorhandene Validierungs- und Render-Pipeline. TypeScript-Karten werden nie verändert: Beim ersten Einstieg entsteht eine eigene Karte mit neuer ID und `editor`-Herkunftsmetadaten.

Die Zustände sind bewusst getrennt:

1. `useMapStore` enthält geladene Originalkarten sowie ausschließlich gespeicherte eigene Karten.
2. `useMapEditorStore` hält den flüchtigen Entwurf, eine gespeicherte Baseline und die Undo-/Redo-Historie. Erst „Speichern“ übernimmt den validierten Entwurf in den Map-Store.
3. Session-Schema 3 persistiert eigene Karten separat in `customMaps`; das alte `generatedMaps`-Feld und Sitzungen der Versionen 1/2 bleiben kompatibel.

Spätere Werkzeuge sollen unveränderliche `MapDefinition`-Folgezustände erzeugen und über `mapEditorStore.apply(nextMap)` eintragen. Dadurch erhalten Wände, Gelände, Objekte und Ebenen automatisch Undo/Redo, Verwerfen, Validierung, Export/Import und Speicherung, ohne PixiJS-Runtimeobjekte in Pinia oder IndexedDB abzulegen.

## Gelände und Materialien

Der Editor bietet Materialauswahl, drei Pinselgrößen, Radierer, Materialauswahl und die vorhandenen Decal-Typen. Maus- und Touchpunkte werden während eines Strichs gesammelt und interpoliert. Erst `pointerup` erzeugt über denselben Editor-Store einen History-Eintrag. Die Pixi-Selection-Layer zeigt bis dahin nur die Pinselvorschau; Spielinteraktionen bleiben im Editormodus deaktiviert und eine zweite Berührung wechselt weiterhin in die Kamera-Geste.

Neue Farbe wird pro Ebene in einem `editor-material-<levelId>`-Layer abgelegt. Benachbarte gleichartige Zellen werden nach jedem Strich zu horizontalen und vertikalen Rechtecken zusammengefasst. Der Radierer entfernt je Rasterzelle nur die oberste Materialbelegung der aktiven Ebene, sodass darunterliegende Layer wieder sichtbar werden. Bestehende Flächen und Decals lassen sich über ihre beim Editor-Einstieg ergänzten IDs auswählen, ändern, duplizieren und löschen.

`MaterialRenderer.refreshChunks` kompiliert nach einem Pinselstrich nur die markierten 16×16-Chunks neu; direkte Änderungen im Eigenschaftenpanel dürfen weiterhin einen vollständigen Material-Refresh auslösen. Material-, Kanten- und Decal-Container der übrigen Chunks werden wiederverwendet. An Chunkgrenzen werden Nachbar-Chunks invalidiert, damit Übergänge korrekt bleiben.

Technische Grenzen:

- Der Pinsel arbeitet absichtlich rasterzellenbasiert. Freie Vektorpolygone oder Sub-Cell-Texturen gehören nicht zum bestehenden `MaterialAreaDefinition`-Vertrag.
- Beim Radieren einer älteren, prozedural variierten Quellfläche kann deren verbleibende Rechteckaufteilung neu kompaktifiziert werden. Die gespeicherte Darstellung bleibt danach deterministisch, einzelne prozedurale Varianten können sich in dieser bearbeiteten Fläche jedoch neu verteilen.
- Sehr stark wechselnde Materialien auf jeder einzelnen Zelle lassen sich naturgemäß schlechter zu Rechtecken verdichten als zusammenhängende Pinselzüge.
