"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.callService = void 0;
const graphService_1 = require("./graphService");
const config_1 = require("../config/config");
const logger_1 = require("../utils/logger");
const types_1 = require("../types");
const logger = (0, logger_1.createLogger)('CallService');
class CallService {
    async joinMeeting(meetingJoinUrl) {
        try {
            logger.info('Attempting to join meeting', { meetingJoinUrl });
            const threadId = this.extractThreadIdFromJoinUrl(meetingJoinUrl);
            if (!threadId) {
                throw new types_1.MeetingBotError('Invalid meeting join URL - could not extract thread ID', 'INVALID_JOIN_URL', 400);
            }
            const payload = {
                '@odata.type': '#microsoft.graph.call',
                callbackUri: `${config_1.config.callingWebhookUrl}`,
                source: {
                    identity: {
                        application: {
                            id: config_1.config.microsoftAppId,
                            displayName: config_1.config.botHandle,
                        },
                    },
                },
                requestedModalities: ['audio'],
                mediaConfig: {
                    '@odata.type': '#microsoft.graph.serviceHostedMediaConfig',
                },
                chatInfo: {
                    '@odata.type': '#microsoft.graph.chatInfo',
                    threadId: threadId,
                    messageId: '0',
                },
                tenantId: config_1.config.microsoftAppTenantId,
            };
            const callInfo = await graphService_1.graphService.post('/communications/calls', payload);
            logger.info('Successfully joined meeting', {
                callId: callInfo.id,
                meetingJoinUrl,
            });
            return callInfo;
        }
        catch (error) {
            logger.error('Failed to join meeting', error, { meetingJoinUrl });
            throw new types_1.MeetingBotError(`Failed to join meeting: ${error.message}`, 'JOIN_MEETING_FAILED', 500, error);
        }
    }
    async getCall(callId) {
        try {
            logger.debug('Getting call information', { callId });
            const callInfo = await graphService_1.graphService.get(`/communications/calls/${callId}`);
            return callInfo;
        }
        catch (error) {
            logger.error('Failed to get call information', error, { callId });
            throw new types_1.MeetingBotError(`Failed to get call: ${error.message}`, 'GET_CALL_FAILED', 500, error);
        }
    }
    async leaveCall(callId) {
        try {
            logger.info('Leaving call', { callId });
            await graphService_1.graphService.delete(`/communications/calls/${callId}`);
            logger.info('Successfully left call', { callId });
        }
        catch (error) {
            logger.error('Failed to leave call', error, { callId });
            throw new types_1.MeetingBotError(`Failed to leave call: ${error.message}`, 'LEAVE_CALL_FAILED', 500, error);
        }
    }
    extractThreadIdFromJoinUrl(joinUrl) {
        try {
            const url = new URL(joinUrl);
            const pathParts = url.pathname.split('/');
            for (const part of pathParts) {
                if (part.includes('thread.v2') || part.includes('thread.skype')) {
                    const decodedThreadId = decodeURIComponent(part);
                    logger.debug('Extracted threadId from path', { threadId: decodedThreadId });
                    return decodedThreadId;
                }
            }
            const match = url.pathname.match(/\/([^\/]*thread\.(?:v2|skype)[^\/]*)/);
            if (match && match[1]) {
                const decodedThreadId = decodeURIComponent(match[1]);
                logger.debug('Extracted threadId with regex', { threadId: decodedThreadId });
                return decodedThreadId;
            }
            logger.warn('Could not extract threadId from join URL', {
                joinUrl,
                pathname: url.pathname,
                pathParts
            });
            return null;
        }
        catch (error) {
            logger.error('Error parsing join URL', error, { joinUrl });
            return null;
        }
    }
    isValidTeamsUrl(joinUrl) {
        try {
            const url = new URL(joinUrl);
            return (url.hostname.includes('teams.microsoft.com') &&
                url.pathname.includes('meetup-join'));
        }
        catch {
            return false;
        }
    }
}
exports.callService = new CallService();
exports.default = exports.callService;
//# sourceMappingURL=callService.js.map