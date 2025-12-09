"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAIError = exports.TranscriptNotFoundError = exports.GraphApiError = exports.AuthenticationError = exports.MeetingBotError = exports.ProcessingStatus = exports.CallState = void 0;
var CallState;
(function (CallState) {
    CallState["Incoming"] = "incoming";
    CallState["Establishing"] = "establishing";
    CallState["Established"] = "established";
    CallState["Hold"] = "hold";
    CallState["Transferring"] = "transferring";
    CallState["Terminated"] = "terminated";
})(CallState || (exports.CallState = CallState = {}));
var ProcessingStatus;
(function (ProcessingStatus) {
    ProcessingStatus["Pending"] = "pending";
    ProcessingStatus["JoiningCall"] = "joining_call";
    ProcessingStatus["InCall"] = "in_call";
    ProcessingStatus["CallEnded"] = "call_ended";
    ProcessingStatus["FetchingTranscript"] = "fetching_transcript";
    ProcessingStatus["GeneratingMinutes"] = "generating_minutes";
    ProcessingStatus["Completed"] = "completed";
    ProcessingStatus["Failed"] = "failed";
})(ProcessingStatus || (exports.ProcessingStatus = ProcessingStatus = {}));
class MeetingBotError extends Error {
    constructor(message, code, statusCode = 500, details) {
        super(message);
        this.code = code;
        this.statusCode = statusCode;
        this.details = details;
        this.name = 'MeetingBotError';
    }
}
exports.MeetingBotError = MeetingBotError;
class AuthenticationError extends MeetingBotError {
    constructor(message, details) {
        super(message, 'AUTH_ERROR', 401, details);
        this.name = 'AuthenticationError';
    }
}
exports.AuthenticationError = AuthenticationError;
class GraphApiError extends MeetingBotError {
    constructor(message, details) {
        super(message, 'GRAPH_API_ERROR', 500, details);
        this.name = 'GraphApiError';
    }
}
exports.GraphApiError = GraphApiError;
class TranscriptNotFoundError extends MeetingBotError {
    constructor(meetingId) {
        super(`Transcript not found for meeting: ${meetingId}`, 'TRANSCRIPT_NOT_FOUND', 404);
        this.name = 'TranscriptNotFoundError';
    }
}
exports.TranscriptNotFoundError = TranscriptNotFoundError;
class OpenAIError extends MeetingBotError {
    constructor(message, details) {
        super(message, 'OPENAI_ERROR', 500, details);
        this.name = 'OpenAIError';
    }
}
exports.OpenAIError = OpenAIError;
//# sourceMappingURL=index.js.map