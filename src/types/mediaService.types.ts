import {Readable} from "node:stream";

export interface MediaDownloadResult {
    // Stream of the media file
    stream: Readable;
    filename: string;
    // starts with “.”, e.g. “.mp4”
    extension: string;
}