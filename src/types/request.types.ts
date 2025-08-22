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