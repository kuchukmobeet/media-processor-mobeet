import * as fs from 'fs/promises';
import {createWriteStream} from "node:fs";
import {pipeline} from "node:stream/promises";

export const ensureDirectoryExists = async (dirPath: string): Promise<void> => {
    try {
        await fs.access(dirPath);
    } catch {
        await fs.mkdir(dirPath, {recursive: true});
    }
}

export const streamToFile = async (stream: NodeJS.ReadableStream, filePath: string): Promise<void> => {
    const writeStream = createWriteStream(filePath);
    await pipeline(stream, writeStream);

    // Log final file size
    await getFileSize(filePath);
}

/**
 * Get file size for logging/verification
 */
export const getFileSize = async (filePath: string): Promise<number> => {
    try {
        const stats = await fs.stat(filePath);
        return stats.size;
    } catch {
        return 0;
    }
}


export const fileExists = async (filePath: string): Promise<boolean> => {
    try {
        await fs.access(filePath);
        await getFileSize(filePath);
        return true;
    } catch {
        return false;
    }
}