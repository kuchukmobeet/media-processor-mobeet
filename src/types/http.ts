import { Request } from 'express';

export interface ProcessRequest extends Request {
  file?: Express.Multer.File;
  body: {
    metadata: string;
  };
}

export interface CompressResponse {
  success: boolean;
  data?: {
    outputUrl: string;
    originalSize?: number;
    compressedSize: number;
    compressionRatio?: number;
    processingTime: number;
    mediaType: 'image' | 'video';
  };
  error?: string;
}

export interface ProcessResponse {
  success: boolean;
  data?: {
    outputUrl: string;
    processingTime: number;
    fileSize: number;
  };
  error?: string;
}

export interface HealthResponse {
  status: 'ok';
  timestamp: string;
  version: string;
}

export interface ErrorResponse {
  success: false;
  error: string;
  details?: string;
  timestamp: string;
}
