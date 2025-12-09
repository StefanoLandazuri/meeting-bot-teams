"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleProcessTranscript = exports.handleJoinMeeting = exports.handleCallingWebhook = void 0;
const logger_1 = require("../utils/logger");
const types_1 = require("../types");
const callService_1 = require("../services/callService");
const transcriptService_1 = require("../services/transcriptService");
const openaiService_1 = require("../services/openaiService");
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
        });
    }
};
exports.handleProcessTranscript = handleProcessTranscript;
//# sourceMappingURL=callingController.js.map