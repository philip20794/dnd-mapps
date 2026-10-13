# Technisches Audit – dnd-mapps

Stand: 28. September 2026

## Kurzfazit

`dnd-mapps` besitzt inzwischen eine tragfähige Generatorarchitektur. Die Trennung von
`MapGenerationRequest`, Planner, `MapPlan`, Geometrie, Materialien, Set Dressing und
`MapDefinition` ist fachlich sinnvoll. Der lokale Generator ist reproduzierbar, Dungeon- und
Outdoor-Karten besitzen eigene moderne Pipelines, und die PixiJS-Engine hält interaktive Daten von
statischer Darstellung getrennt.

Der Stand ist jedoch noch nicht produktionsreif für eine öffentlich erreichbare KI-Funktion. Die
wichtigsten Blocker sind die fehlende App-Check-Anbindung im Browser, fehlende harte Eingabe- und
Kostenlimits sowie die fehlende finale Validierung generierter beziehungsweise restaurierter
`MapDefinition`-Daten. Große Karten funktionieren in den vorhandenen CPU-Profilen gut, echte
Browser-FPS, GPU-Speicher, Fog, Licht und große Wall-Mengen sind aber noch nicht belastbar gemessen.

## Was die Anwendung macht

Die Anwendung ist ein lokaler virtueller Spieltisch auf Basis von Vue 3, Pinia und PixiJS. Sie lädt
fest definierte Karten und kann prozedurale Karten erzeugen. Auf den Karten können Tokens platziert
und bewegt, Türen geöffnet, Ebenen gewechselt, Zauberflächen eingezeichnet und Fog of War samt
Erkundungsstand verwaltet werden. Sitzung, Kartenstatus und die zuletzt generierte Zufallskarte
werden lokal in IndexedDB gespeichert.

Der Zufallskartenfluss ist:

```text
RandomMapDialog
  -> MapGenerationRequest
  -> MapGenerationService
     -> LocalMapPlanner
     -> oder /api/map-plan -> AiMapPlanner -> bei Fehler LocalMapPlanner
  -> validierter MapPlan
  -> Graph-First-Dungeon oder regionenbasierter Outdoor-Generator
  -> Materialien und semantisches Set Dressing
  -> MapDefinition
  -> Pinia / MapCanvas / MapEngine / PixiJS
```

Nach der einmaligen Seed-Erzeugung verwendet die neue Pipeline einen deterministischen PRNG. Ein
gleicher Request mit gleichem Seed und Plan erzeugt damit dieselbe Karte. Die alte monolithische
Zufallsgenerierung bleibt nur als Kompatibilitätspfad bestehen.

## Positiv geprüfte Architektur

- `MapDefinition` bleibt der stabile Vertrag zur bestehenden Engine.
- Planner- und Generatorcode sind weitgehend frei von Vue-, Pinia- und PixiJS-Abhängigkeiten.
- Local Planner und AI Planner liefern dasselbe `MapPlan`-Format.
- Die AI-Anbindung liegt in Firebase Functions; OpenAI-Schlüssel werden nicht im Browsercode
  verwendet. Ein Bundle-Test prüft zusätzlich auf Sentinel-Secrets.
- Structured Output besitzt ein striktes JSON-Schema. Danach folgen Laufzeit- und fachliche
  Validierung, höchstens ein Reparaturversuch und ein lokaler Fallback.
- Die Usage-Anzeige bezeichnet API-Kosten, konfiguriertes Budget und unbekanntes Freikontingent
  korrekt getrennt.
- Dungeon-Geometrie entsteht graph-first; Outdoor-Geometrie aus zusammenhängenden Regionen,
  Feldern, Wegen und Gewässern.
- Set Dressing arbeitet mit semantischen Clustern und geschützten Bereichen.
- Statisches Materialterrain und statische Objekte sind gechunkt. Tokens, Türen, Walls, Licht, Fog
  und Effekte bleiben interaktiv und separat.
- 152 Unit-Tests prüfen unter anderem Determinismus, Vielfalt, Geometrie, Sicht, Kollision,
  Persistenz, Serverfehler und Secret-Leaks.

## Befunde nach Priorität

### A-01 – Hoch: App Check ist serverseitig erzwungen, clientseitig aber nicht eingerichtet

