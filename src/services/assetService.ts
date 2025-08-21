import path from 'node:path';
import { getAssetPaths } from '../config';
import { fileExists } from '../utils/file';

export class AssetService {
  private readonly assetPaths = getAssetPaths();

  /**
   * Resolve sticker file path by name
   * Supports .webp and .png extensions (prefers .webp)
   */
  async resolveStickerPath(name: string): Promise<string> {
    // Sanitize name to prevent path traversal
    if (!/^[a-zA-Z0-9_\-]+$/.test(name)) {
      throw new Error(`Invalid sticker name: ${name}`);
    }

    const supportedExtensions = ['.webp', '.png'];
    const basePath = path.join(this.assetPaths.stickers, name);

    for (const ext of supportedExtensions) {
      const fullPath = basePath + ext;
      if (await fileExists(fullPath)) {
        return fullPath;
      }
    }

    throw new Error(`Sticker not found: ${name} (expected ${name}.webp or ${name}.png)`);
  }

  /**
   * Resolve multiple sticker paths
   */
  async resolveStickerPaths(stickerNames: string[]): Promise<string[]> {
    return Promise.all(stickerNames.map(name => this.resolveStickerPath(name)));
  }

  /**
   * Resolve font file path by family and weight
   */
  async resolveFontPath(fontFamily: string, fontWeight = 'Medium'): Promise<string> {
    // Sanitize inputs
    if (!/^[a-zA-Z0-9_\-]+$/.test(fontFamily) || !/^[a-zA-Z0-9_\-]+$/.test(fontWeight)) {
      throw new Error(`Invalid font name: ${fontFamily}-${fontWeight}`);
    }

    const fileName = `${fontFamily}-${fontWeight}.ttf`;
    const fontPath = path.join(this.assetPaths.fonts, fileName);

    if (await fileExists(fontPath)) {
      return fontPath;
    }

    throw new Error(`Font not found: ${fileName}`);
  }

  /**
   * List available stickers
   */
  async listStickers(): Promise<string[]> {
    try {
      const fs = await import('node:fs/promises');
      const files = await fs.readdir(this.assetPaths.stickers);
      
      return files
        .filter(file => file.endsWith('.webp') || file.endsWith('.png'))
        .map(file => path.basename(file, path.extname(file)))
        .filter((name, index, arr) => arr.indexOf(name) === index); // Remove duplicates
    } catch (error) {
      console.warn('Could not list stickers:', error);
      return [];
    }
  }

  /**
   * List available fonts
   */
  async listFonts(): Promise<Array<{ family: string; weight: string }>> {
    try {
      const fs = await import('node:fs/promises');
      const files = await fs.readdir(this.assetPaths.fonts);
      
      return files
        .filter(file => file.endsWith('.ttf'))
        .map(file => {
          const name = path.basename(file, '.ttf');
          const parts = name.split('-');
          return {
            family: parts[0] || 'Unknown',
            weight: parts[1] || 'Regular',
          };
        });
    } catch (error) {
      console.warn('Could not list fonts:', error);
      return [];
    }
  }
}
