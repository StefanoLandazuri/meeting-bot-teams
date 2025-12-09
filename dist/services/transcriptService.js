"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.transcriptService = void 0;
const graphService_1 = require("./graphService");
const logger_1 = require("../utils/logger");
const types_1 = require("../types");
const axios_1 = __importDefault(require("axios"));
const authService_1 = require("./authService");
const logger = (0, logger_1.createLogger)('TranscriptService');
class TranscriptService {
    async getTranscripts(userId, meetingId) {
        try {
            logger.info('Fetching transcripts for meeting', { userId, meetingId });
            const endpoint = `/users/${userId}/onlineMeetings/${meetingId}/transcripts`;
            const response = await graphService_1.graphService.get(endpoint);
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
        }
        catch (error) {
            logger.error('Failed to get transcripts', error, { userId, meetingId });
            throw new types_1.MeetingBotError(`Failed to get transcripts: ${error.message}`, 'GET_TRANSCRIPTS_FAILED', 500, error);
        }
    }
    async getTranscriptsByCallId(callId) {
        try {
            logger.info('Fetching transcripts using call ID', { callId });
            const endpoint = `/communications/callRecords/${callId}/transcripts`;
            const response = await graphService_1.graphService.get(endpoint);
            if (!response.value || response.value.length === 0) {
                logger.warn('No transcripts found for call', { callId });
                return [];
            }
            logger.info('Transcripts found via call records', {
                callId,
                count: response.value.length,
            });
            return response.value;
        }
        catch (error) {
            logger.error('Failed to get transcripts by call ID', error, { callId });
            throw new types_1.MeetingBotError(`Failed to get transcripts by call ID: ${error.message}`, 'GET_TRANSCRIPTS_BY_CALL_FAILED', 500, error);
        }
    }
    async downloadTranscript(userId, meetingId, transcriptId) {
        try {
            logger.info('Downloading transcript content', {
                userId,
                meetingId,
                transcriptId,
            });
            const endpoint = `/users/${userId}/onlineMeetings/${meetingId}/transcripts/${transcriptId}/content`;
            const token = await authService_1.authService.getGraphAccessToken();
            const response = await axios_1.default.get(`https://graph.microsoft.com/v1.0${endpoint}`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: 'text/vtt',
                },
            });
            const content = response.data;
            logger.info('Transcript downloaded successfully', {
                userId,
                meetingId,
                transcriptId,
                contentLength: content.length,
            });
            return content;
        }
        catch (error) {
            logger.error('Failed to download transcript', error, {
                userId,
                meetingId,
                transcriptId,
            });
            throw new types_1.MeetingBotError(`Failed to download transcript: ${error.message}`, 'DOWNLOAD_TRANSCRIPT_FAILED', 500, error);
        }
    }
    async getLatestTranscript(userId, meetingId) {
        try {
            const transcripts = await this.getTranscripts(userId, meetingId);
            if (transcripts.length === 0) {
                throw new types_1.TranscriptNotFoundError(meetingId);
            }
            const sortedTranscripts = transcripts.sort((a, b) => new Date(b.createdDateTime).getTime() -
                new Date(a.createdDateTime).getTime());
            const latestTranscript = sortedTranscripts[0];
            logger.info('Using latest transcript', {
                transcriptId: latestTranscript.id,
                createdAt: latestTranscript.createdDateTime,
            });
            return await this.downloadTranscript(userId, meetingId, latestTranscript.id);
        }
        catch (error) {
            logger.error('Failed to get latest transcript', error, { userId, meetingId });
            throw error;
        }
    }
    async waitForTranscript(userId, meetingId, maxAttempts = 20, delayMs = 30000) {
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
                if (attempt < maxAttempts) {
                    await this.delay(delayMs);
                }
            }
            catch (error) {
                logger.warn('Error checking for transcript', error, { attempt });
                if (attempt < maxAttempts) {
                    await this.delay(delayMs);
                }
            }
        }
        throw new types_1.TranscriptNotFoundError(meetingId);
    }
    parseVttTranscript(vttContent) {
        try {
            const entries = [];
            const lines = vttContent.split('\n');
            let currentEntry = {};
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line || line.startsWith('WEBVTT') || line.startsWith('NOTE')) {
                    continue;
                }
                if (line.includes('-->')) {
                    const [start, end] = line.split('-->').map(t => t.trim());
                    currentEntry.startTime = start;
                    currentEntry.endTime = end;
                    continue;
                }
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
        }
        catch (error) {
            logger.error('Failed to parse VTT transcript', error);
            return [];
        }
    }
    entriesToPlainText(entries) {
        return entries
            .map(entry => `[${entry.startTime}] ${entry.speaker}: ${entry.text}`)
            .join('\n');
    }
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
exports.transcriptService = new TranscriptService();
exports.default = exports.transcriptService;
//# sourceMappingURL=transcriptService.js.map