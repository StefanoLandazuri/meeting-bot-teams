"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleGetFormattedTranscript = exports.handleGenerateSummary = exports.handleDebugMeeting = exports.handleProcessTranscript = exports.handleJoinMeeting = exports.handleCallingWebhook = void 0;
const logger_1 = require("../utils/logger");
const types_1 = require("../types");
const callService_1 = require("../services/callService");
const transcriptService_1 = require("../services/transcriptService");
const graphService_1 = require("../services/graphService");
const openaiService_1 = require("../services/openaiService");
const vttParser_1 = require("../services/vttParser");
const logger = (0, logger_1.createLogger)('CallingController');
const activeCalls = new Map();
const handleCallingWebhook = async (req, res) => {
    try {
        logger.info('Calling webhook received', {
            body: req.body,
            headers: req.headers,
        });
        const notification = req.body;
        if (!notification.value || !Array.isArray(notification.value)) {
            logger.warn('Invalid webhook payload', { body: req.body });
            res.status(400).json({ error: 'Invalid payload' });
            return;
        }
        for (const event of notification.value) {
            await processCallEvent(event);
        }
        res.status(202).json({ status: 'accepted' });
    }
    catch (error) {
        logger.error('Error processing calling webhook', error);
        res.status(202).json({ status: 'accepted' });
    }
};
exports.handleCallingWebhook = handleCallingWebhook;
async function processCallEvent(event) {
    try {
        logger.info('Processing call event', {
            callId: event.callId,
            changeType: event.changeType,
            state: event.resourceData?.state,
        });
        const callId = event.callId;
        const state = event.resourceData?.state;
        switch (state) {
            case types_1.CallState.Establishing:
                await handleCallEstablishing(callId);
                break;
            case types_1.CallState.Established:
                await handleCallEstablished(callId);
                break;
            case types_1.CallState.Terminated:
                await handleCallTerminated(callId);
                break;
            default:
                logger.debug('Unhandled call state', { callId, state });
        }
    }
    catch (error) {
        logger.error('Error processing call event', error, { event });
    }
}
async function handleCallEstablishing(callId) {
    logger.info('Call establishing', { callId });
}
async function handleCallEstablished(callId) {
    try {
        logger.info('Call established - Bot joined meeting', { callId });
        const callInfo = await callService_1.callService.getCall(callId);
        activeCalls.set(callId, {
            meetingId: 'MEETING_ID_PLACEHOLDER',
            userId: 'USER_ID_PLACEHOLDER',
        });
        logger.info('Call tracked', {
            callId,
            activeCallsCount: activeCalls.size,
        });
    }
    catch (error) {
        logger.error('Error handling call established', error, { callId });
    }
}
async function handleCallTerminated(callId) {
    try {
        logger.info('Call terminated - Meeting ended', { callId });
        const callData = activeCalls.get(callId);
        if (!callData) {
            logger.warn('Call data not found for terminated call', { callId });
            return;
        }
        const { meetingId, userId } = callData;
        activeCalls.delete(callId);
        logger.info('Starting post-meeting processing', { callId, meetingId, userId });
        processMeetingAsync(meetingId, userId, callId);
    }
    catch (error) {
        logger.error('Error handling call terminated', error, { callId });
    }
}
async function processMeetingAsync(meetingId, userId, callId) {
    try {
        logger.info('Starting async meeting processing', {
            meetingId,
            userId,
            callId,
        });
        logger.info('Waiting for transcript to be available...');
        const transcript = await transcriptService_1.transcriptService.waitForTranscript(userId, meetingId, 20, 30000);
        logger.info('Transcript downloaded, generating minutes', {
            transcriptLength: transcript.length,
        });
        const minutes = await openaiService_1.openaiService.generateMinutes(transcript, meetingId, {
            language: 'es',
            format: 'detailed',
        });
        logger.info('Meeting minutes generated successfully', {
            meetingId,
            title: minutes.title,
            actionItemsCount: minutes.actionItems.length,
        });
        logger.info('Meeting processing completed', { meetingId });
    }
    catch (error) {
        logger.error('Failed to process meeting', error, {
            meetingId,
            userId,
            callId,
        });
    }
}
const handleJoinMeeting = async (req, res) => {
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
        if (!callService_1.callService.isValidTeamsUrl(meetingJoinUrl)) {
            res.status(400).json({ error: 'Invalid Teams meeting URL' });
            return;
        }
        const callInfo = await callService_1.callService.joinMeeting(meetingJoinUrl);
        if (userId && meetingId) {
            activeCalls.set(callInfo.id, { meetingId, userId });
        }
        res.json({
            success: true,
            callId: callInfo.id,
            state: callInfo.state,
        });
    }
    catch (error) {
        logger.error('Failed to join meeting', error);
        res.status(500).json({
            error: 'Failed to join meeting',
            details: error.message,
        });
    }
};
exports.handleJoinMeeting = handleJoinMeeting;
const handleProcessTranscript = async (req, res) => {
    try {
        const { userId, meetingId, callId } = req.body;
        if (!callId && (!userId || !meetingId)) {
            res.status(400).json({
                error: 'Either callId OR (userId and meetingId) are required'
            });
            return;
        }
        logger.info('Manual process transcript request', { userId, meetingId, callId });
        let transcript;
        if (callId) {
            logger.info('Using call ID to fetch transcript', { callId });
            const transcripts = await transcriptService_1.transcriptService.getTranscriptsByCallId(callId);
            if (transcripts.length === 0) {
                res.status(404).json({ error: 'No transcripts found for this call' });
                return;
            }
            const latest = transcripts.sort((a, b) => new Date(b.createdDateTime).getTime() - new Date(a.createdDateTime).getTime())[0];
            try {
                transcript = await transcriptService_1.transcriptService.downloadTranscript(userId || 'system', callId, latest.id);
            }
            catch (error) {
                logger.warn('Failed to download via standard method, trying alternative', error);
                if (latest.content) {
                    transcript = latest.content;
                }
                else {
                    throw new Error('Transcript content not available');
                }
            }
        }
        else {
            transcript = await transcriptService_1.transcriptService.getLatestTranscript(userId, meetingId);
        }
        const minutes = await openaiService_1.openaiService.generateMinutes(transcript, meetingId || callId);
        res.json({
            success: true,
            minutes,
        });
    }
    catch (error) {
        logger.error('Failed to process transcript', error);
        res.status(500).json({
            error: 'Failed to process transcript',
            details: error.message,
            code: error.code,
            fullError: process.env.NODE_ENV === 'development' ? error : undefined,
        });
    }
};
exports.handleProcessTranscript = handleProcessTranscript;
const handleDebugMeeting = async (req, res) => {
    try {
        const { userId, meetingId } = req.body;
        if (!userId || !meetingId) {
            res.status(400).json({ error: 'userId and meetingId are required' });
            return;
        }
        logger.info('Debug meeting request', { userId, meetingId });
        const meetingInfo = await graphService_1.graphService.get(`/users/${userId}/onlineMeetings/${meetingId}`);
        const transcripts = await transcriptService_1.transcriptService.getTranscripts(userId, meetingId);
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
    }
    catch (error) {
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
exports.handleDebugMeeting = handleDebugMeeting;
const handleGenerateSummary = async (req, res) => {
    try {
        if (!req.file) {
            res.status(400).json({ error: 'No file uploaded. Please upload a text file.' });
            return;
        }
        const fileContent = req.file.buffer.toString('utf-8');
        const file = req.file.originalname.toLowerCase();
        let transcript;
        let metadata = {
            fileName: req.file.originalname,
            fileSize: req.file.size,
        };
        if (file.endsWith('.vtt')) {
            logger.info('Parsing VTT file for transcript', { fileName: req.file.originalname });
            const parsed = vttParser_1.VTTParser.parse(fileContent);
            transcript = parsed.fullTranscript;
            metadata = {
                ...metadata,
                fileType: 'vtt',
                duration: parsed.duration,
                numberOfCues: parsed.cues.length,
                speakers: parsed.speakers,
                transcriptLength: transcript.length,
            };
            logger.info('VTT parsed succesfully', metadata);
        }
        else {
            transcript = fileContent;
            metadata = {
                ...metadata,
                fileType: 'txt',
                transcriptLength: transcript.length,
            };
        }
        if (!transcript || transcript.trim().length === 0) {
            res.status(400).json({ error: 'Uploaded file is empty or has no valid transcript content.' });
            return;
        }
        logger.info('Generate summary request', {
            transcriptLength: transcript.length,
            fileName: req.file.originalname,
            fileSize: req.file.size
        });
        const summary = await openaiService_1.openaiService.generateSummary(transcript);
        res.json({
            success: true,
            summary,
            metadata: {
                fileName: req.file.originalname,
                fileSize: req.file.size,
                transcriptLength: transcript.length
            }
        });
    }
    catch (error) {
        logger.error('Failed to generate summary', error);
        if (error.code === 'LIMIT_FILE_SIZE') {
            res.status(413).json({
                error: 'File too large',
                details: 'The file exceeds the maximum allowed size of 50MB',
            });
            return;
        }
        res.status(500).json({
            error: 'Failed to generate summary',
            details: error.message,
            code: error.code,
            fullError: process.env.NODE_ENV === 'development' ? error : undefined,
        });
    }
};
exports.handleGenerateSummary = handleGenerateSummary;
const handleGetFormattedTranscript = async (req, res) => {
    try {
        if (!req.file) {
            res.status(400).json({ error: 'No VTT file uploaded' });
            return;
        }
        const fileContent = req.file.buffer.toString('utf-8');
        const fileName = req.file.originalname.toLowerCase();
        if (!fileName.endsWith('.vtt')) {
            res.status(400).json({ error: 'Only .vtt files are supported for this endpoint' });
            return;
        }
        const formatted = vttParser_1.VTTParser.formatWithTimestamps(fileContent);
        const parsed = vttParser_1.VTTParser.parse(fileContent);
        res.json({
            success: true,
            formattedTranscript: formatted,
            metadata: {
                fileName: req.file.originalname,
                duration: parsed.duration,
                numberOfCues: parsed.cues.length,
                speakers: parsed.speakers,
            },
        });
    }
    catch (error) {
        logger.error('Failed to format transcript', error);
        res.status(500).json({
            error: 'Failed to format transcript',
            details: error.message,
        });
    }
};
exports.handleGetFormattedTranscript = handleGetFormattedTranscript;
//# sourceMappingURL=callingController.js.map