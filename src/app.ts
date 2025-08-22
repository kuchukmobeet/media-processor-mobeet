import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import config from './config';
import logger from './logger';
import './container';

// Import routes
import healthRoutes from './routes/health';
import mediaRoutes from './routes/media';
import jobRoutes from "./routes/job";

// Import middleware
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { ApiResponse } from "./types/response.types";

class App {
    public app: Application;

    constructor() {
        this.app = express();
        this.initializeMiddlewares();
        this.initializeRoutes();
        this.initializeErrorHandling();
    }

    private initializeMiddlewares(): void {
        // Security middleware
        this.app.use(helmet());
        this.app.use(cors(config.cors));

        // Request parsing
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

        // HTTP request logging
        this.app.use((req: Request, res: Response, next) => {
            logger.http(`${req.method} ${req.url} - ${req.ip}`);
            next();
        });
    }

    private initializeRoutes(): void {
        // Root route
        this.app.get('/', (req: Request, res: Response) => {
            const response: ApiResponse = {
                success: true,
                message: 'Mobeet Media Processor API is running!',
                data: {
                    version: config.api.version,
                    environment: config.nodeEnv,
                    timestamp: new Date().toISOString(),
                },
            };
            res.json(response);
        });

        // API routes
        this.app.use('/health', healthRoutes);
        this.app.use(`${config.api.prefix}/media`, mediaRoutes);
        this.app.use(`${config.api.prefix}/job`, jobRoutes);
    }

    private initializeErrorHandling(): void {
        this.app.use(notFoundHandler);
        this.app.use(errorHandler);
    }
}

export default new App().app;
//TODO organise stuff by moving in respective classes and utils