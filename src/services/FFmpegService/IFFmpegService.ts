import {ChildProcess} from "node:child_process";

export interface IFFmpegService {
    compressVideo(
        input: string,
        output: string,
        bitrate: number,
    ): ChildProcess;
}