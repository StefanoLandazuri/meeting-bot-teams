/**
 * Transcript Service
 * Maneja la descarga y procesamiento de transcripciones de reuniones
 */

import { graphService } from './graphService';
import { createLogger } from '../utils/logger';
import {
  Transcript,
  TranscriptList,
  TranscriptEntry,
  TranscriptNotFoundError,
  MeetingBotError,
} from '../types';
import axios from 'axios';
import { authService } from './authService';

const logger = createLogger('TranscriptService');

class TranscriptService {
  /**
   * Obtiene todas las transcripciones de una reunión
   * @param userId ID del organizador de la reunión
   * @param meetingId ID de la reunión
   */
  async getTranscripts(userId: string, meetingId: string): Promise<Transcript[]> {
    try {
      logger.info('Fetching transcripts for meeting', { userId, meetingId });

      const endpoint = `/users/${userId}/onlineMeetings/${meetingId}/transcripts`;
      const response = await graphService.get<TranscriptList>(endpoint);

      if (!response.value || response.value.length === 0) {
        logger.warn('No transcripts found', { userId, meetingId });
        return [];
      }

      logger.info('Transcripts found', {
        userId,
        meetingId,
        count: response.value.length,
      });

      return response.value;
    } catch (error: any) {
      logger.error('Failed to get transcripts', error, { userId, meetingId });
      throw new MeetingBotError(
        `Failed to get transcripts: ${error.message}`,
        'GET_TRANSCRIPTS_FAILED',
        500,
        error
      );
    }
  }

  /**
   * Obtiene transcripciones usando call records API (alternativa cuando RSC falla)
   * @param callId ID de la llamada del bot
   */
  async getTranscriptsByCallId(callId: string): Promise<Transcript[]> {
    try {
      logger.info('Fetching transcripts using call ID', { callId });

      const endpoint = `/communications/callRecords/${callId}/transcripts`;
      const response = await graphService.get<TranscriptList>(endpoint);

      if (!response.value || response.value.length === 0) {
        logger.warn('No transcripts found for call', { callId });
        return [];
      }

      logger.info('Transcripts found via call records', {
        callId,
        count: response.value.length,
      });

      return response.value;
    } catch (error: any) {
      logger.error('Failed to get transcripts by call ID', error, { callId });
      throw new MeetingBotError(
        `Failed to get transcripts by call ID: ${error.message}`,
        'GET_TRANSCRIPTS_BY_CALL_FAILED',
        500,
        error
      );
    }
  }

