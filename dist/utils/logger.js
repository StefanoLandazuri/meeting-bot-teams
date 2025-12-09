"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createLogger = void 0;
const winston_1 = __importDefault(require("winston"));
const customFormat = winston_1.default.format.printf(({ timestamp, level, message, context, ...meta }) => {
    let log = `${timestamp} [${level.toUpperCase()}]`;
    if (context) {
        log += ` [${context}]`;
    }
    log += `: ${message}`;
    if (Object.keys(meta).length > 0) {
        log += ` ${JSON.stringify(meta)}`;
    }
    return log;
});
const logger = winston_1.default.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston_1.default.format.combine(winston_1.default.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), winston_1.default.format.errors({ stack: true }), winston_1.default.format.splat(), customFormat),
    transports: [
        new winston_1.default.transports.Console({
            format: winston_1.default.format.combine(winston_1.default.format.colorize(), customFormat),
        }),
        new winston_1.default.transports.File({
            filename: 'logs/error.log',
            level: 'error',
            maxsize: 5242880,
            maxFiles: 5,
        }),
        new winston_1.default.transports.File({
            filename: 'logs/combined.log',
            maxsize: 5242880,
            maxFiles: 5,
        }),
    ],
});
const createLogger = (context) => {
    return {
        debug: (message, meta) => logger.debug(message, { context, ...meta }),
        info: (message, meta) => logger.info(message, { context, ...meta }),
        warn: (message, ...meta) => logger.warn(message, { context, ...meta }),
        error: (message, error, meta) => {
            if (error instanceof Error) {
                logger.error(message, {
                    context,
                    error: {
                        message: error.message,
                        stack: error.stack,
                        name: error.name,
                    },
                    ...meta,
                });
            }
            else {
                logger.error(message, { context, error, ...meta });
            }
        },
    };
};
exports.createLogger = createLogger;
exports.default = logger;
//# sourceMappingURL=logger.js.map