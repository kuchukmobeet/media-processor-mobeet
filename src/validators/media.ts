import { z } from 'zod';

const positionSchema = z.object({
  x: z.number().min(0),
  y: z.number().min(0),
});

const sizeSchema = z.object({
  width: z.number().min(1).max(2000),
  height: z.number().min(1).max(2000),
});

const cropSchema = z.object({
  x: z.number().min(0).default(0),
  y: z.number().min(0).default(0),
  width: z.number().min(1).optional(),
  height: z.number().min(1).optional(),
}).partial().default({});

const contentSchema = z.object({
  position: positionSchema.default({ x: 0, y: 0 }),
  size: sizeSchema.optional(),
  rotation: z.number().min(-180).max(180).default(0),
  crop: cropSchema,
});

const backgroundSchema = z.object({
  aspectRatio: z.enum(['9:16', '4:5']).default('9:16'),
  color: z.string().default('#000000'),
}).default({ aspectRatio: '9:16', color: '#000000' });

const filtersSchema = z.object({
  ffmpeg: z.string().optional(),
  order: z.array(z.string()).optional(),
}).default({});

const stickerSchema = z.object({
  name: z.string(),
  position: positionSchema,
  size: sizeSchema.optional(),
  scale: z.number().positive().default(1),
  rotation: z.number().min(-180).max(180).default(0),
  z: z.number().int().default(0),
  opacity: z.number().min(0).max(1).default(1),
});

const textOverlaySchema = z.object({
  text: z.string(),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  rotation: z.number().optional(),
  fontFamily: z.string(),
  fontWeight: z.string().optional(),
  color: z.string().default('rgba(255, 255, 255, 1)'),
  backgroundColor: z.string().optional(),
  z: z.number().int().default(0),
});

const outputSchema = z.object({
  quality: z.number().min(1).max(100).default(90),
}).default({ quality: 90 });

export const mediaRequestSchema = z.object({
  post: z.boolean().optional().default(false),
  mediaType: z.enum(['image', 'video']),
  background: backgroundSchema,
  content: contentSchema,
  filters: filtersSchema,
  stickers: z.array(stickerSchema).default([]),
  textOverlays: z.array(textOverlaySchema).optional(),
  output: outputSchema,
});

export type MediaRequestInput = z.input<typeof mediaRequestSchema>;
export type MediaRequestOutput = z.output<typeof mediaRequestSchema>;
