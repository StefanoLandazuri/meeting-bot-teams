
export interface AppConfig {
  // Azure AD / Bot
  microsoftAppId: string;
  microsoftAppPassword: string;
  microsoftAppTenantId: string;
  botId: string;
  botHandle: string;

  // Graph API
  graphApiEndpoint: string;

  // Server
  port: number;
  nodeEnv: 'development' | 'production' | 'test';
  callingWebhookUrl: string;

  // Azure OpenAI
  azureOpenAI: {
    endpoint: string;
    apiKey: string;
    deploymentName: string;
    apiVersion: string;
  };

  // Logging
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

// ============================================================================
// Microsoft Graph Types
// ============================================================================

/**
 * Información de una reunión de Teams
 */
export interface Meeting {
  id: string;
  subject: string;
  startDateTime: string;
  endDateTime: string;
  joinUrl: string;
  organizer: {
    id: string;
    displayName: string;
    email: string;
  };
  participants?: Participant[];
  chatId?: string;
}

/**
 * Participante de una reunión
 */
export interface Participant {
  id: string;
  displayName: string;
  email?: string;
  role: 'organizer' | 'presenter' | 'attendee';
}

/**
 * Información de una llamada activa
 */
export interface CallInfo {
  id: string;
  state: CallState;
  source: {
    identity: {
      user?: {
        id: string;
        displayName: string;
      };
    };
  };
  targets: Array<{
    identity: {
      user?: {
        id: string;
        displayName: string;
      };
    };
  }>;
  meetingInfo?: {
    joinUrl: string;
  };
  createdDateTime: string;
}

/**
 * Estados posibles de una llamada
 */
export enum CallState {
  Incoming = 'incoming',
  Establishing = 'establishing',
  Established = 'established',
  Hold = 'hold',
  Transferring = 'transferring',
  Terminated = 'terminated',
}

/**
 * Payload para crear una llamada (unirse a reunión)
 */
export interface CreateCallPayload {
  '@odata.type': string;
  callbackUri: string;
  source: {
    identity: {
      application: {
        id: string;
        displayName: string;
      };
    };
  };
  targets: Array<{
    identity: {
      application?: {
        id: string;
        displayName: string;
      };
    };
  }>;
  requestedModalities: Array<'audio' | 'video'>;
  mediaConfig: {
    '@odata.type': string;
  };
  chatInfo: {
    '@odata.type': string;
    threadId: string;
    messageId: string;
  };
  meetingInfo: {
    '@odata.type': string;
  };
  tenantId: string;
}

// ============================================================================
// Transcript Types
// ============================================================================

/**
 * Información de una transcripción
 */
export interface Transcript {
  id: string;
  meetingId: string;
  createdDateTime: string;
  content?: string; // Contenido de la transcripción (VTT o texto plano)
  contentUrl?: string;
  meetingOrganizerId?: string;
}

/**
 * Lista de transcripciones
 */
export interface TranscriptList {
  '@odata.context': string;
  '@odata.count'?: number;
  value: Transcript[];
}

/**
 * Entrada de transcripción parseada (de formato VTT)
 */
export interface TranscriptEntry {
  startTime: string;
  endTime: string;
  speaker: string;
  text: string;
}

// ============================================================================
// Call Events (Webhook)
// ============================================================================

/**
 * Notificación recibida del webhook de calling
 */
export interface CallNotification {
  value: CallEvent[];
}

/**
 * Evento de llamada individual
 */
export interface CallEvent {
  '@odata.type': string;
  callId: string;
  resourceUrl?: string;
  resourceData?: {
    '@odata.type': string;
    state: CallState;
    resultInfo?: {
      code: number;
      subcode: number;
      message: string;
    };
  };
  changeType: 'created' | 'updated' | 'deleted';
}

// ============================================================================
// Meeting Minutes (Acta de reunión)
// ============================================================================

/**
 * Acta de reunión generada por Azure OpenAI
 */
export interface MeetingMinutes {
  meetingId: string;
  title: string;
  date: string;
  participants: string[];
  summary: string;
  keyPoints: string[];
  actionItems: ActionItem[];
  decisions: string[];
  nextSteps?: string[];
  rawTranscript?: string;
  generatedAt: string;
}

/**
 * Item de acción identificado en la reunión
 */
export interface ActionItem {
  task: string;
  assignedTo?: string;
  dueDate?: string;
  priority?: 'high' | 'medium' | 'low';
}

// ============================================================================
// Azure OpenAI Types
// ============================================================================

/**
 * Mensaje para Azure OpenAI Chat Completion
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Opciones para la generación de actas
 */
export interface MinutesGenerationOptions {
  includeTimestamps?: boolean;
  language?: string;
  format?: 'detailed' | 'summary' | 'executive';
  maxTokens?: number;
  temperature?: number;
}

// ============================================================================
// API Response Types
// ============================================================================

/**
 * Respuesta estándar de la API
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: string;
}

/**
 * Respuesta de health check
 */
export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy';
  version: string;
  timestamp: string;
  services: {
    bot: boolean;
    graphApi: boolean;
    openAI: boolean;
  };
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Estado de procesamiento de una reunión
 */
export enum ProcessingStatus {
  Pending = 'pending',
  JoiningCall = 'joining_call',
  InCall = 'in_call',
  CallEnded = 'call_ended',
  FetchingTranscript = 'fetching_transcript',
  GeneratingMinutes = 'generating_minutes',
  Completed = 'completed',
  Failed = 'failed',
}

/**
 * Job de procesamiento de reunión
 */
export interface MeetingProcessingJob {
  id: string;
  meetingId: string;
  callId?: string;
  status: ProcessingStatus;
  startedAt: string;
  completedAt?: string;
  error?: string;
  result?: MeetingMinutes;
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Errores personalizados de la aplicación
 */
export class MeetingBotError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message);
    this.name = 'MeetingBotError';
  }
}

export class AuthenticationError extends MeetingBotError {
  constructor(message: string, details?: any) {
    super(message, 'AUTH_ERROR', 401, details);
    this.name = 'AuthenticationError';
  }
}

export class GraphApiError extends MeetingBotError {
  constructor(message: string, details?: any) {
    super(message, 'GRAPH_API_ERROR', 500, details);
    this.name = 'GraphApiError';
  }
}

export class TranscriptNotFoundError extends MeetingBotError {
  constructor(meetingId: string) {
    super(
      `Transcript not found for meeting: ${meetingId}`,
      'TRANSCRIPT_NOT_FOUND',
      404
    );
    this.name = 'TranscriptNotFoundError';
  }
}

export class OpenAIError extends MeetingBotError {
  constructor(message: string, details?: any) {
    super(message, 'OPENAI_ERROR', 500, details);
    this.name = 'OpenAIError';
  }
}