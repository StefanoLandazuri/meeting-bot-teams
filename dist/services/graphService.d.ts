import { Client } from '@microsoft/microsoft-graph-client';
declare class GraphService {
    private client;
    private credential;
    constructor();
    getClient(): Client;
    get<T = any>(endpoint: string): Promise<T>;
    post<T = any>(endpoint: string, body: any): Promise<T>;
    patch<T = any>(endpoint: string, body: any): Promise<T>;
    delete(endpoint: string): Promise<void>;
    getUser(userId: string): Promise<any>;
    getOnlineMeeting(userId: string, meetingId: string): Promise<any>;
}
export declare const graphService: GraphService;
export default graphService;
//# sourceMappingURL=graphService.d.ts.map