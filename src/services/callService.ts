/**
 * Call Service
 * Maneja la lógica para unirse y gestionar llamadas de Teams
 */

import { graphService } from './graphService';
import { config } from '../config/config';
import { createLogger } from '../utils/logger';
import { CallInfo, CreateCallPayload, MeetingBotError } from '../types';

const logger = createLogger('CallService');

class CallService {
  /**
   * Une el bot a una reunión de Teams
   * @param meetingJoinUrl URL de la reunión (join URL de Teams)
   * @returns Información de la llamada creada
   */
  async joinMeeting(meetingJoinUrl: string): Promise<CallInfo> {
    try {
      logger.info('Attempting to join meeting', { meetingJoinUrl });

      // Extraer threadId de la URL de la reunión
      const threadId = this.extractThreadIdFromJoinUrl(meetingJoinUrl);
      if (!threadId) {
        throw new MeetingBotError(
          'Invalid meeting join URL - could not extract thread ID',
          'INVALID_JOIN_URL',
          400
        );
      }

      // Construir payload para crear la llamada
      const payload: any = {
        '@odata.type': '#microsoft.graph.call',
        callbackUri: `${config.callingWebhookUrl}`,
        source: {
          identity: {
            application: {
              id: config.microsoftAppId,
              displayName: config.botHandle,
            },
          },
        },
        requestedModalities: ['audio'],
        mediaConfig: {
          '@odata.type': '#microsoft.graph.serviceHostedMediaConfig',
        },
        chatInfo: {
          '@odata.type': '#microsoft.graph.chatInfo',
          threadId: threadId,
          messageId: '0',
        },
        tenantId: config.microsoftAppTenantId,
      };

      // Crear la llamada
      const callInfo = await graphService.post<CallInfo>(
        '/communications/calls',
        payload
      );

      logger.info('Successfully joined meeting', {
        callId: callInfo.id,
        meetingJoinUrl,
      });

      return callInfo;
    } catch (error: any) {
      logger.error('Failed to join meeting', error, { meetingJoinUrl });
      throw new MeetingBotError(
        `Failed to join meeting: ${error.message}`,
        'JOIN_MEETING_FAILED',
        500,
        error
      );
    }
  }

  /**
   * Obtiene información de una llamada activa
   * @param callId ID de la llamada
   */
  async getCall(callId: string): Promise<CallInfo> {
    try {
      logger.debug('Getting call information', { callId });
      const callInfo = await graphService.get<CallInfo>(
        `/communications/calls/${callId}`
      );
      return callInfo;
    } catch (error: any) {
      logger.error('Failed to get call information', error, { callId });
      throw new MeetingBotError(
        `Failed to get call: ${error.message}`,
        'GET_CALL_FAILED',
        500,
        error
      );
    }
  }

  /**
   * Termina una llamada (el bot sale de la reunión)
   * @param callId ID de la llamada
   */
  async leaveCall(callId: string): Promise<void> {
    try {
      logger.info('Leaving call', { callId });
      await graphService.delete(`/communications/calls/${callId}`);
      logger.info('Successfully left call', { callId });
    } catch (error: any) {
      logger.error('Failed to leave call', error, { callId });
      throw new MeetingBotError(
        `Failed to leave call: ${error.message}`,
        'LEAVE_CALL_FAILED',
        500,
        error
      );
    }
  }

  /**
   * Extrae el threadId de una URL de reunión de Teams
   * @param joinUrl URL de join de Teams
   * @returns threadId o null si no se encuentra
   */
  private extractThreadIdFromJoinUrl(joinUrl: string): string | null {
    try {
      // Las URLs de Teams tienen el formato:
      // https://teams.microsoft.com/l/meetup-join/19%3ameeting_XXXXX%40thread.v2/0?context=...
      // El threadId está en el path, no en los query params
      
      const url = new URL(joinUrl);
      const pathParts = url.pathname.split('/');
      
      // Buscar la parte que contiene el threadId (formato: 19%3ameeting_...%40thread.v2)
      for (const part of pathParts) {
        if (part.includes('thread.v2') || part.includes('thread.skype')) {
          // Decodificar el threadId
          const decodedThreadId = decodeURIComponent(part);
          logger.debug('Extracted threadId from path', { threadId: decodedThreadId });
          return decodedThreadId;
        }
      }

      // Fallback: intentar extraer con regex del path completo
      const match = url.pathname.match(/\/([^\/]*thread\.(?:v2|skype)[^\/]*)/);
      if (match && match[1]) {
        const decodedThreadId = decodeURIComponent(match[1]);
        logger.debug('Extracted threadId with regex', { threadId: decodedThreadId });
        return decodedThreadId;
      }

      logger.warn('Could not extract threadId from join URL', { 
        joinUrl,
        pathname: url.pathname,
        pathParts 
      });
      return null;
    } catch (error) {
      logger.error('Error parsing join URL', error, { joinUrl });
      return null;
    }
  }

  /**
   * Valida si una URL es una URL válida de Teams
   * @param joinUrl URL a validar
   */
  isValidTeamsUrl(joinUrl: string): boolean {
    try {
      const url = new URL(joinUrl);
      return (
        url.hostname.includes('teams.microsoft.com') &&
        url.pathname.includes('meetup-join')
      );
    } catch {
      return false;
    }
  }
}

// Singleton instance
export const callService = new CallService();
export default callService;