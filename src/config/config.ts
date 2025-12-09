/**
 * Configuration module
 * Carga y valida variables de entorno
 */

import dotenv from 'dotenv';
import { AppConfig } from '../types';

// Cargar variables de entorno
dotenv.config();

/**
 * Valida que una variable de entorno exista
 */
const requireEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

/**
 * Obtiene una variable de entorno con valor por defecto
 */
const getEnv = (key: string, defaultValue: string): string => {
  return process.env[key] || defaultValue;
};

/**
 * Configuración de la aplicación
 */
export const config: AppConfig = {
  // Azure AD / Bot
  microsoftAppId: requireEnv('MICROSOFT_APP_ID'),
  microsoftAppPassword: requireEnv('MICROSOFT_APP_PASSWORD'),
  microsoftAppTenantId: requireEnv('MICROSOFT_APP_TENANT_ID'),
  botId: requireEnv('BOT_ID'),
  botHandle: requireEnv('BOT_HANDLE'),

  // Graph API
  graphApiEndpoint: getEnv('GRAPH_API_ENDPOINT', 'https://graph.microsoft.com/v1.0'),

  // Server
  port: parseInt(getEnv('PORT', '3978'), 10),
  nodeEnv: (getEnv('NODE_ENV', 'development') as 'development' | 'production' | 'test'),
  callingWebhookUrl: requireEnv('CALLING_WEBHOOK_URL'),

  // Azure OpenAI
  azureOpenAI: {
    endpoint: requireEnv('AZURE_OPENAI_ENDPOINT'),
    apiKey: requireEnv('AZURE_OPENAI_API_KEY'),
    deploymentName: requireEnv('AZURE_OPENAI_DEPLOYMENT_NAME'),
    apiVersion: getEnv('AZURE_OPENAI_API_VERSION', '2024-02-15-preview'),
  },

  // Logging
  logLevel: (getEnv('LOG_LEVEL', 'info') as 'debug' | 'info' | 'warn' | 'error'),
};

/**
 * Valida la configuración al inicio
 */
export const validateConfig = (): void => {
  const requiredFields = [
    'microsoftAppId',
    'microsoftAppPassword',
    'microsoftAppTenantId',
    'botId',
    'callingWebhookUrl',
  ];

  for (const field of requiredFields) {
    if (!config[field as keyof AppConfig]) {
      throw new Error(`Configuration validation failed: ${field} is required`);
    }
  }

  // Validar Azure OpenAI
  if (!config.azureOpenAI.endpoint || !config.azureOpenAI.apiKey || !config.azureOpenAI.deploymentName) {
    throw new Error('Azure OpenAI configuration is incomplete');
  }

  console.log('✓ Configuration validated successfully');
};

export default config;