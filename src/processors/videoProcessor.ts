import path from 'node:path';
import { BaseProcessor } from './baseProcessor';
import { MediaRequest, ProcessingResult } from '../types/media';
import { config, mediaConfig, getCanvas } from '../config';

export class VideoProcessor extends BaseProcessor {
  async process(inputPath: string, outputPath: string, request: MediaRequest): Promise<ProcessingResult> {
    const startTime = Date.now();
    const canvas = getCanvas(request.post);
    
    // Build input arguments
    const stickerPaths = await this.assetService.resolveStickerPaths(
      request.stickers.map(s => s.name)
    );
    
    const inputArgs = [
      '-y', // Overwrite output
      '-f', 'lavfi',
      '-i', `color=size=${canvas.width}x${canvas.height}:rate=${mediaConfig.targetFps}:color=${request.background.color}`, // Canvas [0]
      '-i', inputPath, // Main content [1]
      ...stickerPaths.flatMap(path => [
        '-loop', '1',
        '-framerate', String(mediaConfig.targetFps),
        '-i', path
      ]), // Looped stickers [2...]
    ];

    // Build filter graph
    const filterChains: string[] = [];
    
    // Process main content
    const mainContentFilter = this.buildMainContentFilter(request, canvas);
    filterChains.push(mainContentFilter.filter);
    
    // Overlay main content on canvas (with shortest=1 to match video duration)
    const { content } = request;
    const x = content.position.x;
    const y = content.position.y;
    const canvasOverlayTag = 'canvas_with_content';
    filterChains.push(
      `[0:v][${mainContentFilter.outputTag}]overlay=${x}:${y}:format=auto:shortest=1[${canvasOverlayTag}]`
    );
    
    let currentOutputTag = canvasOverlayTag;
    
    // Process stickers if any
    const stickerFilters = await this.buildStickerFilters(
      request.stickers,
      canvas,
      2 // Stickers start at input index 2
    );
    filterChains.push(...stickerFilters.map(f => f.filter));
    
    // Process text overlays if any
    const textFilters = await this.buildTextFilters(request.textOverlays || [], canvas);
    filterChains.push(...textFilters.map(f => f.filter));
    
    // Build layer overlays (stickers + text in Z-order)
    if (stickerFilters.length || textFilters.length) {
      const layerOverlays = this.buildLayerOverlaysForVideo(
        request,
        canvas,
        currentOutputTag,
        stickerFilters.map(f => f.outputTag),
        textFilters.map(f => f.outputTag)
      );
      filterChains.push(...layerOverlays.map(f => f.filter));
      currentOutputTag = layerOverlays[layerOverlays.length - 1]?.outputTag || currentOutputTag;
    }
    
    // Lock to target FPS
    const finalOutputTag = 'final_output';
    filterChains.push(`[${currentOutputTag}]fps=${mediaConfig.targetFps}[${finalOutputTag}]`);
    
    // Try encoding with NVENC first, fallback to CPU
    const quality = Math.max(1, Math.min(100, request.output.quality));
    const success = await this.tryVideoEncoding(inputArgs, filterChains, finalOutputTag, quality, outputPath);
    
    if (!success) {
      throw new Error('All video encoding attempts failed');
    }
    
    // Get file stats
    const fs = await import('node:fs/promises');
    const stats = await fs.stat(outputPath);
    
    return {
      outputPath,
      duration: Date.now() - startTime,
      size: stats.size,
    };
  }

  /**
   * Build layer overlays for video with shortest=1 to match main video duration
   */
  private buildLayerOverlaysForVideo(
    request: MediaRequest,
    canvas: any,
    baseTag: string,
    stickerTags: string[],
    textTags: string[]
  ): Array<{ filter: string; outputTag: string }> {
    const baseOverlays = this.buildLayerOverlays(request, canvas, baseTag, stickerTags, textTags);
    
    // Modify each overlay to include shortest=1
    return baseOverlays.map((overlay, index) => ({
      ...overlay,
      filter: overlay.filter.replace(':format=auto', ':format=auto:shortest=1'),
    }));
  }

  /**
   * Try different encoding methods in order of preference
   */
  private async tryVideoEncoding(
    inputArgs: string[],
    filterChains: string[],
    outputTag: string,
    quality: number,
    outputPath: string
  ): Promise<boolean> {
    const baseArgs = [
      ...inputArgs,
      '-filter_complex', filterChains.join(';'),
      '-map', `[${outputTag}]`,
      '-map', '1:a?', // Include audio if present
      '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart',
      '-threads', '0',
      '-filter_threads', '2',
      '-shortest',
    ];

    // Calculate CRF values based on quality
    const crf = quality >= 90 ? 18 : quality >= 80 ? 20 : 23;
    const cq = quality >= 90 ? 19 : quality >= 80 ? 21 : 24;

    // Try NVENC if configured
    if (config.videoEncoder === 'nvenc') {
      try {
        await this.executeFFmpeg([
          ...baseArgs,
          '-c:v', 'h264_nvenc',
          '-preset', config.nvencPreset,
          '-rc', 'vbr',
          '-cq', String(cq),
          '-b:v', '0',
          '-c:a', 'copy',
          outputPath,
        ]);
        return true;
      } catch (error) {
        console.warn('NVENC encoding failed, trying CPU fallback:', error);
      }
    }

    // Try CPU encoding with libx264 + copy audio
    try {
      await this.executeFFmpeg([
        ...baseArgs,
        '-c:v', 'libx264',
        '-preset', config.x264Preset,
        '-crf', String(crf),
        '-c:a', 'copy',
        outputPath,
      ]);
      return true;
    } catch (error) {
      console.warn('libx264 with copy audio failed, trying with AAC:', error);
    }

    // Final fallback: CPU encoding with AAC audio
    try {
      await this.executeFFmpeg([
        ...baseArgs,
        '-c:v', 'libx264',
        '-preset', config.x264Preset,
        '-crf', String(crf),
        '-c:a', 'aac',
        '-b:a', '160k',
        outputPath,
      ]);
      return true;
    } catch (error) {
      console.error('Final fallback encoding failed:', error);
      return false;
    }
  }
}
