/**
 * Calling Controller
 * Maneja webhooks de eventos de llamadas desde Microsoft Graph
 */

import { Request, Response } from 'express';
import { createLogger } from '../utils/logger';
import { CallNotification, CallEvent, CallState } from '../types';
import { callService } from '../services/callService';
import { transcriptService } from '../services/transcriptService';
import { graphService } from '../services/graphService';
import { openaiService } from '../services/openaiService';

const logger = createLogger('CallingController');

// Store para tracking de reuniones activas
const activeCalls = new Map<string, { meetingId: string; userId: string }>();

/**
 * Webhook endpoint para notificaciones de llamadas
 * POST /api/calling
 */
export const handleCallingWebhook = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    logger.info('Calling webhook received', {
      body: req.body,
      headers: req.headers,
    });

    // Validar que tenga el formato correcto
    const notification: CallNotification = req.body;

    if (!notification.value || !Array.isArray(notification.value)) {
      logger.warn('Invalid webhook payload', { body: req.body });
      res.status(400).json({ error: 'Invalid payload' });
      return;
    }

    // Procesar cada evento
    for (const event of notification.value) {
      await processCallEvent(event);
    }

    // Responder inmediatamente (Microsoft requiere respuesta rápida)
    res.status(202).json({ status: 'accepted' });
  } catch (error) {
    logger.error('Error processing calling webhook', error);
    // Aún así responder OK para no romper el webhook
    res.status(202).json({ status: 'accepted' });
  }
};

/**
 * Procesa un evento individual de llamada
 */
async function processCallEvent(event: CallEvent): Promise<void> {
  try {
    logger.info('Processing call event', {
      callId: event.callId,
      changeType: event.changeType,
      state: event.resourceData?.state,
    });

    const callId = event.callId;
    const state = event.resourceData?.state;

    switch (state) {
      case CallState.Establishing:
        await handleCallEstablishing(callId);
        break;

      case CallState.Established:
        await handleCallEstablished(callId);
        break;

      case CallState.Terminated:
        await handleCallTerminated(callId);
        break;

      default:
        logger.debug('Unhandled call state', { callId, state });
    }
  } catch (error) {
    logger.error('Error processing call event', error, { event });
  }
}

/**
 * Maneja cuando la llamada se está estableciendo
 */
async function handleCallEstablishing(callId: string): Promise<void> {
  logger.info('Call establishing', { callId });
  // Aquí podrías guardar el estado inicial
}

/**
 * Maneja cuando la llamada se establece exitosamente
 */
async function handleCallEstablished(callId: string): Promise<void> {
  try {
    logger.info('Call established - Bot joined meeting', { callId });

    // Obtener información de la llamada
    const callInfo = await callService.getCall(callId);
    
    // Guardar información para procesamiento posterior
    // Nota: En producción deberías guardar esto en una base de datos
    activeCalls.set(callId, {
      meetingId: 'MEETING_ID_PLACEHOLDER', // Necesitarías obtener esto del contexto
      userId: 'USER_ID_PLACEHOLDER',
    });

    logger.info('Call tracked', {
      callId,
      activeCallsCount: activeCalls.size,
    });
  } catch (error) {
    logger.error('Error handling call established', error, { callId });
  }
}

/**
 * Maneja cuando la llamada termina
 */
async function handleCallTerminated(callId: string): Promise<void> {
  try {
    logger.info('Call terminated - Meeting ended', { callId });

    // Obtener información guardada
    const callData = activeCalls.get(callId);
    
    if (!callData) {
      logger.warn('Call data not found for terminated call', { callId });
      return;
    }

    const { meetingId, userId } = callData;

    // Limpiar del store
    activeCalls.delete(callId);

    logger.info('Starting post-meeting processing', { callId, meetingId, userId });

    // Procesar la reunión en background (no bloquear el webhook)
    processMeetingAsync(meetingId, userId, callId);
  } catch (error) {
    logger.error('Error handling call terminated', error, { callId });
  }
}

/**
 * Procesa una reunión terminada de forma asíncrona
 * Descarga transcripción y genera acta
 */
async function processMeetingAsync(
  meetingId: string,
  userId: string,
  callId: string
): Promise<void> {
  try {
    logger.info('Starting async meeting processing', {
      meetingId,
      userId,
      callId,
    });

    // Esperar a que la transcripción esté disponible (puede tardar varios minutos)
    logger.info('Waiting for transcript to be available...');
    const transcript = await transcriptService.waitForTranscript(
      userId,
      meetingId,
      20, // max 20 intentos
      30000 // 30 segundos entre intentos
    );

    logger.info('Transcript downloaded, generating minutes', {
      transcriptLength: transcript.length,
    });

    // Generar acta con Azure OpenAI
    const minutes = await openaiService.generateMinutes(
      transcript,
      meetingId,
      {
        language: 'es',
        format: 'detailed',
      }
    );

    logger.info('Meeting minutes generated successfully', {
      meetingId,
      title: minutes.title,
      actionItemsCount: minutes.actionItems.length,
    });

    // Aquí podrías:
    // 1. Guardar el acta en una base de datos
    // 2. Enviarlo al chat de Teams
    // 3. Enviarlo por email
    // 4. Guardarlo en SharePoint
    
    logger.info('Meeting processing completed', { meetingId });
  } catch (error) {
    logger.error('Failed to process meeting', error, {
      meetingId,
      userId,
      callId,
    });
  }
}

