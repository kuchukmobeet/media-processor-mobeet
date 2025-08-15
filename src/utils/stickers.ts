import fs from "node:fs/promises";
import path from "node:path";
import { MEDIA } from "../config/media";

/**
 * We only allow server-side stickers from assets/stickers.
 * Supported extensions: .webp or .png (prefer .webp for perf).
 */
const SUPPORTED_EXT = [".webp", ".png"];

export async function resolveStickerPath(name: string): Promise<string> {
  // sanitize simple name tokens; disallow path traversal
  if (!/^[a-zA-Z0-9_\-]+$/.test(name)) {
    throw new Error(`Invalid sticker name: ${name}`);
  }
  const base = path.join(MEDIA.assetsDir, "stickers", name);
  for (const ext of SUPPORTED_EXT) {
    const full = base + ext;
    try {
      await fs.access(full);
      return full;
    } catch {
      /* try next */
    }
  }
  throw new Error(`Sticker not found: ${name} (expected ${base}.webp or .png)`);
}

export async function resolveStickerFiles(
  stickers: Array<{ name: string }>
): Promise<string[]> {
  return Promise.all(stickers.map((s) => resolveStickerPath(s.name)));
}
