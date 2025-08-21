import 'reflect-metadata'; //MUST BE FIRST IMPORTTTTT!!!!!!
import app from './app';
import config from './config';
import logger from './logger';

const server = app.listen(config.port, () => {
    logger.info('🚀 Mobeet Media Processor Server is running!');
    logger.info(`🌐 Server: http://localhost:${config.port}`);
    logger.info(`📊 Health: http://localhost:${config.port}/health`);
    logger.info(`📚 API: http://localhost:${config.port}${config.api.prefix}`);
});

// Graceful shutdown
const gracefulShutdown = (signal: string) => {
    logger.warn(`${signal} received. Shutting down...`);
    server.close(() => {
        logger.info('✅ Server closed');
        process.exit(0);
    });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
