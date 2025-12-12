/**
 * Main Application Entry Point
 * Servidor Express con Bot Framework y endpoints de API
 */

import express, { Request, Response, NextFunction } from 'express';
import {
  CloudAdapter,
  ConfigurationBotFrameworkAuthentication,
  ConfigurationBotFrameworkAuthenticationOptions,
} from 'botbuilder';
import { config, validateConfig } from './config/config';
import { createLogger } from './utils/logger';
import { MeetingBot } from './bot/teamsBot';
import {
  handleCallingWebhook,
  handleJoinMeeting,
  handleProcessTranscript,
  handleDebugMeeting,
  handleGenerateSummary,
  handleGetFormattedTranscript,
} from './controllers/callingController';
import { authService } from './services/authService';
import { ApiResponse, HealthCheckResponse } from './types';
import { graphService } from './services/graphService';
import { upload } from './middleware/uploadMiddleware';

const logger = createLogger('Main');

// Validar configuración al inicio
try {
  validateConfig();
} catch (error: any) {
  logger.error('Configuration validation failed', error);
  process.exit(1);
}

// Crear aplicación Express
const app = express();

// Middlewares
app.use(express.json({limit: '50mb'}));
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  logger.debug('Incoming request', {
    method: req.method,
    path: req.path,
    ip: req.ip,
  });
  next();
});

// ============================================================================
// Bot Framework Setup
// ============================================================================

// Configuración de autenticación del bot
const botFrameworkAuthConfig: ConfigurationBotFrameworkAuthenticationOptions = {
  MicrosoftAppId: config.microsoftAppId,
  MicrosoftAppPassword: config.microsoftAppPassword,
  MicrosoftAppType: 'SingleTenant',
  MicrosoftAppTenantId: config.microsoftAppTenantId,
};

const botFrameworkAuth = new ConfigurationBotFrameworkAuthentication(
  botFrameworkAuthConfig
);

// Crear adapter del bot
const adapter = new CloudAdapter(botFrameworkAuth);

// Error handler para el adapter
adapter.onTurnError = async (context, error) => {
  logger.error('Bot adapter error', error);
  await context.sendActivity('Oops! Algo salió mal. Por favor intenta de nuevo.');
};

// Crear instancia del bot
const bot = new MeetingBot();

// ============================================================================
// API Routes
// ============================================================================

/**
 * GET /
 * Página de bienvenida
 */
