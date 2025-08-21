import winston from 'winston';

// Define log levels and colors
const logLevels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
};

const logColors = {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    debug: 'white',
};

winston.addColors(logColors);

// Base logger configuration
const createBaseLogger = (className: string) => {
    const logFormat = winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
        winston.format.colorize({ all: true }),
        winston.format.printf((info) => {
            const { timestamp, level, message, ...args } = info;
            const argsStr = Object.keys(args).length ? JSON.stringify(args, null, 2) : '';
            return `${timestamp} [${level}] [${className}]: ${message} ${argsStr}`;
        })
    );

    return winston.createLogger({
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        levels: logLevels,
        format: logFormat,
        transports: [
            new winston.transports.Console({
                format: logFormat,
            }),
        ],
    });
};

// Logger factory function
export const getLogger = (className: string) => {
    return createBaseLogger(className);
};

// Default logger for non-class usage (middleware, etc.)
const defaultLogger = createBaseLogger('System');

// Create a stream object for HTTP request logging
(defaultLogger as any).stream = {
    write: (message: string) => {
        defaultLogger.http(message.trim());
    },
};

export default defaultLogger;
