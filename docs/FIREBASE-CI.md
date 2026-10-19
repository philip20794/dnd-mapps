# Automatisches Firebase-Hosting-Deployment

Die GitHub-Actions-Pipeline in [`.github/workflows/firebase-hosting.yml`](../.github/workflows/firebase-hosting.yml) baut das Vue-/Vite-Frontend und veröffentlicht das Ergebnis nach Firebase Hosting.

## Wann sie läuft

- **Pull Request nach `main`:** Abhängigkeiten installieren, Unit-Tests ausführen, TypeScript prüfen und `dist/` bauen. Kein Live-Deploy.
- **Push oder Merge nach `main`:** dieselben Prüfungen; nur bei Erfolg wird das exakt zuvor gebaute `dist/` auf den Live-Kanal von Firebase Hosting veröffentlicht.
- **Manueller Start (Actions > Build and deploy Firebase Hosting > Run workflow):** auf `main` ebenfalls Build und Live-Deploy.

Ein fehlgeschlagener Test oder Build blockiert den Deploy. Alle Schritte laufen über GitHub-hosted Ubuntu-Runner; der eigene Unity-Windows-Runner wird nicht benötigt.

## Einmalige Einrichtung

Firebase-Projekt-ID: **`dnd-mapps`** (siehe `.firebaserc`). Das Hosting-Verzeichnis ist **`dist/`** (siehe `firebase.json`).

1. In der Google Cloud Console das Projekt `dnd-mapps` auswählen und unter **IAM & Verwaltung > Dienstkonten** ein eigenes Dienstkonto für das GitHub-Deployment erstellen.
2. Dem Dienstkonto die für das Hosting-Deployment erforderlichen Rollen geben. Nach der [Dokumentation der Firebase-Action](https://github.com/FirebaseExtended/action-hosting-deploy/blob/main/docs/service-account.md) sind insbesondere **Firebase Hosting Admin** (`roles/firebasehosting.admin`) und **API Keys Viewer** (`roles/serviceusage.apiKeysViewer`) erforderlich. Bei weiteren Firebase-Funktionen oder Preview-Kanälen können zusätzliche Rechte nötig sein.
3. Für dieses Dienstkonto einen **JSON-Schlüssel** erstellen und sicher verwahren. Den Schlüssel **niemals** ins Git-Repository einchecken.
4. Unter [GitHub Repository > Settings > Secrets and variables > Actions](https://github.com/philip20794/dnd-mapps/settings/secrets/actions) ein **Repository secret** namens `FIREBASE_SERVICE_ACCOUNT_DND_MAPPS` anlegen. Als Wert den **gesamten Inhalt** der JSON-Datei eintragen.
5. Falls die KI-Funktionen des Cloudflare-Workers auch auf Firebase Hosting erreichbar sein sollen, unter **Settings > Secrets and variables > Actions > Variables** eine Repository-Variable `VITE_AI_API_BASE_URL` mit der öffentlich erreichbaren HTTPS-Basis-URL des Workers hinterlegen (ohne abschließenden Slash). Die Variable ist öffentlich im Browser-Bundle – dort gehören **keine Schlüssel** hinein.
6. Danach unter [GitHub Actions](https://github.com/philip20794/dnd-mapps/actions) den Workflow auf `main` manuell starten oder die nächste Änderung nach `main` mergen.

**Wichtig:** Fehlt das Firebase-Secret, kann der Build erfolgreich sein, der Deploy-Job bricht jedoch mit einer verständlichen Fehlermeldung ab. Es wird kein stillschweigender Erfolg gemeldet.

## Pipeline

1. Node.js 22 auf Ubuntu vorbereiten.
2. Frontend-Abhängigkeiten mit `npm ci` installieren.
3. Separat die Abhängigkeiten des Cloudflare-Workers installieren, da dessen TypeScript-Prüfung Bestandteil des Root-Builds ist und derzeit kein `worker/package-lock.json` existiert.
4. Alle Vitest-Unit-Tests mit `npm run test:unit -- --run` ausführen.
5. `npm run build` ausführen (Typprüfung von Frontend und Worker sowie Vite-Build).
6. `dist/` als GitHub-Actions-Artefakt speichern.
7. Ausschließlich bei Push auf `main`: das getestete Artefakt herunterladen und über `FirebaseExtended/action-hosting-deploy@v0` mit `channelId: live` deployen.

Die Firebase-Action veröffentlicht **nur Firebase Hosting**. Der Cloudflare-Worker wird dadurch nicht neu deployt. Es werden weder `server/` noch Firebase Functions veröffentlicht.

## Fehlerbehebung

- **`FIREBASE_SERVICE_ACCOUNT_DND_MAPPS` fehlt:** Secret wie oben anlegen.
- **Firebase meldet 403:** Projekt-ID und IAM-Rollen des Dienstkontos prüfen.
- **Worker-Typprüfung schlägt fehl:** Die Worker-Abhängigkeiten werden separat installiert; vor einem Fix kontrollieren, ob `worker/package.json` noch aktuell ist.
- **KI-Funktion ruft `/api/...` auf Firebase auf:** `VITE_AI_API_BASE_URL` als Repository-Variable setzen; das ist die öffentliche Cloudflare-Worker-URL, kein API-Schlüssel.
- **Build oder Test schlägt fehl:** Es erfolgt kein Hosting-Deploy. Im GitHub-Actions-Lauf ist der fehlgeschlagene Schritt sichtbar.
