import {IJobService} from "../IJobService";
import {inject, injectable} from "tsyringe";
import {getLogger} from "../../../logger";
import {CompressImageReqJobData, CompressMediaReqJobData, JobDataBase, JobState} from "../../../types/jobService.types";
import {IMediaService} from "../../mediaService/IMediaService";
import {FFMPEG_SERVICE, MEDIA_SERVICE} from "../../../consts/DependencyConstants";
import * as path from 'path';
import {IFFmpegService} from "../../FFmpegService/IFFmpegService";
import {ensureDirectoryExists, fileExists, getFileSize, streamToFile} from "../../../utils/file.util";
import {formatFileSize, sanitizeFilename} from "../../../utils/media.util";

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
        this.jobState.set(uid, {jobData: jobData, state: 'QUEUED'});
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

    private async processJobAsync(jobId: string): Promise<void> {
        const jobState = this.jobState.get(jobId);
        if (!jobState) {
            this.log.warn(`Failed to find job with ID ${jobId}`);
            return;
        }

        const processor = this.jobProcessorMap.get(jobState.jobData.constructor.name);
        if (processor) {
            jobState.state = "STARTED";
            try {
                await processor(jobState);
                jobState.state = "COMPLETED";
            } catch (error) {
                this.log.error(`Job ${jobId} failed:`, error);
                jobState.state = "FAILED";
            }
        } else {
            this.log.warn(`No processor found for job data ${JSON.stringify(jobState.jobData)}`);
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
            state.state = `[DOWNLOAD] Starting download from URL: ${jobData.payload}`;

            // Always fetch metadata to get the actual filename
            const result = await this.mediaService.downloadMediaFromUrl(jobData.payload);

            state.state = `[DOWNLOAD] Fetched media metadata: ${result.filename}${result.extension}`;

            // Use the actual filename and extension from the media service
            finalFileName = sanitizeFilename(`${result.filename}${result.extension}`);
            finalFilePath = path.join(downloadDir, finalFileName);

            // Check if file already exists
            if (await fileExists(finalFilePath)) {
                state.state = `[DOWNLOAD] File already exists, skipping download: ${finalFileName}`;
                this.log.info(`Skipping download - file already exists: ${finalFilePath}`);
            } else {
                // Download the file
                state.state = `[DOWNLOAD] Streaming media to: ${finalFileName}`;
                await streamToFile(result.stream, finalFilePath);
                state.state = `[DOWNLOAD] Successfully downloaded: ${finalFileName}`;
                this.log.info(`Media downloaded successfully: ${finalFilePath}`);
            }

            // ========== FFMPEG COMPRESSION PHASE ==========
            this.log.info(`[FFMPEG] Starting Compression of: ${finalFilePath}`);
            state.state = `[FFMPEG] Starting compression`;

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
                state.state = `[FFMPEG] Compressed file already exists: ${compressedFileName}`;
                this.log.info(`Skipping compression - file already exists: ${finalOutputPath}`);
                return;
            }

            // Verify input file exists before compression
            if (!await fileExists(finalFilePath)) {
                throw new Error(`Input file not found for compression: ${finalFilePath}`);
            }

            // Start compression and get child process
            const cp = this.ffmpegService.compressVideo(finalFilePath, finalOutputPath, 500);

            // Listen to child process output and update state
            await new Promise<void>((resolve, reject) => {
                // Listen to stdout (standard output)
                cp.stdout?.on('data', (data: Buffer) => {
                    const output = data.toString().trim();
                    if (output) {
                        state.state = `[FFMPEG] ${output}`;
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
                            state.state = `[FFMPEG] Processing... Time: ${timeMatch[1]}, Speed: ${speedMatch[1]}`;
                        } else {
                            state.state = `[FFMPEG] ${output}`;
                        }
                    } else if (output.includes('frame=')) {
                        // Extract frame information
                        const frameMatch = output.match(/frame=\s*(\d+)/);
                        if (frameMatch) {
                            state.state = `[FFMPEG] Processing frame ${frameMatch[1]}...`;
                        } else {
                            state.state = `[FFMPEG] ${output}`;
                        }
                    } else {
                        state.state = `[FFMPEG] ${output}`;
                    }

                    this.log.info(`[FFMPEG] ${output}`);
                });

                // Handle process completion
                cp.on('close', (code: number) => {
                    if (code === 0) {
                        state.state = `[FFMPEG] Compression completed successfully`;
                        this.log.info(`[FFMPEG] Process completed with code: ${code}`);
                        resolve();
                    } else {
                        const errorMsg = `FFmpeg process failed with code: ${code}`;
                        state.state = `[FFMPEG] ${errorMsg}`;
                        this.log.error(`[FFMPEG] ${errorMsg}`);
                        reject(new Error(errorMsg));
                    }
                });

                // Handle process exit
                cp.on('exit', (code: number, signal: string) => {
                    this.log.info(`[FFMPEG] Process exited with code: ${code}, signal: ${signal}`);
                    if (code !== 0 && code !== null) {
                        const errorMsg = `FFmpeg exited with code: ${code}`;
                        state.state = `[FFMPEG] ${errorMsg}`;
                        reject(new Error(errorMsg));
                    }
                });

                // Handle process errors
                cp.on('error', (error: Error) => {
                    state.state = `[FFMPEG] Process error: ${error.message}`;
                    this.log.error(`[FFMPEG] Process error:`, error);
                    reject(error);
                });

                // Optional: Handle process spawn event
                cp.on('spawn', () => {
                    state.state = `[FFMPEG] Process spawned successfully`;
                    this.log.info(`[FFMPEG] Process spawned, PID: ${cp.pid}`);
                });
            });

            // Verify output file exists and get size info
            if (await fileExists(finalOutputPath)) {
                const originalSize = await getFileSize(finalFilePath);
                const compressedSize = await getFileSize(finalOutputPath);
                const compressionRatio = ((originalSize - compressedSize) / originalSize * 100).toFixed(2);

                state.state = `[FFMPEG] Compression complete! Reduced from ${formatFileSize(originalSize)} to ${formatFileSize(compressedSize)} (${compressionRatio}% reduction)`;
                this.log.info(`[FFMPEG] Final result: ${finalOutputPath}`);
                this.log.info(`[FFMPEG] Size reduction: ${formatFileSize(originalSize)} → ${formatFileSize(compressedSize)} (${compressionRatio}% smaller)`);
            } else {
                throw new Error('[FFMPEG] Compression completed but output file not found');
            }

        } catch (error: any) {
            this.log.error('Media compression job failed:', error);
            state.state = `[ERROR] Failed: ${error.message}`;
            throw error;
        }
    }

    private async handleCompressImageRequest(state: JobState): Promise<void> {
        const jobData = state.jobData as CompressImageReqJobData;
        this.log.info(`Starting compress image request job for URL: ${jobData.payload}`);

        try {
            const downloadDir = "./temp";
            await ensureDirectoryExists(downloadDir);

            // Variables to track the final file path for FFmpeg input
            let finalFilePath: string;
            let finalFileName: string;

            // ========== DOWNLOAD PHASE ==========
            state.state = `[DOWNLOAD] Starting download from URL: ${jobData.payload}`;

            // Always fetch metadata to get the actual filename
            const result = await this.mediaService.downloadMediaFromUrl(jobData.payload);

            state.state = `[DOWNLOAD] Fetched image metadata: ${result.filename}${result.extension}`;

            // Use the actual filename and extension from the media service
            finalFileName = sanitizeFilename(`${result.filename}${result.extension}`);
            finalFilePath = path.join(downloadDir, finalFileName);

            // Check if file already exists
            if (await fileExists(finalFilePath)) {
                state.state = `[DOWNLOAD] File already exists, skipping download: ${finalFileName}`;
                this.log.info(`Skipping download - file already exists: ${finalFilePath}`);
            } else {
                // Download the file
                state.state = `[DOWNLOAD] Streaming image to: ${finalFileName}`;
                await streamToFile(result.stream, finalFilePath);
                state.state = `[DOWNLOAD] Successfully downloaded: ${finalFileName}`;
                this.log.info(`Image downloaded successfully: ${finalFilePath}`);
            }

            // ========== FFMPEG IMAGE COMPRESSION PHASE ==========
            this.log.info(`[FFMPEG] Starting Image Compression of: ${finalFilePath}`);
            state.state = `[FFMPEG] Starting image compression`;

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
                state.state = `[FFMPEG] Compressed image already exists: ${compressedFileName}`;
                this.log.info(`Skipping compression - file already exists: ${finalOutputPath}`);
                return;
            }

            // Verify input file exists before compression
            if (!await fileExists(finalFilePath)) {
                throw new Error(`Input file not found for compression: ${finalFilePath}`);
            }

            // Start image compression and get child process
            const cp = this.ffmpegService.compressImage(
                finalFilePath,
                finalOutputPath,
                jobData.options.quality,
                jobData.options.maxWidth,
                jobData.options.maxHeight
            );

            // Listen to child process output and update state
            await new Promise<void>((resolve, reject) => {
                // Listen to stdout (standard output)
                cp.stdout?.on('data', (data: Buffer) => {
                    const output = data.toString().trim();
                    if (output) {
                        state.state = `[FFMPEG] ${output}`;
                        this.log.info(`[FFMPEG stdout] ${output}`);
                    }
                });

                // Listen to stderr (FFmpeg progress info)
                cp.stderr?.on('data', (data: Buffer) => {
                    const output = data.toString().trim();
                    state.state = `[FFMPEG] ${output}`;
                    this.log.info(`[FFMPEG] ${output}`);
                });

                // Handle process completion
                cp.on('close', (code: number) => {
                    if (code === 0) {
                        state.state = `[FFMPEG] Image compression completed successfully`;
                        this.log.info(`[FFMPEG] Process completed with code: ${code}`);
                        resolve();
                    } else {
                        const errorMsg = `FFmpeg image process failed with code: ${code}`;
                        state.state = `[FFMPEG] ${errorMsg}`;
                        this.log.error(`[FFMPEG] ${errorMsg}`);
                        reject(new Error(errorMsg));
                    }
                });

                // Handle process exit
                cp.on('exit', (code: number, signal: string) => {
                    this.log.info(`[FFMPEG] Process exited with code: ${code}, signal: ${signal}`);
                    if (code !== 0 && code !== null) {
                        const errorMsg = `FFmpeg exited with code: ${code}`;
                        state.state = `[FFMPEG] ${errorMsg}`;
                        reject(new Error(errorMsg));
                    }
                });

                // Handle process errors
                cp.on('error', (error: Error) => {
                    state.state = `[FFMPEG] Process error: ${error.message}`;
                    this.log.error(`[FFMPEG] Process error:`, error);
                    reject(error);
                });

                // Optional: Handle process spawn event
                cp.on('spawn', () => {
                    state.state = `[FFMPEG] Image process spawned successfully`;
                    this.log.info(`[FFMPEG] Process spawned, PID: ${cp.pid}`);
                });
            });

            // Verify output file exists and get size info
            if (await fileExists(finalOutputPath)) {
                const originalSize = await getFileSize(finalFilePath);
                const compressedSize = await getFileSize(finalOutputPath);
                const compressionRatio = ((originalSize - compressedSize) / originalSize * 100).toFixed(2);

                state.state = `[FFMPEG] Image compression complete! Reduced from ${formatFileSize(originalSize)} to ${formatFileSize(compressedSize)} (${compressionRatio}% reduction)`;
                this.log.info(`[FFMPEG] Final result: ${finalOutputPath}`);
                this.log.info(`[FFMPEG] Size reduction: ${formatFileSize(originalSize)} → ${formatFileSize(compressedSize)} (${compressionRatio}% smaller)`);
            } else {
                throw new Error('[FFMPEG] Image compression completed but output file not found');
            }

        } catch (error: any) {
            this.log.error('Image compression job failed:', error);
            state.state = `[ERROR] Failed: ${error.message}`;
            throw error;
        }
    }
}