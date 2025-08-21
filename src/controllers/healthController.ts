import { Request, Response } from 'express';
import config from '../config';
import { ApiResponse } from "../types/response.types";

export const getHealth = (_req: Request, res: Response): void => {
    const response: ApiResponse = {
        success: true,
        message: 'Service is healthy',
        data: {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            environment: config.nodeEnv,
            uptime: process.uptime(),
        },
    };

    res.json(response);
};
