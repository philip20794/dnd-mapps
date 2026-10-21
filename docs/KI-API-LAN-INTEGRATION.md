# Eigene ki-api im Heimnetz – Hybrid-Kartengenerierung

**Entwicklungsstand:** Branch `feature/ki-api-hybrid-map-generation`. Diese Änderung betrifft `dnd-mapps`, nicht dein `ki-api`-Repository.

## Prinzip

- Die Browser-App ruft nur den **gleichen Origin** auf: `POST /api/ki-map-design`.
- Der Node-LAN-Server sendet den Anfragekontext über `Authorization: Bearer ...` an `POST /v1/chat/completions` der bestehenden `ki-api` und nutzt das feste Tool `propose_map_design` mit validiertem JSON-Schema.
- Als Modell wird `ki-api-chat` mit `reasoning.effort: medium` genutzt.
- Die Antwort beschreibt nur Konzept, Atmosphäre, Objekt- und Raumrollen. Der Browser validiert sie und erzeugt mit dem lokalen TypeScript-Generator einen neuen `MapPlan` sowie die tatsächliche `MapDefinition`.
- Manuelle Nutzerwünsche behalten Vorrang; Kamera, Positionen und Kollisionsgeometrie werden **nicht** vom Sprachmodell bestimmt.
- Bei Netzwerk-, Modell- oder Validierungsfehlern bleibt die lokale Generierung verfügbar.
- Auch ohne KI vergleicht der lokale Generator drei deterministische semantische Pläne und wählt den am besten verbundenen und abwechslungsreichsten aus. Die fertige MapDefinition wird vor Übergabe an PixiJS geprüft.
- Die App speichert wie bisher den endgültigen Plan mit Seed. Dadurch kann ein bereits mit KI gestaltetes Level reproduzierbar neu erzeugt werden, ohne die KI erneut aufzurufen.

## Ubuntu-Setup

Voraussetzungen: Node 22.18+ oder Node 24.12+, npm und eine **bereits laufende** `ki-api` auf dem Ubuntu-PC (z. B. `http://127.0.0.1:3100`). `ki-api` selbst wird nicht verändert.

```bash
cd ~/dnd-mapps
git fetch origin
git switch feature/ki-api-hybrid-map-generation
npm ci
npm install --prefix worker --no-package-lock --ignore-scripts

cp lan-server/.env.lan.local.example .env.lan.local
nano .env.lan.local
```

Die Datei enthält:

```dotenv
KI_API_KEY=dein-echter-ki-api-schluessel
KI_API_BASE_URL=http://127.0.0.1:3100
LAN_HOST=0.0.0.0
LAN_PORT=4173
```

`KI_API_KEY` ist derselbe Key wie in der lokalen `ki-api/.env`. Die Datei `.env.lan.local` wird nicht eingecheckt. Der Schlüssel wird **niemals** mit Vite in den Browser gebündelt. Verwende keinen `VITE_`-Präfix für Secrets.

```bash
npm run test:lan
npm run build:lan
npm run start:lan
```

Danach die App im Browser öffnen: `http://<Ubuntu-LAN-IP>:4173`. Auf WLAN-Geräten muss Port 4173 in der Host-Firewall für das private LAN erlaubt sein. **Keine Router-Portweiterleitung ins Internet einrichten.** Die API muss lediglich vom Node-Server erreichbar sein; ist beides auf demselben Ubuntu-PC installiert, genügt weiterhin `127.0.0.1:3100` für den internen KI-Zugriff.

Im Karten-Dialog `Lokale KI` aktivieren. Der Button `Aus` verwendet dieselbe lokale Generation ohne KI.

`GET /api/ki-health` zeigt `{"status":"ok"}`, wenn die ki-api erreichbar ist. Die Endpoint-Antwort enthält nie einen API-Key. Alle Ressourcen werden vom gleichen lokalen Server bereitgestellt; keine CORS-Freigabe der KI ist nötig.

## Sicherheit und Betriebsgrenzen

Die LAN-App ist für dein **vertrauenswürdiges Heimnetz** ausgelegt: keine Benutzerverwaltung und keine Anmeldung. Port 4173 sollte nur aus dem Heimnetz zugänglich sein. Der lokale Server verweigert fremde `Origin`-Header für KI-POSTs und akzeptiert nur JSON mit begrenzter Größe. Diese Maßnahmen ersetzen keine richtige Authentifizierung oder TLS für Zugriff aus dem Internet.

Die `ki-api` nutzt aktuell Chromium zur Steuerung von ChatGPT. Die Verbindung zwischen DnD Mapps und Ubuntu bleibt lokal, **die Modellantwort selbst benötigt weiterhin Internet**. Ein vollständig offline laufendes Sprachmodell wäre ein gesonderter Ausbau.

Die `ki-api` erlaubt maximal 10.000 Zeichen Promptinhalt und unterstützt kein Streaming und keine Bildeingaben. Wir senden deshalb nur den kompakten Request und eine Zusammenfassung mit höchstens zwölf Raumrollen. Der Client führt ausschließlich geprüfte, strukturelle Datenoperationen aus.

Die frühere Firebase-/Cloudflare-Anbindung bleibt unverändert. `npm run build` verwendet weiterhin deren AI-Provider. Nur `npm run build:lan` aktiviert den neuen `ki-api`-Transport über `.env.lan`. Die bisherige Usage-/Dollar-Anzeige wird im LAN-Modus bewusst ausgeblendet: Die Browserautomatisierung von `ki-api` liefert keine verlässlichen Token- oder Kostendaten.

## Tests

```bash
npm run test:unit -- --run
npm run test:lan
npm run build:lan
```

Ein erfolgreicher Unit-Test ersetzt keinen echten End-to-End-Test mit der laufenden `ki-api`, da dafür dein lokaler Ubuntu-Rechner und die eingeloggte Chromium-Sitzung notwendig sind.

## Nächster Ausbau

Phase 4 und 5 sind noch nicht umgesetzt: KI-Schnellaktionen im Editor, begrenzte Kartenausschnitte, Änderungsvorschau, Freitextänderungen und ein einzelner Undo-Schritt pro akzeptierter KI-Aktion. Die lokale `ki-api`-Vermittlung und strukturierte Vorschläge bilden dafür die Grundlage.
