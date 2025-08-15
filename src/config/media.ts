// src/config/media.ts
export const MEDIA = {
  // canonical sizes we support
  canvasReel: { width: 1080, height: 1920 }, // 9:16
  canvasPost: { width: 1080, height: 1350 }, // 4:5

  outputDir: process.env.MEDIA_OUTPUT_DIR ?? "outputs",
  uploadDir: process.env.MEDIA_UPLOAD_DIR ?? "uploads",
  assetsDir: process.env.MEDIA_ASSETS_DIR ?? "assets",

  /**
   * getCanvas(post?: boolean)
   * - if post === true => 4:5 (1080x1350)
   * - otherwise => portrait 9:16 (1080x1920)
   */
  getCanvas(post?: boolean) {
    const usePost = Boolean(post);
    return usePost
      ? { canvasWidth: MEDIA.canvasPost.width, canvasHeight: MEDIA.canvasPost.height }
      : { canvasWidth: MEDIA.canvasReel.width, canvasHeight: MEDIA.canvasReel.height };
  },
};
