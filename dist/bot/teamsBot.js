"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MeetingBot = void 0;
const botbuilder_1 = require("botbuilder");
const logger_1 = require("../utils/logger");
const logger = (0, logger_1.createLogger)('TeamsBot');
class MeetingBot extends botbuilder_1.TeamsActivityHandler {
    constructor() {
        super();
        this.onMessage(async (context, next) => {
            await this.handleMessage(context);
            await next();
        });
        this.onMembersAdded(async (context, next) => {
            await this.handleMembersAdded(context);
            await next();
        });
        this.onMembersRemoved(async (context, next) => {
            await this.handleMembersRemoved(context);
            await next();
        });
        logger.info('MeetingBot initialized');
    }
    async handleMessage(context) {
        const text = context.activity.text?.trim().toLowerCase();
        logger.info('Message received', {
            text,
            from: context.activity.from.name,
            conversationId: context.activity.conversation.id,
        });
        if (text?.includes('hola') || text?.includes('hello')) {
            await context.sendActivity('👋 ¡Hola! Soy el bot de actas de reuniones. Me uno a las reuniones para generar actas automáticamente.');
        }
        else if (text?.includes('ayuda') || text?.includes('help')) {
            await this.sendHelpMessage(context);
        }
        else {
            await context.sendActivity('Comando no reconocido. Escribe "ayuda" para ver los comandos disponibles.');
        }
    }
    async handleMembersAdded(context) {
        const membersAdded = context.activity.membersAdded || [];
        for (const member of membersAdded) {
            if (member.id !== context.activity.recipient.id) {
                logger.info('New member added to conversation', {
                    memberName: member.name,
                    memberId: member.id,
                });
                await context.sendActivity('👋 ¡Bienvenido! Soy el bot de actas de reuniones. ' +
                    'Me puedo unir a tus reuniones para generar actas automáticamente.');
            }
        }
    }
    async handleMembersRemoved(context) {
        const membersRemoved = context.activity.membersRemoved || [];
        for (const member of membersRemoved) {
            if (member.id === context.activity.recipient.id) {
                logger.info('Bot was removed from conversation', {
                    conversationId: context.activity.conversation.id,
                });
            }
        }
    }
    async sendHelpMessage(context) {
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
    async sendNotification(conversationId, message) {
        try {
            logger.info('Sending notification', { conversationId });
            logger.info('Notification prepared (proactive messaging not yet implemented)', {
                conversationId,
                message,
            });
        }
        catch (error) {
            logger.error('Failed to send notification', error, { conversationId });
        }
    }
}
exports.MeetingBot = MeetingBot;
//# sourceMappingURL=teamsBot.js.map