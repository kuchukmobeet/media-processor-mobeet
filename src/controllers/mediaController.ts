import { Request, Response } from 'express';
import { MediaService } from '../services/mediaService';
import { AssetService } from '../services/assetService';
import { HealthResponse, ProcessRequest, ProcessResponse } from '../types/http';
import { mediaRequestSchema } from '../validators/media';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { loggers, logUtils } from '../utils/logger';

export class MediaController {
  private mediaService = new MediaService();
  private assetService = new AssetService();

  /**
   * Health check endpoint
   */
  health = asyncHandler(async (req: Request, res: Response) => {
    const dependencies = await this.mediaService.validateDependencies();

    const response: HealthResponse = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
    };

    if (!dependencies.ffmpeg) {
      loggers.controller.warn(
        { dependencies },
        'Health check failed - missing dependencies'
      );
      throw new AppError('Service dependencies not available', 503);
    }

    loggers.controller.info('Health check passed');
    res.json(response);
  });

  /**
   * Process media file
   */
  processMedia = asyncHandler(async (req: ProcessRequest, res: Response) => {
    // Check if file was uploaded
    if (!req.file) {
      throw new AppError('No file uploaded', 400);
    }

    // Parse and validate metadata
    let metadata;
    try {
      metadata = JSON.parse(req.body.metadata);
    } catch (error) {
      throw new AppError('Invalid metadata JSON', 400);
    }

    const validatedRequest = mediaRequestSchema.parse(metadata);

    loggers.controller.info(
      {
        file: {
          originalname: req.file.originalname,
          size: req.file.size,
          mimetype: req.file.mimetype,
        },
        request: validatedRequest,
      },
      'Processing media file'
    );

    // Process the media
    const result = await this.mediaService.processMedia(
      req.file.path,
      validatedRequest
    );
    const outputUrl = this.mediaService.getOutputUrl(result.outputPath);

    const response: ProcessResponse = {
      success: true,
      data: {
        outputUrl,
        processingTime: result.duration || 0,
        fileSize: result.size || 0,
      },
    };

    loggers.controller.info(
      {
        outputUrl,
        processingTime: result.duration,
        fileSize: result.size,
      },
      'Media processing completed'
    );

    res.json(response);
  });

  /**
   * List available stickers
   */
  listStickers = asyncHandler(async (req: Request, res: Response) => {
    const stickers = await this.assetService.listStickers();

    res.json({
      success: true,
      data: {
        stickers,
        count: stickers.length,
      },
    });
  });

  /**
   * List available fonts
   */
  listFonts = asyncHandler(async (req: Request, res: Response) => {
    const fonts = await this.assetService.listFonts();

    res.json({
      success: true,
      data: {
        fonts,
        count: fonts.length,
      },
    });
  });
}
