import { MeetingMinutes, MinutesGenerationOptions } from '../types';
declare class OpenAIService {
    private client;
    constructor();
    generateMinutes(transcript: string, meetingId: string, options?: MinutesGenerationOptions): Promise<MeetingMinutes>;
    private buildSystemPrompt;
    private buildUserPrompt;
    private parseMinutesResponse;
    private extractParticipants;
    generateSummary(text: string, maxLength?: number): Promise<string>;
}
export declare const openaiService: OpenAIService;
export default openaiService;
//# sourceMappingURL=openaiService.d.ts.map