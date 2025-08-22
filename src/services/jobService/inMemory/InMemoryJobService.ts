import {IJobService} from "../IJobService";
import {inject, injectable} from "tsyringe";
import {getLogger} from "../../../logger";
import {CompressImageReqJobData, CompressMediaReqJobData, JobDataBase, JobState, JobProgressEvent} from "../../../types/jobService.types";
import {IMediaService} from "../../mediaService/IMediaService";
import {FFMPEG_SERVICE, MEDIA_SERVICE} from "../../../consts/DependencyConstants";
import * as path from 'path';
import {IFFmpegService} from "../../FFmpegService/IFFmpegService";
import {ensureDirectoryExists, fileExists, getFileSize, streamToFile} from "../../../utils/file.util";
import {formatFileSize, sanitizeFilename} from "../../../utils/media.util";
import {EventEmitter} from "node:events";

@injectable()
export default class InMemoryJobService implements IJobService {
    private readonly log = getLogger(InMemoryJobService.name);
    private jobState: Map<string, JobState> = new Map();

    private jobProcessorMap = new Map<string, (state: JobState) => Promise<void>>([
        [CompressMediaReqJobData.name, this.handleCompressMediaRequest.bind(this)],
        [CompressImageReqJobData.name, this.handleCompressImageRequest.bind(this)],
    ]);

    constructor(
        @inject(MEDIA_SERVICE) private mediaService: IMediaService,
        @inject(FFMPEG_SERVICE) private ffmpegService: IFFmpegService
    ) {
    }

    addJob(jobData: JobDataBase): string {
        const uid = crypto.randomUUID();
        const progressStream = new EventEmitter();

        const jobState: JobState = {
            jobData: jobData,
            state: 'QUEUED',
            progressStream: progressStream,
            startTime: Date.now()
        };

        this.jobState.set(uid, jobState);

        // Emit initial progress event
        this.emitProgress(jobState, 'QUEUE', 'Job queued for processing');

        this.processJobAsync(uid).then(() => {
        });
        return uid;
    }

    getJobStatusByIds(ids: string[]): Map<string, string> {
        this.log.info(`Get job status by ids ${ids}`);
        const jobStatusMap: Map<string, string> = new Map();
        ids.forEach(value => {
            const state = this.jobState.get(value);
            if (state) {
                jobStatusMap.set(value, state.state);
            }
        })
        return jobStatusMap;
    }

    getJobProgressStream(jobId: string): EventEmitter | null {
        const jobState = this.jobState.get(jobId);
        return jobState ? jobState.progressStream : null;
    }

    cleanupJobStream(jobId: string): void {
        const jobState = this.jobState.get(jobId);
        if (jobState) {
            // Remove all listeners to prevent memory leaks
            jobState.progressStream.removeAllListeners();

            // If job is completed, remove from map
            if (jobState.state === 'COMPLETED' || jobState.state === 'FAILED') {
                this.jobState.delete(jobId);
                this.log.info(`Cleaned up job ${jobId}`);
            }
        }
    }

    private emitProgress(jobState: JobState, phase: string, message: string, data?: any): void {
        const event: JobProgressEvent = {
            timestamp: Date.now(),
            phase,
            message,
            data
        };

        // Update state string for HTTP polling compatibility
        jobState.state = `[${phase}] ${message}`;

        // Emit to stream for SSE clients
        jobState.progressStream.emit('progress', event);
    }

    private async processJobAsync(jobId: string): Promise<void> {
        const jobState = this.jobState.get(jobId);
        if (!jobState) {
            this.log.warn(`Failed to find job with ID ${jobId}`);
            return;
        }

        const processor = this.jobProcessorMap.get(jobState.jobData.constructor.name);
        if (processor) {
            this.emitProgress(jobState, 'PROCESSING', 'Job started');
            try {
                await processor(jobState);
                this.emitProgress(jobState, 'COMPLETED', 'Job completed successfully');
                jobState.state = "COMPLETED";
            } catch (error: any) {
                this.log.error(`Job ${jobId} failed:`, error);
                this.emitProgress(jobState, 'FAILED', `Job failed: ${error.message}`);
                jobState.state = "FAILED";
            }
        } else {
            this.log.warn(`No processor found for job data ${JSON.stringify(jobState.jobData)}`);
            this.emitProgress(jobState, 'FAILED', 'No processor found for job type');
            jobState.state = "FAILED";
        }
    }

