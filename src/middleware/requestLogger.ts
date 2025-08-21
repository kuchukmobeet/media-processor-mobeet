import { Request, Response, NextFunction } from 'express';
import pino from 'pino';

const logger = pino({ name: 'media-processor' });

/**
 * Request logging middleware
 */
export const requestLogger = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const startTime = Date.now();
  const { method, url, headers, body } = req;

  // Log incoming request
  logger.info(
    {
      request: {
        method,
        url,
        userAgent: headers['user-agent'],
        contentType: headers['content-type'],
        contentLength: headers['content-length'],
        ip: req.ip,
      },
    },
    'Incoming request'
  );

  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const { statusCode } = res;

    const logData = {
      request: { method, url },
      response: {
        statusCode,
        contentLength: res.get('content-length'),
        duration,
      },
    };

    if (statusCode >= 400) {
      logger.warn(logData, 'Request completed with error');
    } else {
      logger.info(logData, 'Request completed successfully');
    }
  });

  next();
};
