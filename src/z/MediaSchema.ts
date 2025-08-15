// src/z/MediaSchema.ts
import { z } from "zod";

const pos = z.object({ x: z.number().min(0), y: z.number().min(0) });
const size = z.object({
  width: z.number().min(1).max(2000),
  height: z.number().min(1).max(2000),
});
const Aspect = z.enum(["9:16", "4:5"]);

export const MediaSchema = z.object({
  post: z.boolean().optional().default(false),

  mediaType: z.enum(["image", "video"]),
  background: z
    .object({
      aspectRatio: Aspect.default("9:16"),
      color: z.string().default("#000000"),
    })
    .default({ aspectRatio: "9:16", color: "#000000" }),
  content: z.object({
    position: pos.default({ x: 0, y: 0 }),
    size: size.optional(),
    rotation: z.number().min(-180).max(180).default(0),
    crop: z
      .object({
        x: z.number().min(0).default(0),
        y: z.number().min(0).default(0),
        width: z.number().min(1).optional(),
        height: z.number().min(1).optional(),
      })
      .partial()
      .default({}),
  }),
  filters: z
    .object({
      // Only this field now; all filter parameters must be encoded as a valid ffmpeg filter string
      ffmpeg: z.string().optional(),
      // Optionally include order[] for logging/tracing/debugging
      order: z.array(z.string()).optional(),
    })
    .default({}),
  stickers: z
    .array(
      z.object({
        name: z.string(),
        position: pos,
        size: size.optional(),
        scale: z.number().positive().default(1),
        rotation: z.number().min(-180).max(180).default(0),
        z: z.number().int().default(0),
        opacity: z.number().min(0).max(1).default(1),
      })
    )
    .default([]),
  textOverlays: z
    .array(
      z.object({
        text: z.string(),
        x: z.number(),
        y: z.number(),
        width: z.number(),
        height: z.number(),
        rotation: z.number().optional(),
        fontFamily: z.string(),
        fontWeight: z.string().optional(),
        color: z.string().default("rgba(255, 255, 255, 1)"),
        backgroundColor: z.string().optional(),
        z: z.number().int().default(0),
      })
    )
    .optional(),
  output: z
    .object({ quality: z.number().min(1).max(100).default(90) })
    .default({ quality: 90 }),
});
