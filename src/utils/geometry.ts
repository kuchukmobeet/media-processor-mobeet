import { Canvas, Position, Size } from '../types/media';

/**
 * Clamp a number between min and max values
 */
export const clamp = (value: number, min: number, max: number): number => {
  return Math.min(max, Math.max(min, value));
};

/**
 * Clamp a number to integer between min and max values
 */
export const clampInt = (value: number, min: number, max: number): number => {
  return Math.max(min, Math.min(max, Math.round(value)));
};

/**
 * Clamp a float value between min and max, handling NaN
 */
export const clampFloat = (value: number, min: number, max: number): number => {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
};

/**
 * Clamp position to canvas bounds
 */
export const clampPosition = (position: Position, canvas: Canvas): Position => {
  return {
    x: clampInt(position.x, 0, canvas.width),
    y: clampInt(position.y, 0, canvas.height),
  };
};

/**
 * Clamp a box (position + size) to canvas bounds
 */
export const clampBoxToCanvas = (
  x: number,
  y: number,
  width: number,
  height: number,
  canvas: Canvas
): { x: number; y: number; width: number; height: number } => {
  const clampedWidth = clampInt(width, 1, canvas.width);
  const clampedHeight = clampInt(height, 1, canvas.height);
  const clampedX = clampInt(x, 0, canvas.width - clampedWidth);
  const clampedY = clampInt(y, 0, canvas.height - clampedHeight);

  return {
    x: clampedX,
    y: clampedY,
    width: clampedWidth,
    height: clampedHeight,
  };
};

/**
 * Convert value to expression string for FFmpeg (handle decimals)
 */
export const toExpression = (value: number): string => {
  return Number.isInteger(value) ? String(value) : value.toFixed(4);
};

/**
 * Convert pixel or ratio value to pixels
 * If value <= 1, treat as ratio of total
 * Otherwise, treat as absolute pixels
 */
export const toPixels = (value: number, total: number): number => {
  if (!Number.isFinite(value)) return 0;
  return value <= 1 ? value * total : value;
};
