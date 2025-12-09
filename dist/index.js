"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const botbuilder_1 = require("botbuilder");
const config_1 = require("./config/config");
const logger_1 = require("./utils/logger");
const teamsBot_1 = require("./bot/teamsBot");
const callingController_1 = require("./controllers/callingController");
const authService_1 = require("./services/authService");
const logger = (0, logger_1.createLogger)('Main');
try {
    (0, config_1.validateConfig)();
}
catch (error) {
    logger.error('Configuration validation failed', error);
    process.exit(1);
}
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.use((req, res, next) => {
    logger.debug('Incoming request', {
        method: req.method,
        path: req.path,
        ip: req.ip,
    });
    next();
});
const botFrameworkAuthConfig = {
    MicrosoftAppId: config_1.config.microsoftAppId,
    MicrosoftAppPassword: config_1.config.microsoftAppPassword,
    MicrosoftAppType: 'SingleTenant',
    MicrosoftAppTenantId: config_1.config.microsoftAppTenantId,
};
const botFrameworkAuth = new botbuilder_1.ConfigurationBotFrameworkAuthentication(botFrameworkAuthConfig);
const adapter = new botbuilder_1.CloudAdapter(botFrameworkAuth);
adapter.onTurnError = async (context, error) => {
    logger.error('Bot adapter error', error);
    await context.sendActivity('Oops! Algo salió mal. Por favor intenta de nuevo.');
};
const bot = new teamsBot_1.MeetingBot();
app.get('/', (req, res) => {
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
          <li>Bot ID: ${config_1.config.botId}</li>
          <li>Bot Handle: ${config_1.config.botHandle}</li>
          <li>Environment: ${config_1.config.nodeEnv}</li>
          <li>Port: ${config_1.config.port}</li>
        </ul>
      </div>
    </body>
    </html>
  `);
});
app.get('/api/health', async (req, res) => {
    try {
        const graphApiHealthy = await authService_1.authService.validateCredentials();
        const openAIHealthy = true;
        const health = {
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
    }
    catch (error) {
        logger.error('Health check failed', error);
        res.status(500).json({
            status: 'unhealthy',
            error: 'Health check failed',
        });
    }
});
app.post('/api/messages', async (req, res) => {
    try {
        await adapter.process(req, res, (context) => bot.run(context));
    }
    catch (error) {
        logger.error('Error processing bot message', error);
        res.status(500).json({ error: 'Failed to process message' });
    }
});
app.post('/api/calling', callingController_1.handleCallingWebhook);
app.post('/api/join-meeting', callingController_1.handleJoinMeeting);
app.post('/api/process-transcript', callingController_1.handleProcessTranscript);
app.use((req, res) => {
    res.status(404).json({
        error: 'Not Found',
        path: req.path,
    });
});
app.use((err, req, res, next) => {
    logger.error('Unhandled error', err);
    res.status(500).json({
        error: 'Internal Server Error',
        message: config_1.config.nodeEnv === 'development' ? err.message : undefined,
    });
});
const PORT = config_1.config.port;
app.listen(PORT, () => {
    logger.info('='.repeat(60));
    logger.info('🤖 MeetingBot Teams Backend Started');
    logger.info('='.repeat(60));
    logger.info(`Environment: ${config_1.config.nodeEnv}`);
    logger.info(`Server running on port: ${PORT}`);
    logger.info(`Bot ID: ${config_1.config.botId}`);
    logger.info(`Bot Handle: ${config_1.config.botHandle}`);
    logger.info(`Calling Webhook: ${config_1.config.callingWebhookUrl}`);
    logger.info('='.repeat(60));
    logger.info('Available endpoints:');
    logger.info(`  GET  http://localhost:${PORT}/`);
    logger.info(`  GET  http://localhost:${PORT}/api/health`);
    logger.info(`  POST http://localhost:${PORT}/api/messages`);
    logger.info(`  POST http://localhost:${PORT}/api/calling`);
    logger.info(`  POST http://localhost:${PORT}/api/join-meeting`);
    logger.info(`  POST http://localhost:${PORT}/api/process-transcript`);
    logger.info('='.repeat(60));
});
process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down gracefully...');
    process.exit(0);
});
process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully...');
    process.exit(0);
});
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection', reason);
});
exports.default = app;
//# sourceMappingURL=index.js.map