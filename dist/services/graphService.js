"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.graphService = void 0;
const microsoft_graph_client_1 = require("@microsoft/microsoft-graph-client");
const azureTokenCredentials_1 = require("@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials");
const identity_1 = require("@azure/identity");
const config_1 = require("../config/config");
const logger_1 = require("../utils/logger");
const types_1 = require("../types");
const logger = (0, logger_1.createLogger)('GraphService');
class GraphService {
    constructor() {
        this.credential = new identity_1.ClientSecretCredential(config_1.config.microsoftAppTenantId, config_1.config.microsoftAppId, config_1.config.microsoftAppPassword);
        const authProvider = new azureTokenCredentials_1.TokenCredentialAuthenticationProvider(this.credential, {
            scopes: ['https://graph.microsoft.com/.default'],
        });
        this.client = microsoft_graph_client_1.Client.initWithMiddleware({
            authProvider,
        });
        logger.info('Graph service initialized');
    }
    getClient() {
        return this.client;
    }
    async get(endpoint) {
        try {
            logger.debug(`GET request to Graph API`, { endpoint });
            const response = await this.client.api(endpoint).get();
            return response;
        }
        catch (error) {
            logger.error(`Graph API GET request failed`, error, {
                endpoint,
                statusCode: error.statusCode,
                code: error.code,
                message: error.message,
                body: error.body,
                response: error.response?.data,
            });
            throw new types_1.GraphApiError(`Graph API request failed: ${error.message || error.code || 'Unknown error'}`, {
                endpoint,
                statusCode: error.statusCode,
                code: error.code,
                error: error.body || error.response?.data || error,
            });
        }
    }
    async post(endpoint, body) {
        try {
            logger.debug(`POST request to Graph API`, { endpoint });
            const response = await this.client.api(endpoint).post(body);
            return response;
        }
        catch (error) {
            logger.error(`Graph API POST request failed`, error, { endpoint });
            throw new types_1.GraphApiError(`Graph API request failed: ${error.message}`, {
                endpoint,
                body,
                statusCode: error.statusCode,
                error: error.body || error,
            });
        }
    }
    async patch(endpoint, body) {
        try {
            logger.debug(`PATCH request to Graph API`, { endpoint });
            const response = await this.client.api(endpoint).patch(body);
            return response;
        }
        catch (error) {
            logger.error(`Graph API PATCH request failed`, error, { endpoint });
            throw new types_1.GraphApiError(`Graph API request failed: ${error.message}`, {
                endpoint,
                body,
                statusCode: error.statusCode,
                error: error.body || error,
            });
        }
    }
    async delete(endpoint) {
        try {
            logger.debug(`DELETE request to Graph API`, { endpoint });
            await this.client.api(endpoint).delete();
        }
        catch (error) {
            logger.error(`Graph API DELETE request failed`, error, { endpoint });
            throw new types_1.GraphApiError(`Graph API request failed: ${error.message}`, {
                endpoint,
                statusCode: error.statusCode,
                error: error.body || error,
            });
        }
    }
    async getUser(userId) {
        try {
            logger.info('Getting user information', { userId });
            return await this.get(`/users/${userId}`);
        }
        catch (error) {
            logger.error('Failed to get user', error, { userId });
            throw error;
        }
    }
    async getOnlineMeeting(userId, meetingId) {
        try {
            logger.info('Getting online meeting', { userId, meetingId });
            return await this.get(`/users/${userId}/onlineMeetings/${meetingId}`);
        }
        catch (error) {
            logger.error('Failed to get online meeting', error, { userId, meetingId });
            throw error;
        }
    }
}
exports.graphService = new GraphService();
exports.default = exports.graphService;
//# sourceMappingURL=graphService.js.map