`server/src/firebase.ts` setzt für beide HTTP-Funktionen `enforceAppCheck: true`.
`src/map-generation/aiPlannerClient.ts` und `src/ai/usage.ts` senden normale `fetch`-Anfragen, aber
kein `X-Firebase-AppCheck`-Token; im Client existiert auch keine Firebase-App-Check-Abhängigkeit.
Damit werden die KI-Endpunkte in einer korrekt geschützten Produktionsumgebung voraussichtlich
abgelehnt. Die Kartengenerierung fällt dabei still auf den Local Planner zurück, während die
Usage-Anzeige lediglich einen unauffälligen Fehlerzustand zeigt.

Empfehlung: Firebase Web App Check initialisieren, Token vor beiden Requests beziehen und mitsenden.
Emulator-/Entwicklungsbetrieb separat konfigurieren und den Produktionspfad per Integrationstest
prüfen.

### A-02 – Hoch: Kein anwendungsseitiges Rate- oder Ausgabenlimit

App Check bestätigt eine echte App-Instanz, ist aber weder Benutzer-Authentifizierung noch ein
Ausgabenlimit. Jeder gültige Client kann wiederholt `/api/map-plan` aufrufen. Das konfigurierte
`AI_DAILY_BUDGET_USD` wird nur angezeigt; es stoppt keine Anfrage. Dadurch besteht bei öffentlicher
Bereitstellung ein Kostenmissbrauchsrisiko.

Empfehlung: serverseitige Rate Limits und ein hartes Tagesbudget vor dem OpenAI-Aufruf erzwingen;
bei Bedarf zusätzlich Authentifizierung beziehungsweise anonyme, begrenzte Benutzerkontingente.
Der Local Planner ist bereits ein geeigneter Fallback bei ausgeschöpftem Limit.

### A-03 – Hoch: Unbegrenzte Eingabewerte ermöglichen Ressourcen- und Kostenmissbrauch

Die Request-Validierung verlangt nur positive Ganzzahlen. Sie begrenzt weder Länge der Beschreibung
noch `width`, `height`, Raum-, Ebenen- oder Eingangsanzahl. Ein manipulierter Request kann daher
sehr große lokale Pläne, teure KI-Prompts oder extrem große Geometrie und IndexedDB-Daten auslösen.
Die UI-Minimalwerte schützen den HTTP-Endpunkt nicht.

Empfehlung: zentrale, fachlich begründete Maximalwerte im gemeinsamen Request-Schema definieren,
beispielsweise für Beschreibungslänge, Kartenzellen, Räume, Ebenen und Eingänge. Zusätzlich
Request-Body-Limit, OpenAI-Ausgabelimit und serverseitigen Timeout festlegen.

### A-04 – Hoch: Generierte und restaurierte Karten werden nicht abschließend validiert

Feste Karten laufen in `src/maps/loader.ts` durch `validateMapDefinition`. Der
`MapGenerationService` übernimmt die von den Geometriegeneratoren erzeugte `MapDefinition` dagegen
ohne dieselbe finale Prüfung. Beim Session-Restore wird eine generierte Karte nur oberflächlich auf
ID, Maße und vorhandene Arrays geprüft. Ungültige Door-Referenzen, Levels, Objekte oder
Materialdaten können so bis zur Engine gelangen.

Empfehlung: jede erzeugte und restaurierte Karte vor `upsertGeneratedMap` beziehungsweise
Engine-Übergabe vollständig validieren. Für gespeicherte Daten zusätzlich eine Migration oder ein
verständliches Verwerfen beschädigter Altstände vorsehen.

### A-05 – Mittel bis hoch: Bekannte Schwachstellen in transitiven Abhängigkeiten

`npm audit --omit=dev` meldet im Root-Paket zwei hohe und eine moderate transitive Schwachstelle:

- `@xmldom/xmldom@0.8.13` über PixiJS: mehrere XML-Injection- und Ressourcenverbrauchsprobleme.
- `nanoid@3.3.16` und `postcss@8.5.19` über den Build-Stack.

Im Serverpaket werden zwei moderate Befunde über `firebase-functions -> firebase-admin ->
@google-cloud/storage -> gaxios@6.7.1 -> uuid@9.0.1` gemeldet. Für alle Befunde ist laut npm eine
Aktualisierung verfügbar. Das praktische Risiko von `xmldom` ist aktuell reduziert, weil die App
keinen Upload oder das Parsen fremder SVG/XML-Dateien anbietet; der verwundbare Code bleibt dennoch
Teil des Abhängigkeitsbaums.

