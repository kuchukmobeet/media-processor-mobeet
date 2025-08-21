import pino, { Logger } from 'pino';

/**
 * Create a logger instance with consistent configuration
 */
export const createLogger = (name: string): Logger => {
  return pino({
    name,
    level: process.env.LOG_LEVEL || 'info',
    formatters: {
      level: label => {
        return { level: label };
      },
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    ...(process.env.NODE_ENV === 'development' && {
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss',
          ignore: 'pid,hostname',
        },
      },
    }),
  });
};

/**
 * Application-wide logger instances
 */
export const loggers = {
  app: createLogger('media-processor-app'),
  controller: createLogger('media-controller'),
  service: createLogger('media-service'),
  processor: createLogger('media-processor'),
  asset: createLogger('asset-service'),
  validation: createLogger('validation'),
  request: createLogger('request'),
  error: createLogger('error'),
} as const;

/**
 * Default application logger
 */
export const logger = loggers.app;

/**
 * Utility functions for structured logging
 */
export const logUtils = {
  /**
   * Log processing start
   */
  logProcessingStart: (
    logger: Logger,
    operation: string,
    metadata: Record<string, any>
  ) => {
    logger.info(
      {
        operation,
        stage: 'start',
        ...metadata,
      },
      `Started ${operation}`
    );
  },

  /**
   * Log processing completion
   */
  logProcessingComplete: (
    logger: Logger,
    operation: string,
    metadata: Record<string, any>,
    duration?: number
  ) => {
    logger.info(
      {
        operation,
        stage: 'complete',
        duration,
        ...metadata,
      },
      `Completed ${operation}`
    );
  },

  /**
   * Log processing error
   */
  logProcessingError: (
    logger: Logger,
    operation: string,
    error: Error,
    metadata?: Record<string, any>
  ) => {
    logger.error(
      {
        operation,
        stage: 'error',
        error: {
          message: error.message,
          stack: error.stack,
          name: error.name,
        },
        ...metadata,
      },
      `Failed ${operation}`
    );
  },

  /**
   * Log file operations
   */
  logFileOperation: (
    logger: Logger,
    operation: 'create' | 'delete' | 'move' | 'read',
    filePath: string,
    success: boolean,
    metadata?: Record<string, any>
  ) => {
    const level = success ? 'info' : 'error';
    logger[level](
      {
        operation: `file_${operation}`,
        filePath,
        success,
        ...metadata,
      },
      `File ${operation}: ${filePath}`
    );
  },

  /**
   * Log HTTP requests
   */
  logRequest: (
    logger: Logger,
    method: string,
    url: string,
    statusCode: number,
    duration: number,
    metadata?: Record<string, any>
  ) => {
    const level = statusCode >= 400 ? 'warn' : 'info';
    logger[level](
      {
        http: {
          method,
          url,
          statusCode,
          duration,
        },
        ...metadata,
      },
      `${method} ${url} - ${statusCode} (${duration}ms)`
    );
  },
};

export default logger;
