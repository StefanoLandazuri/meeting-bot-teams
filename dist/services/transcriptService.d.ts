import { Transcript, TranscriptEntry } from '../types';
declare class TranscriptService {
    getTranscripts(userId: string, meetingId: string): Promise<Transcript[]>;
    getTranscriptsByCallId(callId: string): Promise<Transcript[]>;
    downloadTranscript(userId: string, meetingId: string, transcriptId: string): Promise<string>;
    getLatestTranscript(userId: string, meetingId: string): Promise<string>;
    waitForTranscript(userId: string, meetingId: string, maxAttempts?: number, delayMs?: number): Promise<string>;
    parseVttTranscript(vttContent: string): TranscriptEntry[];
    entriesToPlainText(entries: TranscriptEntry[]): string;
    private delay;
}
export declare const transcriptService: TranscriptService;
export default transcriptService;
//# sourceMappingURL=transcriptService.d.ts.map