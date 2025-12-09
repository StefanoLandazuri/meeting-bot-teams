declare class AuthService {
    private credential;
    private tokenCache;
    constructor();
    getGraphAccessToken(): Promise<string>;
    getAccessToken(scope: string): Promise<string>;
    clearCache(): void;
    validateCredentials(): Promise<boolean>;
}
export declare const authService: AuthService;
export default authService;
//# sourceMappingURL=authService.d.ts.map