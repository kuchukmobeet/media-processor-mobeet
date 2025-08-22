import {Request} from 'express';

export interface CompressMediaRequestBody {
    url: string;
}

export interface CompressMediaRequest extends Request {
    body: CompressMediaRequestBody;
}

export interface GetJobStatusBody {
    ids: string[]
}

export interface GetJobStatusRequest extends Request {
    body: GetJobStatusBody
}

export interface CompressImageRequestBody {
    url: string;
    quality: number;      // 1-100, higher = better quality
    maxWidth?: number;    // Optional max width
    maxHeight?: number;   // Optional max height
}

export interface CompressImageRequest extends Request {
    body: CompressImageRequestBody;
}
