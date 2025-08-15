import "dotenv/config";
import express from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs/promises";
import { Queue, Worker, JobsOptions } from "bullmq";
import { MediaSchema } from "./z/MediaSchema";
import { MEDIA } from "./config/media";
import cors from "cors";
import helmet from "helmet";
import pino from "pino";
import { hashFileAndMeta } from "./utils/hashUpload";

// workers
import { processVideo } from "./worker/video";
import { processImage } from "./worker/image";

const log = pino();

async function bootstrap() {
  const app = express();

  await fs.mkdir(MEDIA.uploadDir, { recursive: true });
  await fs.mkdir(MEDIA.outputDir, { recursive: true });
  await fs.mkdir(path.join(MEDIA.assetsDir, "luts"), { recursive: true });
  await fs.mkdir(path.join(MEDIA.assetsDir, "stickers"), { recursive: true });

  app.use(express.json({ limit: "1mb" }));
  app.use(cors());
  app.use(helmet());

  // serve saved outputs
  app.use(
    "/outputs",
    express.static(MEDIA.outputDir, { maxAge: "30d", etag: true })
  );

  const upload = multer({
    dest: MEDIA.uploadDir,
    limits: { fileSize: 500 * 1024 * 1024 }, // 500MB
  });

  const mediaQ = new Queue("media", {
    connection: {
      host: process.env.REDIS_HOST,
      port: Number(process.env.REDIS_PORT),
    },
  });

  // Worker
  new Worker(
    "media",
    async (job) => {
      const { filePath, meta } = job.data;

      // tie output filename to the BullMQ job id
      const id = String(job.id);
      const outExt = meta.mediaType === "video" ? "mp4" : "jpg";
      const outputPath = path.join(MEDIA.outputDir, `${id}.${outExt}`);

      await job.updateProgress(10); // before FFmpeg starts
      console.log("Started job", job.id);

      try {
        if (meta.mediaType === "video") {
          await processVideo({ inputPath: filePath, outputPath, meta });
          await job.updateProgress(50);
        } else {
          await processImage({ inputPath: filePath, outputPath, meta });
          await job.updateProgress(50);
        }
        await job.updateProgress(100);
        return { output: outputPath };
      } finally {
        // Always delete the temp upload file
        await fs
          .unlink(filePath)
          .catch((e) =>
            console.warn("Failed to delete temp file:", filePath, e)
          );
      }
    },

    {
      connection: {
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT),
      },
      concurrency: 2,
    }
  );

  // /process route (REPLACE the whole handler)
  app.post("/process", upload.single("file"), async (req, res) => {
    try {
      const meta = MediaSchema.parse(JSON.parse(req.body.metadata));
      const filePath = req.file!.path;

      // deterministic job id for same file+metadata
      const deterministicId = await hashFileAndMeta(filePath, meta);

      console.log(
        `[${new Date().toISOString()}] /process -> ${req.file?.originalname} id=${deterministicId}`
      );

      const job = await mediaQ.add("process", { filePath, meta }, {
        jobId: deterministicId, // <-- prevents duplicate enqueue
        removeOnComplete: true,
        removeOnFail: true,
      } as JobsOptions);

      res.json({ jobId: job.id });
    } catch (e: any) {
      console.error("Process error:", e);
      res.status(400).json({ error: e.message });
    }
  });

  app.get("/status/:id", async (req, res) => {
    const job = await mediaQ.getJob(req.params.id);
    if (!job) return res.status(404).json({ error: "not found" });
    const state = await job.getState();
    const result = await job.getReturnValue().catch(() => null);
    const url = result?.output
      ? `/outputs/${path.basename(result.output)}`
      : null;
    const progress = await job.getProgress();
    res.json({ state, progress, result: result ? { ...result, url } : null });
  });

  const port = Number(process.env.PORT ?? 8000);
  app.listen(port, () => log.info({ port }, "Media API listening"));
}

bootstrap().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