app.get('/', (req: Request, res: Response) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>MeetingBot Teams</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          max-width: 800px;
          margin: 50px auto;
          padding: 20px;
          background: #f5f5f5;
        }
        .container {
          background: white;
          padding: 30px;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        h1 { color: #5558AF; }
        .status { color: #107C10; font-weight: bold; }
        .endpoint { 
          background: #f0f0f0; 
          padding: 10px; 
          margin: 10px 0;
          border-radius: 4px;
          font-family: monospace;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🤖 MeetingBot Teams</h1>
        <p><span class="status">✓ Bot is running</span></p>
        
        <h2>Available Endpoints:</h2>
        <div class="endpoint">GET /api/health - Health check</div>
        <div class="endpoint">POST /api/messages - Bot messages endpoint</div>
        <div class="endpoint">POST /api/calling - Calling webhook</div>
        <div class="endpoint">POST /api/join-meeting - Join a meeting</div>
        <div class="endpoint">POST /api/process-transcript - Process transcript</div>
        
        <h2>Configuration:</h2>
        <ul>
          <li>Bot ID: ${config.botId}</li>
          <li>Bot Handle: ${config.botHandle}</li>
          <li>Environment: ${config.nodeEnv}</li>
          <li>Port: ${config.port}</li>
        </ul>
      </div>
    </body>
    </html>
  `);
});

/**
 * GET /api/health
 * Health check endpoint
 */
app.get('/api/health', async (req: Request, res: Response) => {
  try {
    // Verificar servicios
    const graphApiHealthy = await authService.validateCredentials();
    const openAIHealthy = true; // Podríamos hacer un ping a OpenAI

    const health: HealthCheckResponse = {
      status: graphApiHealthy && openAIHealthy ? 'healthy' : 'unhealthy',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      services: {
        bot: true,
        graphApi: graphApiHealthy,
        openAI: openAIHealthy,
      },
    };

    res.json(health);
  } catch (error) {
    logger.error('Health check failed', error);
    res.status(500).json({
      status: 'unhealthy',
      error: 'Health check failed',
    });
  }
});

/**
 * POST /api/messages
 * Endpoint para mensajes del bot (Bot Framework)
 */
app.post('/api/messages', async (req: Request, res: Response) => {
  try {
    await adapter.process(req, res, (context) => bot.run(context));
  } catch (error) {
    logger.error('Error processing bot message', error);
    res.status(500).json({ error: 'Failed to process message' });
  }
});

/**
 * POST /api/calling
 * Webhook para eventos de llamadas
 */
app.post('/api/calling', handleCallingWebhook);

/**
 * POST /api/join-meeting
 * Endpoint manual para unir el bot a una reunión
 * 
 * Body: {
 *   "meetingJoinUrl": "https://teams.microsoft.com/l/meetup-join/...",
 *   "userId": "user-id",
 *   "meetingId": "meeting-id"
 * }
 */
app.post('/api/join-meeting', handleJoinMeeting);

/**
 * POST /api/process-transcript
 * Endpoint manual para procesar una transcripción
 * 
 * Body: {
 *   "userId": "user-id",
 *   "meetingId": "meeting-id"
 * }
 */
app.post('/api/process-transcript', handleProcessTranscript);

/**
 * POST /api/debug-meeting
 * Endpoint de debug para verificar acceso a reunión
 * 
 * Body: {
 *   "userId": "user-id",
 *   "meetingId": "meeting-id"
 * }
 */
app.post('/api/debug-meeting', handleDebugMeeting);

/**
 * GET /api/list-meetings/:userId
 * Lista las reuniones online de un usuario
 */
app.post('/api/generate-summary',upload.single('transcript'), handleGenerateSummary); 
/**
 * POST /api/generate-summary
 * Genera un resumen de la transcripción proporcionada
 * Body: {
 *  "transcript": "Full transcript text..."}
 */

app.post('/api/format-transcript', upload.single('transcript'), handleGetFormattedTranscript);
/**
 * POST /api/format-transcript
 * Genera un resumen de la transcripción proporcionada
 * Body: {
 *  "transcript": "Full transcript text..."}
 */

app.get('/api/list-meetings/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    logger.info('Listing meetings for user', { userId });
    
    const meetings = await graphService.get(
      `/users/${userId}/onlineMeetings`
    );
    
    res.json({
      success: true,
      meetings,
    });
  } catch (error: any) {
    logger.error('Failed to list meetings', error);
    res.status(500).json({
      error: 'Failed to list meetings',
      details: error.message,
    });
  }
});

// ============================================================================
// Error Handlers
// ============================================================================

// 404 Handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.path,
  });
});

// Global error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('Unhandled error', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: config.nodeEnv === 'development' ? err.message : undefined,
  });
});

// ============================================================================
// Start Server
// ============================================================================

const PORT = config.port;

app.listen(PORT, () => {
  logger.info('='.repeat(60));
  logger.info('🤖 MeetingBot Teams Backend Started');
  logger.info('='.repeat(60));
  logger.info(`Environment: ${config.nodeEnv}`);
  logger.info(`Server running on port: ${PORT}`);
  logger.info(`Bot ID: ${config.botId}`);
  logger.info(`Bot Handle: ${config.botHandle}`);
  logger.info(`Calling Webhook: ${config.callingWebhookUrl}`);
  logger.info('='.repeat(60));
  logger.info('Available endpoints:');
  logger.info(`  GET  http://localhost:${PORT}/`);
  logger.info(`  GET  http://localhost:${PORT}/api/health`);
  logger.info(`  POST http://localhost:${PORT}/api/messages`);
  logger.info(`  POST http://localhost:${PORT}/api/calling`);
  logger.info(`  POST http://localhost:${PORT}/api/join-meeting`);
  logger.info(`  POST http://localhost:${PORT}/api/process-transcript`);
  logger.info(`  POST http://localhost:${PORT}/api/debug-meeting`);
  logger.info(`  POST  http://localhost:${PORT}/api/generate-summary`);
  logger.info('='.repeat(60));
});

// Graceful shutdown
process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

// Unhandled rejection handler
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', reason);
});

export default app;