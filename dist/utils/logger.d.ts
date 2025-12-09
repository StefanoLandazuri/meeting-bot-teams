import winston from 'winston';
declare const logger: winston.Logger;
export declare const createLogger: (context: string) => {
    debug: (message: string, meta?: any) => winston.Logger;
    info: (message: string, meta?: any) => winston.Logger;
    warn: (message: string, ...meta: any) => winston.Logger;
    error: (message: string, error?: Error | any, meta?: any) => void;
};
export default logger;
//# sourceMappingURL=logger.d.ts.map