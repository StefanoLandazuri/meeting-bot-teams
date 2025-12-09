/**
 * Teams Bot
 * Handler principal del bot de Teams
 */

import { TeamsActivityHandler, TurnContext, Activity } from 'botbuilder';
import { createLogger } from '../utils/logger';

const logger = createLogger('TeamsBot');

export class MeetingBot extends TeamsActivityHandler {
  constructor() {
    super();

    // Handler para mensajes
    this.onMessage(async (context, next) => {
      await this.handleMessage(context);
      await next();
    });

    // Handler cuando el bot se une a una conversación
    this.onMembersAdded(async (context, next) => {
      await this.handleMembersAdded(context);
      await next();
    });

    // Handler cuando el bot se remueve de una conversación
    this.onMembersRemoved(async (context, next) => {
      await this.handleMembersRemoved(context);
      await next();
    });

    logger.info('MeetingBot initialized');
  }

  /**
   * Maneja mensajes recibidos
   */
  private async handleMessage(context: TurnContext): Promise<void> {
    const text = context.activity.text?.trim().toLowerCase();
    
    logger.info('Message received', {
      text,
      from: context.activity.from.name,
      conversationId: context.activity.conversation.id,
    });

    // Responder a comandos básicos
    if (text?.includes('hola') || text?.includes('hello')) {
      await context.sendActivity(
        '👋 ¡Hola! Soy el bot de actas de reuniones. Me uno a las reuniones para generar actas automáticamente.'
      );
    } else if (text?.includes('ayuda') || text?.includes('help')) {
      await this.sendHelpMessage(context);
    } else {
      // Respuesta por defecto
      await context.sendActivity(
        'Comando no reconocido. Escribe "ayuda" para ver los comandos disponibles.'
      );
    }
  }

  /**
   * Maneja cuando se agregan miembros a la conversación
   */
  private async handleMembersAdded(context: TurnContext): Promise<void> {
    const membersAdded = context.activity.membersAdded || [];

    for (const member of membersAdded) {
      if (member.id !== context.activity.recipient.id) {
        logger.info('New member added to conversation', {
          memberName: member.name,
          memberId: member.id,
        });

        await context.sendActivity(
          '👋 ¡Bienvenido! Soy el bot de actas de reuniones. ' +
          'Me puedo unir a tus reuniones para generar actas automáticamente.'
        );
      }
    }
  }

  /**
   * Maneja cuando se remueven miembros de la conversación
   */
  private async handleMembersRemoved(context: TurnContext): Promise<void> {
    const membersRemoved = context.activity.membersRemoved || [];

    for (const member of membersRemoved) {
      if (member.id === context.activity.recipient.id) {
        logger.info('Bot was removed from conversation', {
          conversationId: context.activity.conversation.id,
        });
      }
    }
  }

  /**
   * Envía mensaje de ayuda
   */
  private async sendHelpMessage(context: TurnContext): Promise<void> {
    const helpMessage = `
📋 **Bot de Actas de Reuniones**

**¿Qué hago?**
Me uno a tus reuniones de Teams y genero actas automáticamente usando IA.

**Comandos disponibles:**
- \`ayuda\` o \`help\` - Muestra este mensaje
- \`hola\` o \`hello\` - Saludo

**Características:**
✅ Me uno a reuniones automáticamente
✅ Descargo transcripciones
✅ Genero actas estructuradas con:
   - Resumen ejecutivo
   - Puntos clave
   - Decisiones tomadas
   - Items de acción
   - Próximos pasos

**Estado:** Activo 🟢
    `;

    await context.sendActivity(helpMessage.trim());
  }

  /**
   * Envía una notificación a un chat específico
   * Útil para notificar cuando el acta está lista
   */
  async sendNotification(
    conversationId: string,
    message: string
  ): Promise<void> {
    try {
      logger.info('Sending notification', { conversationId });
      
      // Nota: Para enviar mensajes proactivos necesitarás guardar
      // conversationReference cuando el bot recibe mensajes
      // Por ahora solo logueamos
      
      logger.info('Notification prepared (proactive messaging not yet implemented)', {
        conversationId,
        message,
      });
    } catch (error) {
      logger.error('Failed to send notification', error, { conversationId });
    }
  }
}