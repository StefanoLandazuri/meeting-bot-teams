import { TeamsActivityHandler } from 'botbuilder';
export declare class MeetingBot extends TeamsActivityHandler {
    constructor();
    private handleMessage;
    private handleMembersAdded;
    private handleMembersRemoved;
    private sendHelpMessage;
    sendNotification(conversationId: string, message: string): Promise<void>;
}
//# sourceMappingURL=teamsBot.d.ts.map