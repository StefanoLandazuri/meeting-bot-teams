
import { DefaultAzureCredential, getBearerTokenProvider } from "@azure/identity";
import { AzureOpenAI } from "openai";
import { config } from '../config/config';
import { createLogger } from '../utils/logger';
import {
    MeetingMinutes,
    ChatMessage,
    MinutesGenerationOptions,
    OpenAIError,
} from '../types';

const logger = createLogger('OpenAIService');

class OpenAIService {
    private client: AzureOpenAI;

    constructor() {
        const apiKey = config.azureOpenAI.apiKey;
        const apiVersion = config.azureOpenAI.apiVersion;
        const endpoint = config.azureOpenAI.endpoint;
        const modelName = config.azureOpenAI.deploymentName;
        const deployment = config.azureOpenAI.deploymentName;
        const options = { endpoint, apiKey, deployment, apiVersion }

        this.client = new AzureOpenAI(options);
        logger.info('OpenAI service initialized');
    }

    /**
     * Genera un acta de reunión a partir de una transcripción
     * @param transcript Contenido de la transcripción
     * @param meetingId ID de la reunión
     * @param options Opciones de generación
     */
    async generateMinutes(
        transcript: string,
        meetingId: string,
        options?: MinutesGenerationOptions
    ): Promise<MeetingMinutes> {
        try {
            logger.info('Generating meeting minutes', {
                meetingId,
                transcriptLength: transcript.length,
            });

            // Configurar opciones por defecto
            const opts: Required<MinutesGenerationOptions> = {
                includeTimestamps: options?.includeTimestamps ?? false,
                language: options?.language ?? 'es',
                format: options?.format ?? 'detailed',
                maxTokens: options?.maxTokens ?? 2000,
                temperature: options?.temperature ?? 0.7,
            };

            // Construir el prompt
            const systemPrompt = this.buildSystemPrompt(opts);
            const userPrompt = this.buildUserPrompt(transcript, opts);

            const messages: ChatMessage[] = [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ];

            // Llamar a Azure OpenAI
            const response = await this.client.chat.completions.create(
                {
                    messages: messages,
                    max_tokens: opts.maxTokens,
                    temperature: opts.temperature,
                    top_p: 1,
                    frequency_penalty: 0,
                    presence_penalty: 0,
                    model: config.azureOpenAI.deploymentName,
                }
            );

            if (!response.choices || response.choices.length === 0) {
                throw new OpenAIError('No response from Azure OpenAI');
            }

            const content = response.choices[0].message?.content;
            if (!content) {
                throw new OpenAIError('Empty response from Azure OpenAI');
            }

            // Parsear la respuesta JSON
            const parsedMinutes = this.parseMinutesResponse(content, meetingId, transcript);

            logger.info('Meeting minutes generated successfully', {
                meetingId,
                keyPointsCount: parsedMinutes.keyPoints.length,
                actionItemsCount: parsedMinutes.actionItems.length,
            });

            return parsedMinutes;
        } catch (error: any) {
            logger.error('Failed to generate meeting minutes', error, { meetingId });
            throw new OpenAIError(
                `Failed to generate minutes: ${error.message}`,
                error
            );
        }
    }

    /**
     * Construye el prompt del sistema
     */
    private buildSystemPrompt(options: Required<MinutesGenerationOptions>): string {
        const languageInstruction =
            options.language === 'es'
                ? 'Responde en español.'
                : 'Respond in English.';

        return `Eres un asistente experto en generar actas de reuniones profesionales y estructuradas.

Tu tarea es analizar transcripciones de reuniones y crear actas completas que incluyan:
- Resumen ejecutivo de la reunión
- Puntos clave discutidos
- Decisiones tomadas
- Items de acción con responsables (si se mencionan)
- Infiere la fase del proyecto (si es posible)

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
  "projectPhase": "Fase del proyecto inferida (si es posible)"
}

No incluyas markdown, no agregues explicaciones fuera del JSON, solo el objeto JSON puro.`;
    }

    /**
     * Construye el prompt del usuario
     */
    private buildUserPrompt(
        transcript: string,
        options: Required<MinutesGenerationOptions>
    ): string {
        let prompt = 'Analiza la siguiente transcripción de reunión y genera un acta completa:\n\n';

        // Truncar transcripción si es muy larga (para no exceder límite de tokens)
        const maxTranscriptLength = 15000; // ~3750 tokens aproximadamente
        if (transcript.length > maxTranscriptLength) {
            logger.warn('Transcript too long, truncating', {
                originalLength: transcript.length,
                truncatedLength: maxTranscriptLength,
            });
            prompt += transcript.substring(0, maxTranscriptLength);
            prompt += '\n\n[Transcripción truncada por límite de tokens]';
        } else {
            prompt += transcript;
        }

        prompt += '\n\nGenera el acta en formato JSON como se especificó en las instrucciones.';

        return prompt;
    }

    /**
     * Parsea la respuesta de OpenAI a un objeto MeetingMinutes
     */
    private parseMinutesResponse(
        content: string,
        meetingId: string,
        originalTranscript: string
    ): MeetingMinutes {
        try {
            // Intentar extraer JSON si viene con markdown
            let jsonString = content.trim();

            // Remover posibles backticks de markdown
            if (jsonString.startsWith('```json')) {
                jsonString = jsonString.replace(/```json\n?/g, '').replace(/```\n?$/g, '');
            } else if (jsonString.startsWith('```')) {
                jsonString = jsonString.replace(/```\n?/g, '');
            }

            const parsed = JSON.parse(jsonString);

            // Construir el objeto MeetingMinutes
            const minutes: MeetingMinutes = {
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
        } catch (error) {
            logger.error('Failed to parse OpenAI response', error, { content });

            // Fallback: crear un objeto básico si el parsing falla
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

    /**
     * Extrae nombres de participantes de la transcripción
     */
    private extractParticipants(transcript: string): string[] {
        const participants = new Set<string>();

        // Buscar patrones como "Nombre:" al inicio de líneas
        const lines = transcript.split('\n');
        for (const line of lines) {
            const match = line.match(/^(?:\[[\d:]+\])?\s*([^:]+):/);
            if (match && match[1]) {
                const name = match[1].trim();
                // Filtrar timestamps y nombres muy cortos
                if (name.length > 2 && !name.match(/^\d+$/)) {
                    participants.add(name);
                }
            }
        }

        return Array.from(participants);
    }

    /**
     * Genera un resumen corto de una transcripción (para uso general)
     */
    async generateSummary(
        text: string,
        maxLength: number = 200
    ): Promise<string> {
        try {
            const messages: ChatMessage[] = [
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
                model: config.azureOpenAI.deploymentName,
                messages: messages as any,
                temperature: 0.5,
                max_tokens: Math.ceil(maxLength * 1.5),
            });

            return response.choices[0].message?.content || '';
        } catch (error: any) {
            logger.error('Failed to generate summary', error);
            throw new OpenAIError(`Failed to generate summary: ${error.message}`, error);
        }
    }
}

// Singleton instance
export const openaiService = new OpenAIService();
export default openaiService;