    private async handleCompressMediaRequest(state: JobState): Promise<void> {
        const jobData = state.jobData as CompressMediaReqJobData;
        this.log.info(`Starting compress media request job for URL: ${jobData.payload}`);

        try {
            const downloadDir = "./temp";
            await ensureDirectoryExists(downloadDir);

            // Variables to track the final file path for FFmpeg input
            let finalFilePath: string;
            let finalFileName: string;

            // ========== DOWNLOAD PHASE ==========
            this.emitProgress(state, 'DOWNLOAD', `Starting download from URL: ${jobData.payload}`);

            // Always fetch metadata to get the actual filename
            const result = await this.mediaService.downloadMediaFromUrl(jobData.payload);

            this.emitProgress(state, 'DOWNLOAD', `Fetched media metadata: ${result.filename}${result.extension}`);

            // Use the actual filename and extension from the media service
            finalFileName = sanitizeFilename(`${result.filename}${result.extension}`);
            finalFilePath = path.join(downloadDir, finalFileName);

            // Check if file already exists
            if (await fileExists(finalFilePath)) {
                this.emitProgress(state, 'DOWNLOAD', `File already exists, skipping download: ${finalFileName}`);
                this.log.info(`Skipping download - file already exists: ${finalFilePath}`);
            } else {
                // Download with progress tracking
                await this.downloadWithProgress(result.stream, finalFilePath, state);
                this.emitProgress(state, 'DOWNLOAD', `Successfully downloaded: ${finalFileName}`);
                this.log.info(`Media downloaded successfully: ${finalFilePath}`);
            }

            // ========== FFMPEG COMPRESSION PHASE ==========
            this.log.info(`[FFMPEG] Starting Compression of: ${finalFilePath}`);
            this.emitProgress(state, 'FFMPEG', 'Starting compression');

            // Ensure output directory exists
            const outputDir = "./output/compressed";
            await ensureDirectoryExists(outputDir);

            // Create output filename with compressed prefix
            const nameWithoutExt = path.parse(finalFileName).name;
            const originalExt = path.parse(finalFileName).ext;
            const compressedFileName = `compressed_${nameWithoutExt}${originalExt}`;
            const finalOutputPath = path.join(outputDir, compressedFileName);

            // Check if compressed file already exists
            if (await fileExists(finalOutputPath)) {
                this.emitProgress(state, 'FFMPEG', `Compressed file already exists: ${compressedFileName}`);
                this.log.info(`Skipping compression - file already exists: ${finalOutputPath}`);
                return;
            }

            // Verify input file exists before compression
            if (!await fileExists(finalFilePath)) {
                throw new Error(`Input file not found for compression: ${finalFilePath}`);
            }

            // Start compression and get child process
            const cp = this.ffmpegService.compressVideo(finalFilePath, finalOutputPath, 500);

            // Listen to child process output and update progress stream
            await new Promise<void>((resolve, reject) => {
                // Listen to stdout (standard output)
                cp.stdout?.on('data', (data: Buffer) => {
                    const output = data.toString().trim();
                    if (output) {
                        this.emitProgress(state, 'FFMPEG', output);
                        this.log.info(`[FFMPEG stdout] ${output}`);
                    }
                });

                // Listen to stderr (FFmpeg progress info)
                cp.stderr?.on('data', (data: Buffer) => {
                    const output = data.toString().trim();

                    // Parse FFmpeg progress output
                    if (output.includes('time=')) {
                        // Extract time and speed information
                        const timeMatch = output.match(/time=(\S+)/);
                        const speedMatch = output.match(/speed=(\S+)/);

                        if (timeMatch && speedMatch) {
                            this.emitProgress(state, 'FFMPEG', `Processing... Time: ${timeMatch[1]}, Speed: ${speedMatch[1]}`);
                        } else {
                            this.emitProgress(state, 'FFMPEG', output);
                        }
                    } else if (output.includes('frame=')) {
                        // Extract frame information
                        const frameMatch = output.match(/frame=\s*(\d+)/);
                        if (frameMatch) {
                            this.emitProgress(state, 'FFMPEG', `Processing frame ${frameMatch[1]}...`);
                        } else {
                            this.emitProgress(state, 'FFMPEG', output);
                        }
                    } else {
                        this.emitProgress(state, 'FFMPEG', output);
                    }

                    this.log.info(`[FFMPEG] ${output}`);
                });

                // Handle process completion
                cp.on('close', (code: number) => {
                    if (code === 0) {
                        this.emitProgress(state, 'FFMPEG', 'Compression completed successfully');
                        this.log.info(`[FFMPEG] Process completed with code: ${code}`);
                        resolve();
                    } else {
                        const errorMsg = `FFmpeg process failed with code: ${code}`;
                        this.emitProgress(state, 'FFMPEG', errorMsg);
                        this.log.error(`[FFMPEG] ${errorMsg}`);
                        reject(new Error(errorMsg));
                    }
                });

                // Handle process exit
                cp.on('exit', (code: number, signal: string) => {
                    this.log.info(`[FFMPEG] Process exited with code: ${code}, signal: ${signal}`);
                    if (code !== 0 && code !== null) {
                        const errorMsg = `FFmpeg exited with code: ${code}`;
                        this.emitProgress(state, 'FFMPEG', errorMsg);
                        reject(new Error(errorMsg));
                    }
                });

                // Handle process errors
                cp.on('error', (error: Error) => {
                    this.emitProgress(state, 'FFMPEG', `Process error: ${error.message}`);
                    this.log.error(`[FFMPEG] Process error:`, error);
                    reject(error);
                });

                // Optional: Handle process spawn event
                cp.on('spawn', () => {
                    this.emitProgress(state, 'FFMPEG', 'Process spawned successfully');
                    this.log.info(`[FFMPEG] Process spawned, PID: ${cp.pid}`);
                });
            });

            // Verify output file exists and get size info
            if (await fileExists(finalOutputPath)) {
                const originalSize = await getFileSize(finalFilePath);
                const compressedSize = await getFileSize(finalOutputPath);
                const compressionRatio = ((originalSize - compressedSize) / originalSize * 100).toFixed(2);

                this.emitProgress(state, 'FFMPEG', `Compression complete! Reduced from ${formatFileSize(originalSize)} to ${formatFileSize(compressedSize)} (${compressionRatio}% reduction)`);
                this.log.info(`[FFMPEG] Final result: ${finalOutputPath}`);
                this.log.info(`[FFMPEG] Size reduction: ${formatFileSize(originalSize)} → ${formatFileSize(compressedSize)} (${compressionRatio}% smaller)`);
            } else {
                throw new Error('[FFMPEG] Compression completed but output file not found');
            }

        } catch (error: any) {
            this.log.error('Media compression job failed:', error);
            this.emitProgress(state, 'ERROR', `Failed: ${error.message}`);
            throw error;
        }
    }

