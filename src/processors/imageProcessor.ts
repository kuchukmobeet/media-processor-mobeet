import path from 'node:path';
import { BaseProcessor } from './baseProcessor';
import { MediaRequest, ProcessingResult } from '../types/media';
import { getCanvas } from '../config';

export class ImageProcessor extends BaseProcessor {
  async process(
    inputPath: string,
    outputPath: string,
    request: MediaRequest
  ): Promise<ProcessingResult> {
    const startTime = Date.now();
    const canvas = getCanvas(request.post);

    // Build input arguments
    const stickerPaths = await this.assetService.resolveStickerPaths(
      request.stickers.map(s => s.name)
    );

    const inputArgs = [
      '-y', // Overwrite output
      '-f',
      'lavfi',
      '-i',
      `color=size=${canvas.width}x${canvas.height}:color=${request.background.color}`, // Canvas [0]
      '-i',
      inputPath, // Main content [1]
      ...stickerPaths.flatMap(path => ['-i', path]), // Stickers [2...]
    ];

    // Build filter graph
    const filterChains: string[] = [];

    // Process main content
    const mainContentFilter = this.buildMainContentFilter(request, canvas);
    filterChains.push(mainContentFilter.filter);

    // Overlay main content on canvas
    const canvasOverlay = this.buildCanvasOverlay(
      request,
      canvas,
      mainContentFilter.outputTag
    );
    filterChains.push(canvasOverlay.filter);

    let currentOutputTag = canvasOverlay.outputTag;

    // Process stickers if any
    const stickerFilters = await this.buildStickerFilters(
      request.stickers,
      canvas,
      2 // Stickers start at input index 2
    );
    filterChains.push(...stickerFilters.map(f => f.filter));

    // Process text overlays if any
    const textFilters = await this.buildTextFilters(
      request.textOverlays || [],
      canvas
    );
    filterChains.push(...textFilters.map(f => f.filter));

    // Build layer overlays (stickers + text in Z-order)
    if (stickerFilters.length || textFilters.length) {
      const layerOverlays = this.buildLayerOverlays(
        request,
        canvas,
        currentOutputTag,
        stickerFilters.map(f => f.outputTag),
        textFilters.map(f => f.outputTag)
      );
      filterChains.push(...layerOverlays.map(f => f.filter));
      currentOutputTag =
        layerOverlays[layerOverlays.length - 1]?.outputTag || currentOutputTag;
    }

    // Build final FFmpeg command
    const quality = Math.max(1, Math.min(100, request.output.quality));
    const mjpegQuality = Math.round((100 - Math.min(99, quality)) / 3) + 2;

    const ffmpegArgs = [
      ...inputArgs,
      '-filter_complex',
      filterChains.join(';'),
      '-map',
      `[${currentOutputTag}]`,
      '-frames:v',
      '1', // Single frame for image
      '-q:v',
      String(mjpegQuality),
      outputPath,
    ];

    // Execute FFmpeg
    await this.executeFFmpeg(ffmpegArgs);

    // Get file stats
    const fs = await import('node:fs/promises');
    const stats = await fs.stat(outputPath);

    return {
      outputPath,
      duration: Date.now() - startTime,
      size: stats.size,
    };
  }
}
