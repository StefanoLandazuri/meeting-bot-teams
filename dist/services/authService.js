"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authService = void 0;
const identity_1 = require("@azure/identity");
const config_1 = require("../config/config");
const logger_1 = require("../utils/logger");
const types_1 = require("../types");
const logger = (0, logger_1.createLogger)('AuthService');
class AuthService {
    constructor() {
        this.tokenCache = new Map();
        this.credential = new identity_1.ClientSecretCredential(config_1.config.microsoftAppTenantId, config_1.config.microsoftAppId, config_1.config.microsoftAppPassword);
        logger.info('Auth service initialized');
    }
    async getGraphAccessToken() {
        const scope = 'https://graph.microsoft.com/.default';
        return this.getAccessToken(scope);
    }
    async getAccessToken(scope) {
        try {
            const cached = this.tokenCache.get(scope);
            if (cached && cached.expiresAt > Date.now()) {
                logger.debug('Using cached token', { scope });
                return cached.token;
            }
            logger.debug('Requesting new token', { scope });
            const tokenResponse = await this.credential.getToken(scope);
            if (!tokenResponse || !tokenResponse.token) {
                throw new types_1.AuthenticationError('Failed to obtain access token');
            }
            const expiresAt = tokenResponse.expiresOnTimestamp - (5 * 60 * 1000);
            this.tokenCache.set(scope, {
                token: tokenResponse.token,
                expiresAt,
            });
            logger.info('Access token obtained successfully', { scope });
            return tokenResponse.token;
        }
        catch (error) {
            logger.error('Failed to get access token', error, { scope });
            throw new types_1.AuthenticationError(`Authentication failed: ${error.message}`, error);
        }
    }
    clearCache() {
        this.tokenCache.clear();
        logger.info('Token cache cleared');
    }
    async validateCredentials() {
        try {
            await this.getGraphAccessToken();
            logger.info('Credentials validated successfully');
            return true;
        }
        catch (error) {
            logger.error('Credential validation failed', error);
            return false;
        }
    }
}
exports.authService = new AuthService();
exports.default = exports.authService;
//# sourceMappingURL=authService.js.map