    private async handleCompressImageRequest(state: JobState): Promise<void> {
        const jobData = state.jobData as CompressImageReqJobData;
        this.log.info(`Starting compress image request job for URL: ${jobData.payload}`);

        try {
            const downloadDir = "./temp";
            await ensureDirectoryExists(downloadDir);

            let finalFilePath: string;
            let finalFileName: string;

            // ========== DOWNLOAD PHASE ==========
            this.emitProgress(state, 'DOWNLOAD', `Starting download from URL: ${jobData.payload}`);

            const result = await this.mediaService.downloadMediaFromUrl(jobData.payload);
            this.emitProgress(state, 'DOWNLOAD', `Fetched image metadata: ${result.filename}${result.extension}`);

            finalFileName = sanitizeFilename(`${result.filename}${result.extension}`);
            finalFilePath = path.join(downloadDir, finalFileName);

            if (await fileExists(finalFilePath)) {
                this.emitProgress(state, 'DOWNLOAD', `File already exists, skipping download: ${finalFileName}`);
                this.log.info(`Skipping download - file already exists: ${finalFilePath}`);
            } else {
                await this.downloadWithProgress(result.stream, finalFilePath, state);
                this.emitProgress(state, 'DOWNLOAD', `Successfully downloaded: ${finalFileName}`);
                this.log.info(`Image downloaded successfully: ${finalFilePath}`);
            }

            // ========== FFMPEG IMAGE COMPRESSION PHASE ==========
            this.log.info(`[FFMPEG] Starting Image Compression of: ${finalFilePath}`);
            this.emitProgress(state, 'FFMPEG', 'Starting image compression');

            const outputDir = "./output/compressed";
            await ensureDirectoryExists(outputDir);

            const nameWithoutExt = path.parse(finalFileName).name;
            const originalExt = path.parse(finalFileName).ext;
            const compressedFileName = `compressed_${nameWithoutExt}${originalExt}`;
            const finalOutputPath = path.join(outputDir, compressedFileName);

            if (await fileExists(finalOutputPath)) {
                this.emitProgress(state, 'FFMPEG', `Compressed image already exists: ${compressedFileName}`);
                this.log.info(`Skipping compression - file already exists: ${finalOutputPath}`);
                return;
            }

            if (!await fileExists(finalFilePath)) {
                throw new Error(`Input file not found for compression: ${finalFilePath}`);
            }

            const cp = this.ffmpegService.compressImage(
                finalFilePath,
                finalOutputPath,
                jobData.options.quality,
                jobData.options.maxWidth,
                jobData.options.maxHeight
            );

            await new Promise<void>((resolve, reject) => {
                cp.stdout?.on('data', (data: Buffer) => {
                    const output = data.toString().trim();
                    if (output) {
                        this.emitProgress(state, 'FFMPEG', output);
                        this.log.info(`[FFMPEG stdout] ${output}`);
                    }
                });

                cp.stderr?.on('data', (data: Buffer) => {
                    const output = data.toString().trim();
                    this.emitProgress(state, 'FFMPEG', output);
                    this.log.info(`[FFMPEG] ${output}`);
                });

                cp.on('close', (code: number) => {
                    if (code === 0) {
                        this.emitProgress(state, 'FFMPEG', 'Image compression completed successfully');
                        this.log.info(`[FFMPEG] Process completed with code: ${code}`);
                        resolve();
                    } else {
                        const errorMsg = `FFmpeg image process failed with code: ${code}`;
                        this.emitProgress(state, 'FFMPEG', errorMsg);
                        this.log.error(`[FFMPEG] ${errorMsg}`);
                        reject(new Error(errorMsg));
                    }
                });

                cp.on('exit', (code: number, signal: string) => {
                    this.log.info(`[FFMPEG] Process exited with code: ${code}, signal: ${signal}`);
                    if (code !== 0 && code !== null) {
                        const errorMsg = `FFmpeg exited with code: ${code}`;
                        this.emitProgress(state, 'FFMPEG', errorMsg);
                        reject(new Error(errorMsg));
                    }
                });

                cp.on('error', (error: Error) => {
                    this.emitProgress(state, 'FFMPEG', `Process error: ${error.message}`);
                    this.log.error(`[FFMPEG] Process error:`, error);
                    reject(error);
                });

                cp.on('spawn', () => {
                    this.emitProgress(state, 'FFMPEG', 'Image process spawned successfully');
                    this.log.info(`[FFMPEG] Process spawned, PID: ${cp.pid}`);
                });
            });

            if (await fileExists(finalOutputPath)) {
                const originalSize = await getFileSize(finalFilePath);
                const compressedSize = await getFileSize(finalOutputPath);
                const compressionRatio = ((originalSize - compressedSize) / originalSize * 100).toFixed(2);

                this.emitProgress(state, 'FFMPEG', `Image compression complete! Reduced from ${formatFileSize(originalSize)} to ${formatFileSize(compressedSize)} (${compressionRatio}% reduction)`);
                this.log.info(`[FFMPEG] Final result: ${finalOutputPath}`);
                this.log.info(`[FFMPEG] Size reduction: ${formatFileSize(originalSize)} → ${formatFileSize(compressedSize)} (${compressionRatio}% smaller)`);
            } else {
                throw new Error('[FFMPEG] Image compression completed but output file not found');
            }

        } catch (error: any) {
            this.log.error('Image compression job failed:', error);
            this.emitProgress(state, 'ERROR', `Failed: ${error.message}`);
            throw error;
        }
    }

