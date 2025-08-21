import path from 'node:path';
import { MediaRequest, ProcessingResult } from '../types/media';
import { ImageProcessor } from '../processors/imageProcessor';
import { VideoProcessor } from '../processors/videoProcessor';
import { config } from '../config';
import { generateUniqueFilename, ensureDirectory, deleteFile } from '../utils/file';

export class MediaService {
  private imageProcessor = new ImageProcessor();
  private videoProcessor = new VideoProcessor();

  constructor() {
    // Ensure output directory exists
    this.initializeDirectories();
  }

  /**
   * Process media file according to the request parameters
   */
  async processMedia(inputPath: string, request: MediaRequest): Promise<ProcessingResult> {
    // Generate unique output filename
    const extension = request.mediaType === 'video' ? '.mp4' : '.jpg';
    const outputFileName = generateUniqueFilename(
      path.basename(inputPath), 
      extension
    );
    const outputPath = path.join(config.outputsDir, outputFileName);

    try {
      let result: ProcessingResult;

      if (request.mediaType === 'video') {
        result = await this.videoProcessor.process(inputPath, outputPath, request);
      } else {
        result = await this.imageProcessor.process(inputPath, outputPath, request);
      }

      return result;
    } catch (error) {
      // Clean up output file if processing failed
      await deleteFile(outputPath);
      throw error;
    } finally {
      // Always clean up input file
      await deleteFile(inputPath);
    }
  }

  /**
   * Get the public URL for a processed file
   */
  getOutputUrl(outputPath: string): string {
    const filename = path.basename(outputPath);
    return `/outputs/${filename}`;
  }

  /**
   * Initialize required directories
   */
  private async initializeDirectories(): Promise<void> {
    try {
      await Promise.all([
        ensureDirectory(config.uploadsDir),
        ensureDirectory(config.outputsDir),
        ensureDirectory(path.join(config.assetsDir, 'stickers')),
        ensureDirectory(path.join(config.assetsDir, 'fonts')),
        ensureDirectory(path.join(config.assetsDir, 'luts')),
      ]);
    } catch (error) {
      console.error('Failed to initialize directories:', error);
      throw new Error('Failed to initialize storage directories');
    }
  }

  /**
   * Validate that required external dependencies are available
   */
  async validateDependencies(): Promise<{ ffmpeg: boolean; issues: string[] }> {
    const issues: string[] = [];
    let ffmpegAvailable = false;

    // Check FFmpeg
    try {
      const { execa } = await import('execa');
      await execa('ffmpeg', ['-version'], { timeout: 5000 });
      ffmpegAvailable = true;
    } catch (error) {
      issues.push('FFmpeg is not available in PATH');
    }

    return {
      ffmpeg: ffmpegAvailable,
      issues,
    };
  }
}
