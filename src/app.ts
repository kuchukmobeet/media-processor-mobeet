import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import multer from 'multer';
import pino from 'pino';

import { config } from './config';
import { MediaController } from './controllers/mediaController';
import { requestLogger } from './middleware/requestLogger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

const logger = pino({ name: 'media-processor-app' });

async function createApp(): Promise<express.Application> {
  const app = express();

  // Security middleware
  app.use(helmet());
  app.use(cors());

  // Request parsing
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Logging
  app.use(requestLogger);

  // File upload configuration
  const upload = multer({
    dest: config.uploadsDir,
    limits: {
      fileSize: config.maxFileSize,
    },
    fileFilter: (_req, file, cb) => {
      // Accept common image and video formats
      const allowedMimes = [
        'image/jpeg',
        'image/png',
        'image/webp',
        'video/mp4',
        'video/quicktime',
        'video/x-msvideo', // .avi
        'video/webm',
      ];

      if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error(`Unsupported file type: ${file.mimetype}`));
      }
    },
  });

  // Static file serving for outputs
  app.use('/outputs', express.static(config.outputsDir, {
    maxAge: '7d', // Cache for 7 days
    etag: true,
  }));

  // Initialize controller
  const mediaController = new MediaController();

  // Routes
  app.get('/health', mediaController.health);
  app.post('/process', upload.single('file'), mediaController.processMedia);
  app.get('/stickers', mediaController.listStickers);
  app.get('/fonts', mediaController.listFonts);

  // 404 handler
  app.use(notFoundHandler);

  // Error handler (must be last)
  app.use(errorHandler);

  return app;
}

async function startServer(): Promise<void> {
  try {
    const app = await createApp();
    
    app.listen(config.port, () => {
      logger.info({
        port: config.port,
        environment: process.env.NODE_ENV || 'development',
        pid: process.pid,
        config: {
          uploadsDir: config.uploadsDir,
          outputsDir: config.outputsDir,
          assetsDir: config.assetsDir,
          videoEncoder: config.videoEncoder,
        },
      }, 'Media processor server started successfully');
    });

    // Graceful shutdown handling
    const gracefulShutdown = (signal: string) => {
      logger.info(`Received ${signal}, shutting down gracefully`);
      process.exit(0);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    process.on('unhandledRejection', (reason, promise) => {
      logger.error({ reason, promise }, 'Unhandled promise rejection');
      process.exit(1);
    });

    process.on('uncaughtException', (error) => {
      logger.error({ error }, 'Uncaught exception');
      process.exit(1);
    });

  } catch (error) {
    logger.error({ error }, 'Failed to start server');
    process.exit(1);
  }
}

// Only start server if this file is run directly
if (require.main === module) {
  startServer();
}

export { createApp };