/**
 * Endpoint manual para unir el bot a una reunión
 * POST /api/join-meeting
 */
export const handleJoinMeeting = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { meetingJoinUrl, userId, meetingId } = req.body;

    if (!meetingJoinUrl) {
      res.status(400).json({ error: 'meetingJoinUrl is required' });
      return;
    }

    logger.info('Manual join meeting request', {
      meetingJoinUrl,
      userId,
      meetingId,
    });

    // Validar URL
    if (!callService.isValidTeamsUrl(meetingJoinUrl)) {
      res.status(400).json({ error: 'Invalid Teams meeting URL' });
      return;
    }

    // Unir bot a la reunión
    const callInfo = await callService.joinMeeting(meetingJoinUrl);

    // Guardar información
    if (userId && meetingId) {
      activeCalls.set(callInfo.id, { meetingId, userId });
    }

    res.json({
      success: true,
      callId: callInfo.id,
      state: callInfo.state,
    });
  } catch (error: any) {
    logger.error('Failed to join meeting', error);
    res.status(500).json({
      error: 'Failed to join meeting',
      details: error.message,
    });
  }
};

/**
 * Endpoint manual para procesar una transcripción
 * POST /api/process-transcript
 */
export const handleProcessTranscript = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { userId, meetingId, callId } = req.body;

    // Validar que tenga al menos uno de los métodos
    if (!callId && (!userId || !meetingId)) {
      res.status(400).json({ 
        error: 'Either callId OR (userId and meetingId) are required' 
      });
      return;
    }

    logger.info('Manual process transcript request', { userId, meetingId, callId });

    let transcript: string;

    // Opción 1: Usar callId (recomendado si tienes el ID de la llamada del bot)
    if (callId) {
      logger.info('Using call ID to fetch transcript', { callId });
      const transcripts = await transcriptService.getTranscriptsByCallId(callId);
      
      if (transcripts.length === 0) {
        res.status(404).json({ error: 'No transcripts found for this call' });
        return;
      }

      // Descargar el contenido de la transcripción más reciente
      const latest = transcripts.sort(
        (a: any, b: any) => new Date(b.createdDateTime).getTime() - new Date(a.createdDateTime).getTime()
      )[0];

      // Para call records, intentamos descargar directamente
      try {
        transcript = await transcriptService.downloadTranscript(
          userId || 'system',
          callId,
          latest.id
        );
      } catch (error) {
        logger.warn('Failed to download via standard method, trying alternative', error);
        // Fallback: si falla, intentar obtener el contenido directamente
        if (latest.content) {
          transcript = latest.content;
        } else {
          throw new Error('Transcript content not available');
        }
      }
    } 
    // Opción 2: Usar userId y meetingId (método original)
    else {
      transcript = await transcriptService.getLatestTranscript(userId, meetingId);
    }

    // Generar acta
    const minutes = await openaiService.generateMinutes(
      transcript, 
      meetingId || callId
    );

    res.json({
      success: true,
      minutes,
    });
  } catch (error: any) {
    logger.error('Failed to process transcript', error);
    res.status(500).json({
      error: 'Failed to process transcript',
      details: error.message,
      code: error.code,
      fullError: process.env.NODE_ENV === 'development' ? error : undefined,
    });
  }
};

/**
 * Endpoint de debug para verificar acceso a reunión
 * POST /api/debug-meeting
 */
export const handleDebugMeeting = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { userId, meetingId } = req.body;

    if (!userId || !meetingId) {
      res.status(400).json({ error: 'userId and meetingId are required' });
      return;
    }

    logger.info('Debug meeting request', { userId, meetingId });

    // Intentar obtener info de la reunión
    const meetingInfo = await graphService.get(
      `/users/${userId}/onlineMeetings/${meetingId}`
    );

    // Intentar listar transcripciones
    const transcripts = await transcriptService.getTranscripts(userId, meetingId);

    res.json({
      success: true,
      meetingInfo,
      transcriptsCount: transcripts.length,
      transcripts: transcripts.map(t => ({
        id: t.id,
        createdDateTime: t.createdDateTime,
        hasContent: !!t.content,
      })),
    });
  } catch (error: any) {
    logger.error('Debug meeting failed', error);
    res.status(500).json({
      error: 'Debug failed',
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
      details: error.details,
    });
  }
};