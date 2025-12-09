import { CallInfo } from '../types';
declare class CallService {
    joinMeeting(meetingJoinUrl: string): Promise<CallInfo>;
    getCall(callId: string): Promise<CallInfo>;
    leaveCall(callId: string): Promise<void>;
    private extractThreadIdFromJoinUrl;
    isValidTeamsUrl(joinUrl: string): boolean;
}
export declare const callService: CallService;
export default callService;
//# sourceMappingURL=callService.d.ts.map