  /**
   * Descarga el contenido de una transcripción específica
   * @param userId ID del organizador
   * @param meetingId ID de la reunión
   * @param transcriptId ID de la transcripción
   */
  async downloadTranscript(
    userId: string,
    meetingId: string,
    transcriptId: string
  ): Promise<string> {
    try {
      logger.info('Downloading transcript content', {
        userId,
        meetingId,
        transcriptId,
      });

      // Obtener la URL de contenido de la transcripción
      const endpoint = `/users/${userId}/onlineMeetings/${meetingId}/transcripts/${transcriptId}/content`;
      
      // Graph API devuelve el contenido en formato VTT (WebVTT)
      // Necesitamos hacer la petición con el header apropiado
      const token = await authService.getGraphAccessToken();
      
      const response = await axios.get<string>(
        `https://graph.microsoft.com/v1.0${endpoint}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'text/vtt',
          },
        }
      );

      const content = response.data as string;
      logger.info('Transcript downloaded successfully', {
        userId,
        meetingId,
        transcriptId,
        contentLength: content.length,
      });

      return content;
    } catch (error: any) {
      logger.error('Failed to download transcript', error, {
        userId,
        meetingId,
        transcriptId,
      });
      throw new MeetingBotError(
        `Failed to download transcript: ${error.message}`,
        'DOWNLOAD_TRANSCRIPT_FAILED',
        500,
        error
      );
    }
  }

  /**
   * Obtiene y descarga la transcripción más reciente de una reunión
   * @param userId ID del organizador
   * @param meetingId ID de la reunión
   */
  async getLatestTranscript(userId: string, meetingId: string): Promise<string> {
    try {
      const transcripts = await this.getTranscripts(userId, meetingId);

      if (transcripts.length === 0) {
        throw new TranscriptNotFoundError(meetingId);
      }

      // Ordenar por fecha de creación (más reciente primero)
      const sortedTranscripts = transcripts.sort(
        (a, b) =>
          new Date(b.createdDateTime).getTime() -
          new Date(a.createdDateTime).getTime()
      );

      const latestTranscript = sortedTranscripts[0];
      logger.info('Using latest transcript', {
        transcriptId: latestTranscript.id,
        createdAt: latestTranscript.createdDateTime,
      });

      return await this.downloadTranscript(userId, meetingId, latestTranscript.id);
    } catch (error) {
      logger.error('Failed to get latest transcript', error, { userId, meetingId });
      throw error;
    }
  }

  /**
   * Espera a que una transcripción esté disponible (polling)
   * @param userId ID del organizador
   * @param meetingId ID de la reunión
   * @param maxAttempts Número máximo de intentos
   * @param delayMs Delay entre intentos en milisegundos
   */
  async waitForTranscript(
    userId: string,
    meetingId: string,
    maxAttempts: number = 20,
    delayMs: number = 30000 // 30 segundos
  ): Promise<string> {
    logger.info('Waiting for transcript to be available', {
      userId,
      meetingId,
      maxAttempts,
      delayMs,
    });

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const transcripts = await this.getTranscripts(userId, meetingId);
        
        if (transcripts.length > 0) {
          logger.info('Transcript is now available', {
            userId,
            meetingId,
            attempt,
          });
          return await this.getLatestTranscript(userId, meetingId);
        }

        logger.debug('Transcript not yet available, waiting...', {
          attempt,
          maxAttempts,
        });

        // Esperar antes del siguiente intento
        if (attempt < maxAttempts) {
          await this.delay(delayMs);
        }
      } catch (error) {
        logger.warn('Error checking for transcript', error, { attempt });
        
        if (attempt < maxAttempts) {
          await this.delay(delayMs);
        }
      }
    }

    throw new TranscriptNotFoundError(meetingId);
  }

  /**
   * Parsea el contenido VTT de una transcripción a un formato más legible
   * @param vttContent Contenido en formato VTT
   */
  parseVttTranscript(vttContent: string): TranscriptEntry[] {
    try {
      const entries: TranscriptEntry[] = [];
      const lines = vttContent.split('\n');
      
      let currentEntry: Partial<TranscriptEntry> = {};
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Saltar líneas vacías y header
        if (!line || line.startsWith('WEBVTT') || line.startsWith('NOTE')) {
          continue;
        }
        
        // Detectar timestamps (formato: 00:00:00.000 --> 00:00:00.000)
        if (line.includes('-->')) {
          const [start, end] = line.split('-->').map(t => t.trim());
          currentEntry.startTime = start;
          currentEntry.endTime = end;
          continue;
        }
        
        // Detectar speaker y texto
        if (line.includes(':')) {
          const colonIndex = line.indexOf(':');
          const speaker = line.substring(0, colonIndex).trim();
          const text = line.substring(colonIndex + 1).trim();
          
          if (currentEntry.startTime && currentEntry.endTime) {
            entries.push({
              startTime: currentEntry.startTime,
              endTime: currentEntry.endTime,
              speaker: speaker,
              text: text,
            });
            currentEntry = {};
          }
        }
      }
      
      logger.debug('Parsed VTT transcript', { entriesCount: entries.length });
      return entries;
    } catch (error) {
      logger.error('Failed to parse VTT transcript', error);
      return [];
    }
  }

  /**
   * Convierte entradas de transcripción a texto plano
   * @param entries Array de entradas de transcripción
   */
  entriesToPlainText(entries: TranscriptEntry[]): string {
    return entries
      .map(entry => `[${entry.startTime}] ${entry.speaker}: ${entry.text}`)
      .join('\n');
  }

  /**
   * Helper para delay/sleep
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton instance
export const transcriptService = new TranscriptService();
export default transcriptService;