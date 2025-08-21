import { Request, Response, NextFunction } from 'express';
import config from '../config';
import {ApiResponse} from "../types/response.types";

export interface CustomError extends Error {
  statusCode?: number;
}

export const errorHandler = (
  err: CustomError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const statusCode = err.statusCode || 500;
  const isProduction = config.nodeEnv === 'production';

  // Log error
  console.error(`Error ${statusCode}:`, err.message);

  const response: ApiResponse = {
    success: false,
    message: isProduction && statusCode >= 500 
      ? 'Internal server error' 
      : err.message,
  };

  res.status(statusCode).json(response);
};

export const notFoundHandler = (req: Request, res: Response): void => {
  const response: ApiResponse = {
    success: false,
    message: `Route ${req.method} ${req.url} not found`,
  };
  
  res.status(404).json(response);
};
