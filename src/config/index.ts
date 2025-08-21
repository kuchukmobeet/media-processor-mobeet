import path from 'node:path';
import { Canvas } from '../types/media';

export interface AppConfig {
  port: number;
  uploadsDir: string;
  outputsDir: string;
  assetsDir: string;
  videoEncoder: 'nvenc' | 'cpu';
  nvencPreset: string;
  x264Preset: string;
  maxFileSize: number;
  processingTimeout: number;
}

export interface MediaConfig {
  canvasReel: Canvas;
  canvasPost: Canvas;
  targetFps: number;
  textPadding: number;
}

// Load configuration from environment variables
export const config: AppConfig = {
  port: parseInt(process.env.PORT || '8000', 10),
  uploadsDir: process.env.MEDIA_UPLOAD_DIR || 'uploads',
  outputsDir: process.env.MEDIA_OUTPUT_DIR || 'outputs',
  assetsDir: process.env.MEDIA_ASSETS_DIR || 'assets',
  videoEncoder: (process.env.VIDEO_ENCODER === 'nvenc' ? 'nvenc' : 'cpu') as 'nvenc' | 'cpu',
  nvencPreset: process.env.NVENC_PRESET || 'p5',
  x264Preset: process.env.X264_PRESET || 'medium',
  maxFileSize: 500 * 1024 * 1024, // 500MB
  processingTimeout: 10 * 60 * 1000, // 10 minutes
};

export const mediaConfig: MediaConfig = {
  canvasReel: { width: 1080, height: 1920 }, // 9:16
  canvasPost: { width: 1080, height: 1350 }, // 4:5
  targetFps: 60,
  textPadding: parseInt(process.env.TEXT_BOX_PADDING_PX || '28', 10),
};

/**
 * Get canvas dimensions based on post type
 */
export const getCanvas = (isPost: boolean): Canvas => {
  return isPost ? mediaConfig.canvasPost : mediaConfig.canvasReel;
};

/**
 * Get asset paths
 */
export const getAssetPaths = () => ({
  stickers: path.join(config.assetsDir, 'stickers'),
  fonts: path.join(config.assetsDir, 'fonts'),
  luts: path.join(config.assetsDir, 'luts'),
});
