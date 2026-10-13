# Optionale AI-Serverless-Schicht

Die Vue-App enthält keine OpenAI-Zugangsdaten. Firebase Hosting leitet ausschließlich
`/api/map-plan` und `/api/ai-usage` an Firebase Functions in `europe-west1` weiter.
Beide Funktionen erzwingen Firebase App Check. Vor einer UI-Anbindung muss deshalb
App Check auch im Web-Client eingerichtet werden.

## Serverseitige Konfiguration

- `OPENAI_API_KEY`: Project-/Service-Account-Key nur für Responses-Aufrufe.
- `OPENAI_ADMIN_KEY`: separat gehaltener Organization-Admin-Key nur für Usage/Costs.
- Der Map Planner verwendet fest `gpt-6-luna`, damit Modell und Debug-Metadaten eindeutig bleiben.
- `OPENAI_PROJECT_ID`: begrenzt die Kostenabfrage auf dieses Projekt.
- `AI_DAILY_BUDGET_USD`: optionales eigenes Tagesbudget, kein OpenAI-Freikontingent.

Die beiden Keys werden bei Firebase als Secrets hinterlegt. Die übrigen Werte stammen
aus der serverseitigen Functions-Umgebung. Keine Variable darf mit `VITE_` beginnen.

Der AI Planner verwendet Structured Outputs und prüft danach zusätzlich die fachlichen
MapPlan-Constraints. Eine ungültige Ausgabe erhält genau einen Reparaturversuch. Danach
oder bei Providerfehlern liefert der Local Planner einen validen Fallback. Cloud Logging
speichert dafür nur Quelle, Modell, Schema-Version, Seed, Versuchszahl und optionale
Tokenusage – niemals Prompt, Beschreibung, Plan oder Schlüssel.

## Datenbedeutung

`GET /api/ai-usage` verwendet ausschließlich den offiziellen Organization-Costs-Endpunkt.
Das Tagesfenster läuft von 00:00 UTC bis 00:00 UTC des Folgetags. OpenAI stellt keinen
Endpunkt für ein verbleibendes kostenloses Tageskontingent bereit. Daher ist
`freeQuotaStatus` immer `unknown`. `remaining` wird nur geliefert, wenn ein eigenes
Tagesbudget konfiguriert ist, und ist wegen möglicher Reporting-Verzögerungen als
Schätzung markiert.

Offizielle Grundlagen:

- [Responses API und JavaScript-SDK](https://developers.openai.com/api/docs)
- [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
- [Organization Costs API](https://developers.openai.com/api/reference/python/resources/admin/subresources/organization/subresources/usage/methods/costs)
- [Rate Limits](https://developers.openai.com/api/docs/guides/rate-limits)
