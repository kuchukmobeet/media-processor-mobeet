import dotenv from 'dotenv';

dotenv.config();
//TODO separate confi later
export const config = {
    port: process.env.PORT || 3000,
    nodeEnv: process.env.NODE_ENV || 'development',

    api: {
        version: 'v1',
        prefix: '/api',
    },

    cors: {
        origin: process.env.CORS_ORIGIN || '*',
        credentials: true,
    },

};

export default config;
