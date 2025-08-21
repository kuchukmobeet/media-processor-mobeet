import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import { generateUniqueFilename, ensureDirectory, deleteFile } from './file';

const SUPPORTED: Record<string, string> = {
  // images
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  // videos
  'video/mp4': '.mp4',
  'video/quicktime': '.mov',
  'video/x-msvideo': '.avi',
  'video/webm': '.webm',
};

/**
 * Downloads a remote media file to `dir` and returns its local path,
 * MIME type, extension and size (bytes).
 */
export async function downloadMedia(
  url: string,
  dir: string
): Promise<{
  localPath: string;
  mime: string;
  ext: string;
  size: number;
}> {
  // --- fetch with proper timeout ------------------------------------------
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30_000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`Download failed: ${res.status} ${res.statusText}`);
    }

    const mime = (res.headers.get('content-type') || '').split(';')[0].trim();
    const ext =
      path.extname(new URL(url).pathname).toLowerCase() ||
      SUPPORTED[mime] ||
      '';

    if (!Object.values(SUPPORTED).includes(ext)) {
      throw new Error(`Unsupported media type: ${mime || ext}`);
    }

    await ensureDirectory(dir);
    const filename = generateUniqueFilename(
      path.basename(url.split('?')[0]) || 'remote',
      ext
    );
    const localPath = path.join(dir, filename);

    // --- stream to disk -------------------------------------------------
    if (!res.body) throw new Error('Empty response body');
    await pipeline(res.body, createWriteStream(localPath));

    const { size } = await import('node:fs/promises').then(fs =>
      fs.stat(localPath)
    );

    return { localPath, mime, ext, size };
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Download timed out after 30 seconds');
    }
    throw error;
  }
}

/**
 * Convenience validator – returns `"image"` or `"video"` based on MIME / ext.
 */
export function getMediaKind(mime: string, ext: string): 'image' | 'video' {
  const videoExts = ['.mp4', '.mov', '.avi', '.webm'];
  if (mime.startsWith('video/') || videoExts.includes(ext)) return 'video';
  return 'image';
}

/**
 * Helper to remove the downloaded file on errors / after use.
 */
export async function cleanupDownloaded(pathToFile: string): Promise<void> {
  await deleteFile(pathToFile); // from utils/file.ts
}
