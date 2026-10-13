import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { logger } from 'firebase-functions';
import { readServerAiConfig } from './config.js';
import { OpenAiMapPlannerProvider, OpenAiUsageProvider } from './openAiProviders.js';
import { handleAiUsage, handleMapPlan } from './routes.js';
const openAiApiKey = defineSecret('OPENAI_API_KEY');
const openAiAdminKey = defineSecret('OPENAI_ADMIN_KEY');
const send = (response, target) => {
    target.set('Cache-Control', 'no-store');
    for (const [name, value] of Object.entries(response.headers ?? {}))
        target.set(name, value);
    target.status(response.status).json(response.body);
};
const options = { region: 'europe-west1', enforceAppCheck: true };
export const mapPlan = onRequest({ ...options, secrets: [openAiApiKey] }, async (request, response) => {
    const config = readServerAiConfig({
        ...process.env,
        OPENAI_API_KEY: openAiApiKey.value(),
    });
    const provider = config.apiKey ? new OpenAiMapPlannerProvider(config.apiKey, config.projectId) : undefined;
    const result = await handleMapPlan(request, config, provider);
    if (result.status === 200 && 'debug' in result.body) {
        logger.info('AI map planning completed', {
            source: result.body.source,
            ...result.body.debug,
        });
    }
    send(result, response);
});
export const aiUsage = onRequest({ ...options, secrets: [openAiAdminKey] }, async (request, response) => {
    const config = readServerAiConfig({
        ...process.env,
        OPENAI_ADMIN_KEY: openAiAdminKey.value(),
    });
    const provider = config.adminKey ? new OpenAiUsageProvider(config.adminKey) : undefined;
    send(await handleAiUsage(request, config, provider), response);
});
//# sourceMappingURL=firebase.js.map