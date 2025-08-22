import {ChildProcess} from "node:child_process";

export interface IFFmpegService {
    compressVideo(
        input: string,
        output: string,
        bitrate: number,
    ): ChildProcess;
    
    compressImage(
        input: string,
        output: string,
        quality: number,
        maxWidth?: number,
        maxHeight?: number,
    ): ChildProcess;
}
