/**
 * Convert RGBA color string to FFmpeg color format
 */
export const rgbaToFFmpegColor = (rgba: string): string => {
  // Try to match rgba(r, g, b, a) format
  const rgbaMatch = rgba.match(
    /rgba?\s*\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)/i
  );

  if (rgbaMatch) {
    const r = clamp255(Number(rgbaMatch[1]));
    const g = clamp255(Number(rgbaMatch[2]));
    const b = clamp255(Number(rgbaMatch[3]));
    const a = clampAlpha(rgbaMatch[4] !== undefined ? Number(rgbaMatch[4]) : 1);
    
    return `0x${toHex(r)}${toHex(g)}${toHex(b)}@${a}`;
  }

  // Try to match hex format (#RRGGBB or RRGGBB)
  const hexMatch = rgba.trim();
  if (/^#?[0-9a-fA-F]{6}$/.test(hexMatch)) {
    const hex = hexMatch.replace(/^#/, '');
    return `0x${hex.toUpperCase()}@1`;
  }

  // Default to white if parsing fails
  return '0xFFFFFF@1';
};

/**
 * Convert number to 2-digit hex string
 */
const toHex = (n: number): string => {
  return n.toString(16).padStart(2, '0').toUpperCase();
};

/**
 * Clamp color value to 0-255 range
 */
const clamp255 = (n: number): number => {
  return Math.max(0, Math.min(255, Math.round(n)));
};

/**
 * Clamp alpha value to 0-1 range
 */
const clampAlpha = (a: number): number => {
  return Math.max(0, Math.min(1, a));
};
