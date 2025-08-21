import { Request, Response, NextFunction } from 'express';
import { ErrorResponse } from '../types/http';
import pino from 'pino';

const logger = pino({ name: 'media-processor' });

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode: number = 500,
    isOperational: boolean = true
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Global error handler middleware
 */
export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let statusCode = 500;
  let message = 'Internal server error';
  let details: string | undefined;

  // Handle known application errors
  if (error instanceof AppError) {
    statusCode = error.statusCode;
    message = error.message;
  }
  // Handle validation errors (Zod)
  else if (error.name === 'ZodError') {
    statusCode = 400;
    message = 'Invalid request data';
    details = error.message;
  }
  // Handle multer errors
  else if (error.name === 'MulterError') {
    statusCode = 400;
    message = 'File upload error';
    details = error.message;
  }
  // Handle FFmpeg/processing errors
  else if (error.message.includes('FFmpeg')) {
    statusCode = 422;
    message = 'Media processing failed';
    details = error.message;
  }

  // Log error
  const logData = {
    error: {
      message: error.message,
      stack: error.stack,
      name: error.name,
    },
    request: {
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: req.body,
    },
    statusCode,
  };

  if (statusCode >= 500) {
    logger.error(logData, 'Server error');
  } else {
    logger.warn(logData, 'Client error');
  }

  // Send error response
  const errorResponse: ErrorResponse = {
    success: false,
    error: message,
    details: details,
    timestamp: new Date().toISOString(),
  };

  res.status(statusCode).json(errorResponse);
};

/**
 * Handle 404 errors
 */
export const notFoundHandler = (req: Request, res: Response): void => {
  const errorResponse: ErrorResponse = {
    success: false,
    error: 'Route not found',
    details: `${req.method} ${req.path} is not a valid endpoint`,
    timestamp: new Date().toISOString(),
  };

  res.status(404).json(errorResponse);
};

/**
 * Async error wrapper for route handlers
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
