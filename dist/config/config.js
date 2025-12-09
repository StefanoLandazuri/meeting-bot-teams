"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateConfig = exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const requireEnv = (key) => {
    const value = process.env[key];
    if (!value) {
        throw new Error(`Missing required environment variable: ${key}`);
    }
    return value;
};
const getEnv = (key, defaultValue) => {
    return process.env[key] || defaultValue;
};
exports.config = {
    microsoftAppId: requireEnv('MICROSOFT_APP_ID'),
    microsoftAppPassword: requireEnv('MICROSOFT_APP_PASSWORD'),
    microsoftAppTenantId: requireEnv('MICROSOFT_APP_TENANT_ID'),
    botId: requireEnv('BOT_ID'),
    botHandle: requireEnv('BOT_HANDLE'),
    graphApiEndpoint: getEnv('GRAPH_API_ENDPOINT', 'https://graph.microsoft.com/v1.0'),
    port: parseInt(getEnv('PORT', '3978'), 10),
    nodeEnv: getEnv('NODE_ENV', 'development'),
    callingWebhookUrl: requireEnv('CALLING_WEBHOOK_URL'),
    azureOpenAI: {
        endpoint: requireEnv('AZURE_OPENAI_ENDPOINT'),
        apiKey: requireEnv('AZURE_OPENAI_API_KEY'),
        deploymentName: requireEnv('AZURE_OPENAI_DEPLOYMENT_NAME'),
        apiVersion: getEnv('AZURE_OPENAI_API_VERSION', '2024-02-15-preview'),
    },
    logLevel: getEnv('LOG_LEVEL', 'info'),
};
const validateConfig = () => {
    const requiredFields = [
        'microsoftAppId',
        'microsoftAppPassword',
        'microsoftAppTenantId',
        'botId',
        'callingWebhookUrl',
    ];
    for (const field of requiredFields) {
        if (!exports.config[field]) {
            throw new Error(`Configuration validation failed: ${field} is required`);
        }
    }
    if (!exports.config.azureOpenAI.endpoint || !exports.config.azureOpenAI.apiKey || !exports.config.azureOpenAI.deploymentName) {
        throw new Error('Azure OpenAI configuration is incomplete');
    }
    console.log('✓ Configuration validated successfully');
};
exports.validateConfig = validateConfig;
exports.default = exports.config;
//# sourceMappingURL=config.js.map