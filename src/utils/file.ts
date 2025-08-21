import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

/**
 * Check if file exists
 */
export const fileExists = async (filePath: string): Promise<boolean> => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
};

/**
 * Ensure directory exists, create if not
 */
export const ensureDirectory = async (dirPath: string): Promise<void> => {
  await fs.mkdir(dirPath, { recursive: true });
};

/**
 * Get file size in bytes
 */
export const getFileSize = async (filePath: string): Promise<number> => {
  const stats = await fs.stat(filePath);
  return stats.size;
};

/**
 * Delete file safely (no error if not exists)
 */
export const deleteFile = async (filePath: string): Promise<void> => {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    // Ignore if file doesn't exist
    if ((error as any).code !== 'ENOENT') {
      throw error;
    }
  }
};

/**
 * Generate unique filename with timestamp and random suffix
 */
export const generateUniqueFilename = (originalName: string, extension?: string): string => {
  const timestamp = Date.now();
  const random = crypto.randomBytes(4).toString('hex');
  const ext = extension || path.extname(originalName);
  const baseName = path.basename(originalName, path.extname(originalName));
  
  return `${baseName}_${timestamp}_${random}${ext}`;
};

/**
 * Generate deterministic hash from file content
 */
export const hashFile = async (filePath: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha1');
    const fsSync = require('node:fs');
    const stream = fsSync.createReadStream(filePath);

    stream.on('data', (data: Buffer) => hash.update(data));
    stream.on('error', reject);
    stream.on('end', () => resolve(hash.digest('hex')));
  });
};
