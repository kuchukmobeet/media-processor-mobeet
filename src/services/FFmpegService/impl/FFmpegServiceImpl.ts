import {ChildProcess, exec} from "node:child_process";
import {IFFmpegService} from "../IFFmpegService";
import {injectable} from "tsyringe";
import {getLogger} from "../../../logger";

/** Thin wrapper around an `ffmpeg` command. */
@injectable()
export class FFmpegServiceImpl implements IFFmpegService {
    private readonly logger = getLogger(FFmpegServiceImpl.name);

    /**
     * Starts an `ffmpeg` process that re-encodes a video to the given bitrate with 480p resolution limit.
     * Optimized for maximum performance and speed.
     *
     * @param input   Path to the source file.
     * @param output  Destination path.
     * @param bitrate Target bitrate in kbps (e.g. 800 → `-b:v 800k`).
     * @returns       The spawned ChildProcess; read `stderr` for progress.
     */
    compressVideo(
        input: string,
        output: string,
        bitrate: number,
    ): ChildProcess {
        this.logger.info(`Compress video ${input} -> ${output} at ${bitrate}kbps (max 480p) - Performance optimized`);

        const cmd = `ffmpeg -i "${input}" ` +
            `-c:v libx264 ` +
            `-preset ultrafast ` +              // Fastest encoding preset (was 'fast')
            `-tune fastdecode ` +               // Optimize for fast decoding
            `-crf 28 ` +                        // Use CRF for better quality/speed balance
            `-maxrate ${bitrate}k ` +           // Keep maxrate constraint
            `-bufsize ${bitrate * 1.5}k ` +     // Reduced buffer size for faster processing
            `-vf "scale='min(854,iw)':'min(480,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2" ` +
            `-c:a aac ` +
            `-b:a 96k ` +                       // Reduced audio bitrate (was 128k)
            `-ac 2 ` +                          // Force stereo (faster than multi-channel)
            `-ar 44100 ` +                      // Standard audio sample rate
            `-movflags +faststart ` +           // Optimize for streaming/fast playback
            `-threads 0 ` +                     // Use all available CPU threads
            `-progress pipe:1 ` +               // Send progress to stdout
            `-y ` +                             // Overwrite output file without asking
            `"${output}"`;

        this.logger.debug(`FFmpeg command: ${cmd}`);
        return exec(cmd);
    }
    
    /**
     * Compresses an image using FFmpeg with optional resizing.
     * 
     * @param input Path to the source image file
     * @param output Destination path for compressed image
     * @param quality Image quality (1-100, higher = better quality)
     * @param maxWidth Optional maximum width (maintains aspect ratio)
     * @param maxHeight Optional maximum height (maintains aspect ratio)
     * @returns The spawned ChildProcess
     */
    compressImage(
        input: string,
        output: string,
        quality: number,
        maxWidth?: number,
        maxHeight?: number,
    ): ChildProcess {
        this.logger.info(`Compress image ${input} -> ${output} at quality ${quality}`);
        
        let scaleFilter = '';
        if (maxWidth || maxHeight) {
            const width = maxWidth || -1;
            const height = maxHeight || -1;
            scaleFilter = `-vf "scale='min(${width},iw)':'min(${height},ih)':force_original_aspect_ratio=decrease"`;
        }
        
        const cmd = `ffmpeg -i "${input}" ` +
            `${scaleFilter} ` +
            `-q:v ${Math.max(1, Math.min(31, Math.round((100 - quality) * 31 / 100)))} ` + // Convert 1-100 to FFmpeg's 31-1 scale
            `-frames:v 1 ` + // Process single image frame
            `-update 1 ` +   // Allow updating existing output file
            `-y ` + // Overwrite output file without asking
            `"${output}"`
            
        this.logger.debug(`FFmpeg image command: ${cmd}`);
        return exec(cmd);
    }
}

export default FFmpegServiceImpl;