Empfehlung: kompatible Patch-/Minor-Updates getrennt testen und danach beide Audits erneut
ausführen. Keine blinden Major-Upgrades oder erzwungenen Overrides ohne Pixi-/Firebase-Test.

### A-06 – Mittel: „Kein Wasser“ geht bei der Normalisierung verloren

`normalizeMapGenerationRequest` filtert den expliziten Wert `none` aus `waterFeatures` und setzt das
Feld anschließend auf `undefined`. Damit wird „ausdrücklich kein Wasser“ ununterscheidbar von „der
Planner darf entscheiden“. Dasselbe Muster betrifft das explizite Thema `none`. Die AI-Constraint
für `waterFeatures: ['none']` kann nach der clientseitigen Normalisierung nicht mehr greifen.

Empfehlung: explizite Negativvorgaben im Request erhalten oder als eigenes boolesches Constraint
modellieren. Tests für `none` durch UI, Service, Remote Planner und Local Planner ergänzen.

### A-07 – Mittel: Usage-Aktualisierung erfolgt beim Klick, nicht nach abgeschlossener KI-Anfrage

`RandomMapDialog.generate()` emittiert `generate` und startet direkt danach den Usage-Refresh. Der
asynchrone Map-Request im Parent ist zu diesem Zeitpunkt noch nicht abgeschlossen. Zusammen mit
verzögerten OpenAI-Kostendaten kann die Anzeige daher den alten Wert behalten. Beim Schließen des
Dialogs wird außerdem der regelmäßige Refresh gestoppt.

Empfehlung: Der Generation Service beziehungsweise `TabletopView` sollte nach Abschluss ein
eigenes Ergebnisereignis auslösen; erst dann Usage invalidieren und beim nächsten Öffnen erneut
laden.

### A-08 – Mittel: KI-Fallback verliert die Fehlerursache im Client

Der Server liefert Fallback-Metadaten. Scheitert aber bereits der Browsertransport – etwa wegen App
Check, Netzwerk oder ungültiger Serverantwort – fängt `MapGenerationService` alle Fehler ab und
erzeugt einen lokalen Plan ohne `fallbackReason`. Das ist robust für den Nutzer, aber schlecht
diagnostizierbar.

Empfehlung: einen ungefährlichen, typisierten Fallbackgrund in Generation-Metadaten und UI-Status
übernehmen; keine Providerdetails oder Secrets anzeigen.

### A-09 – Mittel: Persistenz skaliert nicht sauber mit sehr großen Karten

Bei jedem Speichern wird die vollständige generierte `MapDefinition` inklusive `MapPlan`, Material-
Layern und Objekten per JSON-Doppelkonvertierung geklont und als ein großer IndexedDB-Snapshot
geschrieben. Kamerabewegungen lösen nach 350 ms Ruhe ebenfalls ein vollständiges Speichern aus.
Der Singleton `zufallskarte` begrenzt derzeit zwar die Historie, sehr große Karten und Fog-Polygone
können dennoch spürbare Serialisierungs- und Speicherlast erzeugen.

Empfehlung: Snapshot-Größe messen, statische Kartendaten separat und inhaltsadressiert speichern,
häufig veränderte Zustände getrennt persistieren und eine Quota-/Fehlerbehandlung ergänzen.

### A-10 – Mittel: Performance-Nachweis ist ein CPU-/Strukturproxy, kein Renderbenchmark

Das Chunking reduziert im reproduzierbaren Profil bei einer 150×150-Outdoor-Karte die geschätzten
sichtbaren Renderknoten von 1.946 auf 315. Die aktuelle Generierung benötigte dabei rund 288 ms;
das komplexe 150×150-Szenario rund 344 ms. Diese Werte sind gut, messen aber keine PixiJS-FPS,
GPU-Zeit oder GPU-Speichernutzung. Hexraster, Fog, Licht und sehr große Wall-Mengen bleiben
ungechunkt beziehungsweise separat.

Empfehlung: einen Playwright-/Browserbenchmark mit Warm-up, mehreren Kamerapositionen und Messungen
für Frame-Zeit, DisplayObject-Zahl und Speicher ergänzen. Besonders 150×150 mit Fog, Licht und
mehreren hundert Walls testen.

### A-11 – Niedrig bis mittel: Große Dateien und Hauptbundle erschweren weitere Erweiterungen

