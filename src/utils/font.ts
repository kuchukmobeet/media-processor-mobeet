import path from "node:path";
import fs from "node:fs/promises";
import { MEDIA } from "../config/media";

export async function resolveFontPath(
  fontFamily: string,
  fontWeight = "Medium"
) {
  const fileName = `${fontFamily}-${fontWeight}.ttf`;
  const fontPath = path.join(MEDIA.assetsDir, "fonts", fileName);
  try {
    await fs.access(fontPath);
    return fontPath;
  } catch {
    throw new Error(`Font not found: ${fileName}`);
  }
}
