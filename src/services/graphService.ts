/**
 * Graph Service
 * Cliente base para interactuar con Microsoft Graph API
 */

import { Client } from '@microsoft/microsoft-graph-client';
import { TokenCredentialAuthenticationProvider } from '@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials';
import { ClientSecretCredential } from '@azure/identity';
import { config } from '../config/config';
import { createLogger } from '../utils/logger';
import { GraphApiError } from '../types';

const logger = createLogger('GraphService');

class GraphService {
  private client: Client;
  private credential: ClientSecretCredential;

  constructor() {
    // Crear credential
    this.credential = new ClientSecretCredential(
      config.microsoftAppTenantId,
      config.microsoftAppId,
      config.microsoftAppPassword
    );

    // Crear authentication provider
    const authProvider = new TokenCredentialAuthenticationProvider(this.credential, {
      scopes: ['https://graph.microsoft.com/.default'],
    });

    // Crear cliente de Graph
    this.client = Client.initWithMiddleware({
      authProvider,
    });

    logger.info('Graph service initialized');
  }

  /**
   * Obtiene el cliente de Graph API
   */
  getClient(): Client {
    return this.client;
  }

  /**
   * Realiza una petición GET a Graph API
   */
  async get<T = any>(endpoint: string): Promise<T> {
    try {
      logger.debug(`GET request to Graph API`, { endpoint });
      const response = await this.client.api(endpoint).get();
      return response as T;
    } catch (error: any) {
      logger.error(`Graph API GET request failed`, error, { 
        endpoint,
        statusCode: error.statusCode,
        code: error.code,
        message: error.message,
        body: error.body,
        response: error.response?.data,
      });
      throw new GraphApiError(
        `Graph API request failed: ${error.message || error.code || 'Unknown error'}`,
        {
          endpoint,
          statusCode: error.statusCode,
          code: error.code,
          error: error.body || error.response?.data || error,
        }
      );
    }
  }

  /**
   * Realiza una petición POST a Graph API
   */
  async post<T = any>(endpoint: string, body: any): Promise<T> {
    try {
      logger.debug(`POST request to Graph API`, { endpoint });
      const response = await this.client.api(endpoint).post(body);
      return response as T;
    } catch (error: any) {
      logger.error(`Graph API POST request failed`, error, { endpoint });
      throw new GraphApiError(
        `Graph API request failed: ${error.message}`,
        {
          endpoint,
          body,
          statusCode: error.statusCode,
          error: error.body || error,
        }
      );
    }
  }

  /**
   * Realiza una petición PATCH a Graph API
   */
  async patch<T = any>(endpoint: string, body: any): Promise<T> {
    try {
      logger.debug(`PATCH request to Graph API`, { endpoint });
      const response = await this.client.api(endpoint).patch(body);
      return response as T;
    } catch (error: any) {
      logger.error(`Graph API PATCH request failed`, error, { endpoint });
      throw new GraphApiError(
        `Graph API request failed: ${error.message}`,
        {
          endpoint,
          body,
          statusCode: error.statusCode,
          error: error.body || error,
        }
      );
    }
  }

  /**
   * Realiza una petición DELETE a Graph API
   */
  async delete(endpoint: string): Promise<void> {
    try {
      logger.debug(`DELETE request to Graph API`, { endpoint });
      await this.client.api(endpoint).delete();
    } catch (error: any) {
      logger.error(`Graph API DELETE request failed`, error, { endpoint });
      throw new GraphApiError(
        `Graph API request failed: ${error.message}`,
        {
          endpoint,
          statusCode: error.statusCode,
          error: error.body || error,
        }
      );
    }
  }

  /**
   * Obtiene información de un usuario
   */
  async getUser(userId: string) {
    try {
      logger.info('Getting user information', { userId });
      return await this.get(`/users/${userId}`);
    } catch (error) {
      logger.error('Failed to get user', error, { userId });
      throw error;
    }
  }

  /**
   * Obtiene información de una reunión online
   */
  async getOnlineMeeting(userId: string, meetingId: string) {
    try {
      logger.info('Getting online meeting', { userId, meetingId });
      return await this.get(`/users/${userId}/onlineMeetings/${meetingId}`);
    } catch (error) {
      logger.error('Failed to get online meeting', error, { userId, meetingId });
      throw error;
    }
  }
}

// Singleton instance
export const graphService = new GraphService();
export default graphService;