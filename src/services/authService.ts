/**
 * Authentication Service
 * Maneja la autenticación con Azure AD y obtención de tokens
 */

import { ClientSecretCredential } from '@azure/identity';
import { config } from '../config/config';
import { createLogger } from '../utils/logger';
import { AuthenticationError } from '../types';

const logger = createLogger('AuthService');

class AuthService {
  private credential: ClientSecretCredential;
  private tokenCache: Map<string, { token: string; expiresAt: number }> = new Map();

  constructor() {
    this.credential = new ClientSecretCredential(
      config.microsoftAppTenantId,
      config.microsoftAppId,
      config.microsoftAppPassword
    );
    logger.info('Auth service initialized');
  }

  /**
   * Obtiene un access token para Microsoft Graph API
   * Usa cache para evitar solicitudes innecesarias
   */
  async getGraphAccessToken(): Promise<string> {
    const scope = 'https://graph.microsoft.com/.default';
    return this.getAccessToken(scope);
  }

  /**
   * Obtiene un access token para un scope específico
   */
  async getAccessToken(scope: string): Promise<string> {
    try {
      // Verificar cache
      const cached = this.tokenCache.get(scope);
      if (cached && cached.expiresAt > Date.now()) {
        logger.debug('Using cached token', { scope });
        return cached.token;
      }

      logger.debug('Requesting new token', { scope });

      // Solicitar nuevo token
      const tokenResponse = await this.credential.getToken(scope);
      
      if (!tokenResponse || !tokenResponse.token) {
        throw new AuthenticationError('Failed to obtain access token');
      }

      // Cachear token (expiresOnTimestamp - 5 minutos de margen)
      const expiresAt = tokenResponse.expiresOnTimestamp - (5 * 60 * 1000);
      this.tokenCache.set(scope, {
        token: tokenResponse.token,
        expiresAt,
      });

      logger.info('Access token obtained successfully', { scope });
      return tokenResponse.token;
    } catch (error: any) {
      logger.error('Failed to get access token', error, { scope });
      throw new AuthenticationError(
        `Authentication failed: ${error.message}`,
        error
      );
    }
  }

  /**
   * Limpia el cache de tokens
   */
  clearCache(): void {
    this.tokenCache.clear();
    logger.info('Token cache cleared');
  }

  /**
   * Valida que las credenciales sean correctas
   */
  async validateCredentials(): Promise<boolean> {
    try {
      await this.getGraphAccessToken();
      logger.info('Credentials validated successfully');
      return true;
    } catch (error) {
      logger.error('Credential validation failed', error);
      return false;
    }
  }
}

// Singleton instance
export const authService = new AuthService();
export default authService;