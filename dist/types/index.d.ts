export interface AppConfig {
    microsoftAppId: string;
    microsoftAppPassword: string;
    microsoftAppTenantId: string;
    botId: string;
    botHandle: string;
    graphApiEndpoint: string;
    port: number;
    nodeEnv: 'development' | 'production' | 'test';
    callingWebhookUrl: string;
    azureOpenAI: {
        endpoint: string;
        apiKey: string;
        deploymentName: string;
        apiVersion: string;
    };
    logLevel: 'debug' | 'info' | 'warn' | 'error';
}
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
export interface Participant {
    id: string;
    displayName: string;
    email?: string;
    role: 'organizer' | 'presenter' | 'attendee';
}
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
export declare enum CallState {
    Incoming = "incoming",
    Establishing = "establishing",
    Established = "established",
    Hold = "hold",
    Transferring = "transferring",
    Terminated = "terminated"
}
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
export interface Transcript {
    id: string;
    meetingId: string;
    createdDateTime: string;
    content?: string;
    contentUrl?: string;
    meetingOrganizerId?: string;
}
export interface TranscriptList {
    '@odata.context': string;
    '@odata.count'?: number;
    value: Transcript[];
}
export interface TranscriptEntry {
    startTime: string;
    endTime: string;
    speaker: string;
    text: string;
}
export interface CallNotification {
    value: CallEvent[];
}
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
export interface ActionItem {
    task: string;
    assignedTo?: string;
    dueDate?: string;
    priority?: 'high' | 'medium' | 'low';
}
export interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}
export interface MinutesGenerationOptions {
    includeTimestamps?: boolean;
    language?: string;
    format?: 'detailed' | 'summary' | 'executive';
    maxTokens?: number;
    temperature?: number;
}
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
export declare enum ProcessingStatus {
    Pending = "pending",
    JoiningCall = "joining_call",
    InCall = "in_call",
    CallEnded = "call_ended",
    FetchingTranscript = "fetching_transcript",
    GeneratingMinutes = "generating_minutes",
    Completed = "completed",
    Failed = "failed"
}
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
export declare class MeetingBotError extends Error {
    code: string;
    statusCode: number;
    details?: any | undefined;
    constructor(message: string, code: string, statusCode?: number, details?: any | undefined);
}
export declare class AuthenticationError extends MeetingBotError {
    constructor(message: string, details?: any);
}
export declare class GraphApiError extends MeetingBotError {
    constructor(message: string, details?: any);
}
export declare class TranscriptNotFoundError extends MeetingBotError {
    constructor(meetingId: string);
}
export declare class OpenAIError extends MeetingBotError {
    constructor(message: string, details?: any);
}
//# sourceMappingURL=index.d.ts.map