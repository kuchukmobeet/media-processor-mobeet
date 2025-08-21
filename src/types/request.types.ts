import { Request } from 'express';

export interface CompressMediaRequestBody {
    url: string;
}

export interface CompressMediaRequest extends Request {
    body: CompressMediaRequestBody;
}