`randomGenerator.ts` und `staticObjects.ts` besitzen jeweils mehr als 4.200 Zeilen,
`MapEngine.ts` mehr als 1.000 Zeilen. Der Produktionsbuild erzeugt außerdem einen Hauptchunk von
606,21 kB minifiziert (180,77 kB gzip) und meldet die Vite-500-kB-Warnung.

Empfehlung: den Legacy-Generator erst nach vollständiger Ablösung entfernen, große Objektkataloge
nach Domäne aufteilen und Generator-/Dialogcode bei Bedarf lazy laden. Die Engine nicht neu
schreiben, sondern Verantwortlichkeiten schrittweise extrahieren.

### A-12 – Niedrig: Qualitätstore sind nicht vollständig grün

- ESLint: keine Fehler, eine Warnung wegen `page.waitForTimeout()` im E2E-Test.
- Oxlint: sieben Befunde. Darunter Teststilprobleme und ein `no-dupe-else-if`-Befund im
  Legacy-Generator; die beiden Bedingungen rufen jeweils den zustandsbehafteten PRNG auf und sind
  daher fachlich nicht identisch, sollten aber zur Eindeutigkeit umformuliert werden.
- Playwright: vier Tests wurden gestartet, konnten aber nicht ausgeführt werden, weil das passende
  Chromium-Binary lokal nicht installiert ist. Das ist ein Infrastrukturfehler, kein bestätigter
  App-Fehler.

Empfehlung: Browser im CI deterministisch installieren, zeitbasierte Warteanweisung durch eine
zustandsbasierte Erwartung ersetzen und Oxlint-Befunde bereinigen oder begründet lokal
unterdrücken.

## Prüfung der Serverkonfiguration

`server/.env.example` trennt die Werte korrekt vom Vite-Client:

- `OPENAI_API_KEY`: serverseitiger Modellzugriff, in Firebase als Secret definiert.
- `OPENAI_ADMIN_KEY`: serverseitige Costs-Abfrage, separat als Secret definiert.
- `OPENAI_PROJECT_ID`: Projektfilter für die Kostenabfrage.
- `AI_DAILY_BUDGET_USD`: selbst konfiguriertes Anwendungsbudget, ausdrücklich kein verifiziertes
  OpenAI-Freikontingent.

Keiner dieser Namen darf mit `VITE_` beginnen. Der Server setzt `Cache-Control: no-store`, gibt
keine Schlüssel zurück und verwendet für Modellaufrufe `store: false`. Positiv ist auch, dass
öffentliche Fehlermeldungen Providerdetails und Stacktraces nicht weiterreichen.

Offen bleiben App Check, Rate Limit, hartes Budget, Request-Obergrenzen und ein produktionsnaher
End-to-End-Test der Hosting-Rewrites.

## Ausgeführte Prüfungen

| Prüfung | Ergebnis |
|---|---|
| `npm run type-check` | erfolgreich |
| `npm run test:unit -- --run` | 29 Dateien, 152 Tests erfolgreich |
| `npm run build` | erfolgreich; Warnung bei 606,21-kB-Hauptchunk |
| Performance-Einzeltest | erfolgreich; fünf reproduzierbare Großkartenszenarien |
| ESLint ohne Auto-Fix | 0 Fehler, 1 Warnung |
| Oxlint ohne Auto-Fix | 7 Befunde |
| `npm audit --omit=dev` | Root: 2 hoch, 1 moderat; Server: 2 moderat |
| `npm run test:e2e` | nicht ausführbar: Playwright-Chromium fehlt |

Die wiederkehrende PowerShell-Meldung `Test-Path: Zugriff verweigert` stammt aus der lokalen
`npm.ps1`-Umgebung; Typecheck, Tests und Build liefen danach trotzdem mit Exitcode 0 durch.

## Empfohlene Reihenfolge

1. App Check im Client vollständig anschließen und Hosting/Functions integriert testen.
2. Harte Request-, Rate- und Ausgabenlimits serverseitig einführen.
3. Generierte und restaurierte `MapDefinition` vollständig validieren.
4. Dependency-Updates und beide npm-Audits bereinigen.
5. `none`-Semantik, Usage-Zeitpunkt und typisierte Fallbackdiagnose korrigieren.
6. Playwright-Infrastruktur und Lint-Gates stabilisieren.
7. Browserbasierte Performance-Messungen für Fog, Licht, Walls und GPU ergänzen.
8. Erst danach Legacy-Code und große Dateien schrittweise abbauen.

