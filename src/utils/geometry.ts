// src/utils/geometry.ts
export const CANVAS_W = 1080;
export const CANVAS_H = 1920;

export function clamp01(n: number) {
  return Math.min(1, Math.max(0, n));
}

export function clampInt(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(n)));
}

/**
 * clampBoxToCanvas(x,y,w,h, canvasW?, canvasH?)
 * If canvasW/H not provided, falls back to default CANVAS_W/CANVAS_H.
 */
export function clampBoxToCanvas(
  x: number,
  y: number,
  w: number,
  h: number,
  canvasW = CANVAS_W,
  canvasH = CANVAS_H
) {
  const W = clampInt(w, 1, canvasW);
  const H = clampInt(h, 1, canvasH);
  const X = clampInt(x, 0, canvasW - W);
  const Y = clampInt(y, 0, canvasH - H);
  return { x: X, y: Y, width: W, height: H };
}

/**
 * clampPosition - optionally pass canvasW/H
 */
export function clampPosition(x: number, y: number, canvasW = CANVAS_W, canvasH = CANVAS_H) {
  const X = clampInt(x, 0, canvasW);
  const Y = clampInt(y, 0, canvasH);
  return { x: X, y: Y };
}
