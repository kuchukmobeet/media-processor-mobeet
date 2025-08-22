import {MediaDownloadResult} from "../../../types/mediaService.types";
import {IMediaService} from "../IMediaService";
import {injectable} from "tsyringe";
// @ts-ignore
import got from "got";
import {PassThrough} from "node:stream";
import {extension as extFromMime} from "mime-types";
import {basename, extname} from "node:path";
import {getLogger} from "../../../logger";
import {EventEmitter} from "node:events";

export interface MediaDownloadOptions {
    authToken?: string;
    onProgress?: (downloadedBytes: number, totalBytes?: number) => void;
}

@injectable()
export class MediaServiceImpl implements IMediaService {
    private readonly logger = getLogger(MediaServiceImpl.name);

    downloadMediaFromUrl(url: string, opts?: MediaDownloadOptions): Promise<MediaDownloadResult> {
        return new Promise((resolve, reject) => {
            const headers: Record<string, string> = {};
            if (opts?.authToken) headers.authorization = `Bearer ${opts.authToken}`;

            const src = got.stream(url, {headers});
            const out = new PassThrough();

            // Handle errors from both streams
            const cleanup = () => {
                src.destroy();
                out.destroy();
            };

            const handleError = (error: Error) => {
                cleanup();
                reject(error);
            };

            src.once("error", handleError);
            out.once("error", handleError);

            // Track download progress if callback provided
            if (opts?.onProgress) {
                let downloadedBytes = 0;
                let totalSize: number | undefined;

                src.on('response', (res: any) => {
                    if (res.headers['content-length']) {
                        totalSize = parseInt(res.headers['content-length'], 10);
                    }
                });

                src.on('data', (chunk: Buffer) => {
                    downloadedBytes += chunk.length;
                    opts.onProgress!(downloadedBytes, totalSize);
                });
            }

            src.pipe(out);

            src.once("response", (res: any) => {
                try {
                    const mime = (res.headers["content-type"] ?? "").split(";")[0].trim();

                    // Get extension from MIME type (already includes the dot)
                    const extFromMimeType = extFromMime(mime);
                    let ext = extFromMimeType ? `.${extFromMimeType}` : "";

                    // Extract filename from Content-Disposition header
                    const cd = res.headers["content-disposition"] as string | undefined;
                    const nameFromCd = this.extractFilenameFromContentDisposition(cd);

                    let filename: string;

                    if (nameFromCd) {
                        filename = this.sanitizeFilename(nameFromCd);
                    } else {
                        // Fallback to URL pathname
                        try {
                            const urlPath = new URL(url).pathname;
                            filename = basename(urlPath) || "download";
                        } catch {
                            filename = "download";
                        }
                    }

                    // Extract existing extension from filename if no MIME extension
                    if (!ext) {
                        ext = extname(filename);
                    }

                    // Only add extension if filename doesn't already have one
                    if (ext && !filename.endsWith(ext)) {
                        // Remove any existing extension first to avoid duplicates
                        const nameWithoutExt = filename.replace(/\.[^/.]+$/, "");
                        filename = nameWithoutExt + ext;
                    }

                    // Ensure we have a valid filename
                    if (!filename || filename === ext) {
                        filename = `download${ext || ""}`;
                    }

                    resolve({stream: out, filename, extension: ext});
                } catch (error) {
                    handleError(error as Error);
                }
            });
        });
    }

    extractFilenameFromContentDisposition(cd: string | undefined): string | null {
        if (!cd) return null;

        // Handle both filename and filename* formats
        const filenameStarMatch = cd.match(/filename\*=UTF-8''([^;]+)/i);
        if (filenameStarMatch) {
            try {
                return decodeURIComponent(filenameStarMatch[1]);
            } catch {
                // Fall through to regular filename
            }
        }

        const filenameMatch = cd.match(/filename=([^;]+)/i);
        if (filenameMatch) {
            return filenameMatch[1].replace(/^"|"$/g, "").trim();
        }

        return null;
    }

    private sanitizeFilename(filename: string): string {
        // Remove or replace potentially dangerous characters
        return filename
            .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_") // Replace invalid filename characters
            .replace(/^\.+/, "") // Remove leading dots
            .substring(0, 255) // Limit length
            .trim();
    }
}