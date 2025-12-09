"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.openaiService = void 0;
const openai_1 = require("openai");
const config_1 = require("../config/config");
const logger_1 = require("../utils/logger");
const types_1 = require("../types");
const logger = (0, logger_1.createLogger)('OpenAIService');
class OpenAIService {
    constructor() {
        const apiKey = config_1.config.azureOpenAI.apiKey;
        const apiVersion = config_1.config.azureOpenAI.apiVersion;
        const endpoint = config_1.config.azureOpenAI.endpoint;
        const modelName = config_1.config.azureOpenAI.deploymentName;
        const deployment = config_1.config.azureOpenAI.deploymentName;
        const options = { endpoint, apiKey, deployment, apiVersion };
        this.client = new openai_1.AzureOpenAI(options);
        logger.info('OpenAI service initialized');
    }
    async generateMinutes(transcript, meetingId, options) {
        try {
            logger.info('Generating meeting minutes', {
                meetingId,
                transcriptLength: transcript.length,
            });
            const opts = {
                includeTimestamps: options?.includeTimestamps ?? false,
                language: options?.language ?? 'es',
                format: options?.format ?? 'detailed',
                maxTokens: options?.maxTokens ?? 2000,
                temperature: options?.temperature ?? 0.7,
            };
            const systemPrompt = this.buildSystemPrompt(opts);
            const userPrompt = this.buildUserPrompt(transcript, opts);
            const messages = [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ];
            const response = await this.client.chat.completions.create({
                messages: messages,
                max_tokens: opts.maxTokens,
                temperature: opts.temperature,
                top_p: 1,
                frequency_penalty: 0,
                presence_penalty: 0,
                model: config_1.config.azureOpenAI.deploymentName,
            });
            if (!response.choices || response.choices.length === 0) {
                throw new types_1.OpenAIError('No response from Azure OpenAI');
            }
            const content = response.choices[0].message?.content;
            if (!content) {
                throw new types_1.OpenAIError('Empty response from Azure OpenAI');
            }
            const parsedMinutes = this.parseMinutesResponse(content, meetingId, transcript);
            logger.info('Meeting minutes generated successfully', {
                meetingId,
                keyPointsCount: parsedMinutes.keyPoints.length,
                actionItemsCount: parsedMinutes.actionItems.length,
            });
            return parsedMinutes;
        }
        catch (error) {
            logger.error('Failed to generate meeting minutes', error, { meetingId });
            throw new types_1.OpenAIError(`Failed to generate minutes: ${error.message}`, error);
        }
    }
    buildSystemPrompt(options) {
        const languageInstruction = options.language === 'es'
            ? 'Responde en español.'
            : 'Respond in English.';
        return `Eres un asistente experto en generar actas de reuniones profesionales y estructuradas.

Tu tarea es analizar transcripciones de reuniones y crear actas completas que incluyan:
- Resumen ejecutivo de la reunión
- Puntos clave discutidos
- Decisiones tomadas
- Items de acción con responsables (si se mencionan)
- Próximos pasos

${languageInstruction}

IMPORTANTE: Debes responder ÚNICAMENTE con un objeto JSON válido con esta estructura exacta:
{
  "title": "Título descriptivo de la reunión",
  "summary": "Resumen ejecutivo de 2-3 párrafos",
  "keyPoints": ["Punto clave 1", "Punto clave 2", ...],
  "decisions": ["Decisión 1", "Decisión 2", ...],
  "actionItems": [
    {
      "task": "Descripción de la tarea",
      "assignedTo": "Nombre de la persona (si se menciona)",
      "priority": "high|medium|low"
    }
  ],
  "nextSteps": ["Próximo paso 1", "Próximo paso 2", ...]
}

No incluyas markdown, no agregues explicaciones fuera del JSON, solo el objeto JSON puro.`;
    }
    buildUserPrompt(transcript, options) {
        let prompt = 'Analiza la siguiente transcripción de reunión y genera un acta completa:\n\n';
        const maxTranscriptLength = 15000;
        if (transcript.length > maxTranscriptLength) {
            logger.warn('Transcript too long, truncating', {
                originalLength: transcript.length,
                truncatedLength: maxTranscriptLength,
            });
            prompt += transcript.substring(0, maxTranscriptLength);
            prompt += '\n\n[Transcripción truncada por límite de tokens]';
        }
        else {
            prompt += transcript;
        }
        prompt += '\n\nGenera el acta en formato JSON como se especificó en las instrucciones.';
        return prompt;
    }
    parseMinutesResponse(content, meetingId, originalTranscript) {
        try {
            let jsonString = content.trim();
            if (jsonString.startsWith('```json')) {
                jsonString = jsonString.replace(/```json\n?/g, '').replace(/```\n?$/g, '');
            }
            else if (jsonString.startsWith('```')) {
                jsonString = jsonString.replace(/```\n?/g, '');
            }
            const parsed = JSON.parse(jsonString);
            const minutes = {
                meetingId,
                title: parsed.title || 'Reunión sin título',
                date: new Date().toISOString(),
                participants: this.extractParticipants(originalTranscript),
                summary: parsed.summary || '',
                keyPoints: parsed.keyPoints || [],
                actionItems: parsed.actionItems || [],
                decisions: parsed.decisions || [],
                nextSteps: parsed.nextSteps || [],
                generatedAt: new Date().toISOString(),
            };
            return minutes;
        }
        catch (error) {
            logger.error('Failed to parse OpenAI response', error, { content });
            return {
                meetingId,
                title: 'Error al procesar acta',
                date: new Date().toISOString(),
                participants: [],
                summary: 'Error al generar el acta automáticamente. Respuesta: ' + content,
                keyPoints: [],
                actionItems: [],
                decisions: [],
                generatedAt: new Date().toISOString(),
            };
        }
    }
    extractParticipants(transcript) {
        const participants = new Set();
        const lines = transcript.split('\n');
        for (const line of lines) {
            const match = line.match(/^(?:\[[\d:]+\])?\s*([^:]+):/);
            if (match && match[1]) {
                const name = match[1].trim();
                if (name.length > 2 && !name.match(/^\d+$/)) {
                    participants.add(name);
                }
            }
        }
        return Array.from(participants);
    }
    async generateSummary(text, maxLength = 200) {
        try {
            const messages = [
                {
                    role: 'system',
                    content: `Eres un asistente que genera resúmenes concisos. Genera un resumen de máximo ${maxLength} palabras.`,
                },
                {
                    role: 'user',
                    content: `Resume el siguiente texto:\n\n${text}`,
                },
            ];
            const response = await this.client.chat.completions.create({
                model: config_1.config.azureOpenAI.deploymentName,
                messages: messages,
                temperature: 0.5,
                max_tokens: Math.ceil(maxLength * 1.5),
            });
            return response.choices[0].message?.content || '';
        }
        catch (error) {
            logger.error('Failed to generate summary', error);
            throw new types_1.OpenAIError(`Failed to generate summary: ${error.message}`, error);
        }
    }
}
exports.openaiService = new OpenAIService();
exports.default = exports.openaiService;
//# sourceMappingURL=openaiService.js.map