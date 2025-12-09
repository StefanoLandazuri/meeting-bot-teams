
import winston from 'winston';

// Formato personalizado para logs
const customFormat = winston.format.printf(({ timestamp, level, message, context, ...meta }) => {
  let log = `${timestamp} [${level.toUpperCase()}]`;
  
  if (context) {
    log += ` [${context}]`;
  }
  
  log += `: ${message}`;
  
  // Agregar metadata adicional si existe
  if (Object.keys(meta).length > 0) {
    log += ` ${JSON.stringify(meta)}`;
  }
  
  return log;
});

// Crear instancia de logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    customFormat
  ),
  transports: [
    // Console transport
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        customFormat
      ),
    }),
    // File transport para errores
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // File transport para todos los logs
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
});

// Crear logger con contexto
export const createLogger = (context: string) => {
  return {
    debug: (message: string, meta?: any) => logger.debug(message, { context, ...meta }),
    info: (message: string, meta?: any) => logger.info(message, { context, ...meta }),
    warn: (message: string, ...meta: any) => logger.warn(message, { context, ...meta }),
    error: (message: string, error?: Error | any, meta?: any) => {
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
      } else {
        logger.error(message, { context, error, ...meta });
      }
    },
  };
};

export default logger;