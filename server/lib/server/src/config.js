const optionalText = (value) => value?.trim() || undefined;
const optionalPositiveNumber = (value) => {
    if (value === undefined || value.trim() === '')
        return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
};
export const readServerAiConfig = (environment = process.env) => ({
    apiKey: optionalText(environment.OPENAI_API_KEY),
    adminKey: optionalText(environment.OPENAI_ADMIN_KEY),
    projectId: optionalText(environment.OPENAI_PROJECT_ID),
    dailyBudgetUsd: optionalPositiveNumber(environment.AI_DAILY_BUDGET_USD),
});
//# sourceMappingURL=config.js.map