    private async downloadWithProgress(stream: NodeJS.ReadableStream, filePath: string, jobState: JobState): Promise<void> {
        return new Promise((resolve, reject) => {
            let downloadedBytes = 0;
            let totalSize: number | undefined;
            const startTime = Date.now();

            // Try to get content length from the stream if it's available
            const httpStream = stream as any;
            if (httpStream.response?.headers?.['content-length']) {
                totalSize = parseInt(httpStream.response.headers['content-length'], 10);
                this.emitProgress(jobState, 'DOWNLOAD', `Starting ${formatFileSize(totalSize)} download`);
            } else {
                this.emitProgress(jobState, 'DOWNLOAD', 'Starting download (size unknown)');
            }

            const writeStream = require('fs').createWriteStream(filePath);

            stream.on('data', (chunk: Buffer) => {
                downloadedBytes += chunk.length;
                const elapsed = (Date.now() - startTime) / 1000;
                const speed = downloadedBytes / elapsed; // bytes/sec

                if (totalSize) {
                    const percent = (downloadedBytes / totalSize * 100).toFixed(1);
                    this.emitProgress(jobState, 'DOWNLOAD', `${percent}% - ${formatFileSize(downloadedBytes)}/${formatFileSize(totalSize)} at ${formatFileSize(speed)}/s`);
                } else {
                    this.emitProgress(jobState, 'DOWNLOAD', `${formatFileSize(downloadedBytes)} at ${formatFileSize(speed)}/s`);
                }
            });

            stream.on('end', () => {
                const elapsed = (Date.now() - startTime) / 1000;
                const avgSpeed = downloadedBytes / elapsed;
                this.emitProgress(jobState, 'DOWNLOAD', `Download completed: ${formatFileSize(downloadedBytes)} in ${elapsed.toFixed(1)}s (avg ${formatFileSize(avgSpeed)}/s)`);
                resolve();
            });

            stream.on('error', (error) => {
                this.emitProgress(jobState, 'DOWNLOAD', `Download failed: ${error.message}`);
                reject(error);
            });

            writeStream.on('error', (error: Error) => {
                this.emitProgress(jobState, 'DOWNLOAD', `Write failed: ${error.message}`);
                reject(error);
            });

            stream.pipe(writeStream);
        });
    }
}