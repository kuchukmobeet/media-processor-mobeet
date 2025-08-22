/**
 * Format file size in human-readable format
 */
export const formatFileSize = (bytes: number): string => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 Bytes';

    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Sanitize filename to remove/replace invalid characters
 * @param filename The original filename
 * @returns Sanitized filename safe for filesystem
 */
export const sanitizeFilename = (filename: string): string => {
    // Remove or replace invalid characters for cross-platform compatibility
    return filename
        .replace(/[<>:"/\\|?*]/g, '_') // Replace invalid chars with underscore
        .replace(/\s+/g, '_') // Replace spaces with underscore
        .replace(/_{2,}/g, '_') // Replace multiple underscores with single
        .replace(/^_+|_+$/g, '') // Remove leading/trailing underscores
        .substring(0, 255); // Limit filename length
}