import { execa } from 'execa';
import { MediaRequest, Canvas, Sticker, TextOverlay } from '../types/media';
import { AssetService } from '../services/assetService';
import { config, mediaConfig, getCanvas } from '../config';
import { clampFloat, toExpression, toPixels } from '../utils/geometry';
import { rgbaToFFmpegColor } from '../utils/color';

export abstract class BaseProcessor {
  protected assetService = new AssetService();

  /**
   * Execute FFmpeg command with timeout and error handling
   */
  protected async executeFFmpeg(args: string[]): Promise<void> {
    try {
      await execa('ffmpeg', args, {
        stdio: 'inherit',
        timeout: config.processingTimeout,
      });
    } catch (error) {
      throw new Error(`FFmpeg processing failed: ${(error as Error).message}`);
    }
  }

  /**
   * Build filter chain for main content transformations
   */
  protected buildMainContentFilter(
    request: MediaRequest,
    canvas: Canvas
  ): { filter: string; outputTag: string } {
    const { content, filters } = request;
    const steps: string[] = [];

    // Apply crop if specified
    if (content.crop?.width && content.crop.height) {
      const { x = 0, y = 0, width, height } = content.crop;
      steps.push(
        `crop=${Math.round(width)}:${Math.round(height)}:${Math.round(x)}:${Math.round(y)}`
      );
    }

    // Apply rotation if specified
    if (content.rotation && content.rotation !== 0) {
      const angle = (content.rotation * Math.PI) / 180;
      steps.push(`rotate=${angle}:ow=rotw(iw):oh=roth(ih)`);
    }

    // Apply scaling
    if (content.size?.width && content.size?.height) {
      steps.push(
        `scale=${Math.round(content.size.width)}:${Math.round(content.size.height)}:flags=bicubic`
      );
    } else {
      // Fit to canvas with aspect ratio
      steps.push(
        `scale=${canvas.width}:${canvas.height}:force_original_aspect_ratio=increase`
      );
      steps.push(`crop=${canvas.width}:${canvas.height}`);
    }

    // Apply custom filters if provided
    if (filters.ffmpeg?.trim()) {
      steps.push(filters.ffmpeg);
    }

    const outputTag = 'main_content';
    return {
      filter: `[1:v]${steps.join(',')}[${outputTag}]`,
      outputTag,
    };
  }

  /**
   * Build overlay filter for main content on canvas
   */
  protected buildCanvasOverlay(
    request: MediaRequest,
    canvas: Canvas,
    inputTag: string
  ): { filter: string; outputTag: string } {
    const { content } = request;
    const x = clampFloat(content.position.x, 0, canvas.width);
    const y = clampFloat(content.position.y, 0, canvas.height);

    const outputTag = 'canvas_with_content';
    return {
      filter: `[0:v][${inputTag}]overlay=${toExpression(x)}:${toExpression(y)}:format=auto[${outputTag}]`,
      outputTag,
    };
  }

  /**
   * Build sticker processing filters
   */
  protected async buildStickerFilters(
    stickers: Sticker[],
    canvas: Canvas,
    stickerInputOffset: number
  ): Promise<Array<{ filter: string; outputTag: string }>> {
    if (!stickers.length) return [];

    const filters: Array<{ filter: string; outputTag: string }> = [];

    for (let i = 0; i < stickers.length; i++) {
      const sticker = stickers[i];
      const inputIndex = stickerInputOffset + i;
      const steps: string[] = ['format=rgba'];

      // Scale sticker
      const hasSize = sticker.size?.width && sticker.size?.height;
      const width = hasSize
        ? Math.round(sticker.size!.width)
        : `iw*${sticker.scale}`;
      const height = hasSize
        ? Math.round(sticker.size!.height)
        : `ih*${sticker.scale}`;
      steps.push(`scale=${width}:${height}`);

      // Rotate sticker if needed
      if (sticker.rotation && sticker.rotation !== 0) {
        const angle = (sticker.rotation * Math.PI) / 180;
        steps.push(`rotate=${angle}:ow=rotw(iw):oh=roth(ih):c=black@0`);
      }

      // Apply opacity if needed
      if (sticker.opacity < 1 && sticker.opacity >= 0) {
        steps.push(`colorchannelmixer=aa=${sticker.opacity}`);
      }

      const outputTag = `sticker_${i}`;
      filters.push({
        filter: `[${inputIndex}:v]${steps.join(',')}[${outputTag}]`,
        outputTag,
      });
    }

    return filters;
  }

