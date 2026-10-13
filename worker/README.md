# dnd-mapps AI Worker

Der Cloudflare Worker stellt `POST /api/map-plan`, `GET /api/ai-usage` und
`GET /api/health` bereit. OpenAI-Schlüssel existieren ausschließlich als Worker-Secrets.

## Lokal

```sh
cp .dev.vars.example .dev.vars
npm install
npm run dev
```

Unter PowerShell kann die Vorlage mit
`Copy-Item .dev.vars.example .dev.vars` kopiert werden. Danach die Werte nur in `.dev.vars`
eintragen. Der Worker läuft standardmäßig unter `http://localhost:8787`.

Parallel im Repository-Root:

```sh
npm run dev
```

Die Webapp liest `VITE_AI_API_BASE_URL` aus der Root-`.env.local`.

## Deployment

Pflichtsecret:

```sh
npx wrangler secret put OPENAI_API_KEY
```

Optional für `/api/ai-usage` und ein konfiguriertes Tagesbudget:

```sh
npx wrangler secret put OPENAI_ADMIN_KEY
npx wrangler secret put OPENAI_PROJECT_ID
npx wrangler secret put AI_DAILY_BUDGET_USD
```

Erlaubte Firebase-Hosting-Origins konfigurieren, zum Beispiel als kommaseparierten Wert:

```sh
npx wrangler secret put ALLOWED_ORIGINS
```

Danach:

```sh
npm run deploy
```

Die ausgegebene Worker-URL wird im Client als `VITE_AI_API_BASE_URL` gesetzt. Die CORS-Allowlist
ist eine Browsergrenze, aber kein Missbrauchsschutz. Das Worker-Rate-Limit und das konfigurierte
Tagesbudget werden unabhängig davon geprüft.