  /**
   * Build text overlay filters
   */
  protected async buildTextFilters(
    textOverlays: TextOverlay[],
    canvas: Canvas
  ): Promise<Array<{ filter: string; outputTag: string }>> {
    if (!textOverlays.length) return [];

    const filters: Array<{ filter: string; outputTag: string }> = [];

    for (let i = 0; i < textOverlays.length; i++) {
      const text = textOverlays[i];
      const canvasTag = `text_canvas_${i}`;
      const textTag = `text_${i}`;

      // Create text canvas
      const pixelX = clampFloat(
        toPixels(text.x, canvas.width),
        0,
        canvas.width
      );
      const pixelY = clampFloat(
        toPixels(text.y, canvas.height),
        0,
        canvas.height
      );
      const boxWidth = Math.max(
        1,
        Math.round(toPixels(text.width, canvas.width))
      );
      const boxHeight = Math.max(
        1,
        Math.round(toPixels(text.height, canvas.height))
      );

      filters.push({
        filter: `color=c=black@0:s=${boxWidth}x${boxHeight}:r=${mediaConfig.targetFps} [${canvasTag}]`,
        outputTag: canvasTag,
      });

      // Add text to canvas
      const fontPath = await this.assetService.resolveFontPath(
        text.fontFamily,
        text.fontWeight
      );
      const fontColor = rgbaToFFmpegColor(text.color);
      const fontSize = this.calculateFontSize(boxWidth, canvas.height);

      const escapedfontPath = this.escapePath(fontPath);
      const escapedText = this.escapeText(text.text);

      let drawTextFilter =
        `drawtext=fontfile='${escapedfontPath}'` +
        `:text='${escapedText}'` +
        `:fontsize=${fontSize}` +
        `:fontcolor=${fontColor}` +
        `:x=(w-text_w)/2` +
        `:y=(h-text_h)/2`;

      // Add background box if specified
      if (text.backgroundColor) {
        const boxColor = rgbaToFFmpegColor(text.backgroundColor);
        drawTextFilter += `:box=1:boxcolor=${boxColor}:boxborderw=${mediaConfig.textPadding}`;
      }

      const outputTag = text.rotation ? `text_rotated_${i}` : textTag;

      filters.push({
        filter: `[${canvasTag}]${drawTextFilter}[${textTag}]`,
        outputTag: textTag,
      });

      // Apply rotation if needed
      if (text.rotation && text.rotation !== 0) {
        const angle = (text.rotation * Math.PI) / 180;
        filters.push({
          filter: `[${textTag}]rotate=${angle}:ow=rotw(iw):oh=roth(ih):c=black@0[${outputTag}]`,
          outputTag,
        });
      }
    }

    return filters;
  }

  /**
   * Build overlay filters for layers (stickers + text) in Z-order
   */
  protected buildLayerOverlays(
    request: MediaRequest,
    canvas: Canvas,
    baseTag: string,
    stickerTags: string[],
    textTags: string[]
  ): Array<{ filter: string; outputTag: string }> {
    // Combine stickers and text with their Z-indices
    type Layer =
      | { type: 'sticker'; z: number; tag: string; data: Sticker }
      | { type: 'text'; z: number; tag: string; data: TextOverlay };

    const layers: Layer[] = [
      ...request.stickers.map((sticker, i) => ({
        type: 'sticker' as const,
        z: sticker.z,
        tag: stickerTags[i],
        data: sticker,
      })),
      ...(request.textOverlays || []).map((text, i) => ({
        type: 'text' as const,
        z: text.z,
        tag: textTags[i],
        data: text,
      })),
    ];

    // Sort by Z-index (lower values rendered first)
    layers.sort((a, b) => a.z - b.z);

    const overlays: Array<{ filter: string; outputTag: string }> = [];
    let currentBase = baseTag;

    for (let i = 0; i < layers.length; i++) {
      const layer = layers[i];
      const outputTag = `layer_${i}`;

      let x: number, y: number;

      if (layer.type === 'sticker') {
        x = clampFloat(layer.data.position.x, 0, canvas.width);
        y = clampFloat(layer.data.position.y, 0, canvas.height);
      } else {
        x = clampFloat(toPixels(layer.data.x, canvas.width), 0, canvas.width);
        y = clampFloat(toPixels(layer.data.y, canvas.height), 0, canvas.height);
      }

      overlays.push({
        filter: `[${currentBase}][${layer.tag}]overlay=${toExpression(x)}:${toExpression(y)}:format=auto[${outputTag}]`,
        outputTag,
      });

      currentBase = outputTag;
    }

    return overlays;
  }

  /**
   * Calculate appropriate font size based on box dimensions
   */
  private calculateFontSize(boxWidth: number, canvasHeight: number): number {
    const baseBoxWidth = 400;
    const baseBoxHeight = 200;
    const baseFontSize = 24;

    const scaleFactor = Math.min(
      boxWidth / baseBoxWidth,
      canvasHeight / baseBoxHeight
    );

    return Math.max(8, Math.floor(baseFontSize * scaleFactor));
  }

  /**
   * Escape text for FFmpeg drawtext filter
   */
  private escapeText(text: string): string {
    return text
      .replace(/\\/g, '\\\\')
      .replace(/%/g, '\\%')
      .replace(/:/g, '\\:')
      .replace(/'/g, "'\\\\''")
      .replace(/<br\s*\/?>/gi, '\\n');
  }

  /**
   * Escape file path for FFmpeg
   */
  private escapePath(filePath: string): string {
    return filePath
      .replace(/\\/g, '\\\\')
      .replace(/:/g, '\\:')
      .replace(/'/g, "\\'");
  }
}
