// src/worker/video.ts
import { execa } from "execa";
import { resolveStickerFiles } from "../utils/stickers";
import { clampBoxToCanvas, clampPosition } from "../utils/geometry";
import { resolveFontPath } from "../utils/font";
import { MEDIA } from "../config/media";

// You can tune globally via ENV; defaults to 24px if not set.
const TEXT_BOX_PADDING_PX = Number(process.env.TEXT_BOX_PADDING_PX ?? 28);

export async function processVideo({
  inputPath,
  outputPath,
  meta,
}: {
  inputPath: string;
  outputPath: string;
  meta: any;
}) {
  const { content, filters, stickers = [], textOverlays = [] } = meta;

  const TARGET_FPS = 60; // hard-lock to 60 fps

  // dynamic canvas
  const { canvasWidth: CANVAS_W, canvasHeight: CANVAS_H } = MEDIA.getCanvas(
    Boolean(meta?.post)
  );

  // ---- placement (allow decimals for overlay) ----
  const rawX =
    typeof content?.position?.x === "number" ? content.position.x : 0;
  const rawY =
    typeof content?.position?.y === "number" ? content.position.y : 0;

  let width: number | undefined = content?.size?.width;
  let height: number | undefined = content?.size?.height;
  if (typeof width === "number" && typeof height === "number") {
    const clamped = clampBoxToCanvas(
      Math.round(rawX),
      Math.round(rawY),
      Math.round(width),
      Math.round(height),
      CANVAS_W,
      CANVAS_H
    );
    width = clamped.width;
    height = clamped.height;
  } else {
    clampPosition(Math.round(rawX), Math.round(rawY), CANVAS_W, CANVAS_H);
  }

  // ---- inputs (loop sticker images) ----
  const stickerPaths = await resolveStickerFiles(stickers || []);
  const inputs = [
    "-y",
    "-f",
    "lavfi",
    "-i",
    `color=size=${CANVAS_W}x${CANVAS_H}:rate=${TARGET_FPS}:color=black`, // [0]
    "-i",
    inputPath, // [1]
    ...stickerPaths.flatMap((p) => [
      "-loop",
      "1",
      "-framerate",
      String(TARGET_FPS),
      "-i",
      p,
    ]), // [2..]
  ];

  // ---- filter graph ----
  const chains: string[] = [];

  const mainSteps: string[] = [];
  if (content?.crop?.width && content?.crop?.height) {
    const { x = 0, y = 0, width: cw, height: ch } = content.crop;
    mainSteps.push(
      `crop=${Math.round(cw)}:${Math.round(ch)}:${Math.round(x)}:${Math.round(y)}`
    );
  }
  if (content?.rotation) {
    const angle = (content.rotation * Math.PI) / 180;
    mainSteps.push(`rotate=${angle}:ow=rotw(iw):oh=roth(ih)`);
  }
  if (typeof width === "number" && typeof height === "number") {
    mainSteps.push(
      `scale=${Math.round(width)}:${Math.round(height)}:flags=bicubic`
    );
  } else {
    mainSteps.push(
      `scale=${CANVAS_W}:${CANVAS_H}:force_original_aspect_ratio=increase`
    );
    mainSteps.push(`crop=${CANVAS_W}:${CANVAS_H}`);
  }

  // if client provided raw ffmpeg filter string, append it and skip LUT resolution
  if (typeof filters?.ffmpeg === "string" && filters.ffmpeg.trim().length > 0) {
    mainSteps.push(filters.ffmpeg);
  }
  chains.push(`[1:v]${mainSteps.join(",")}[main]`);

  // main overlay (shortest=1 so we stop with main)
  const mainOX = clampFloat(rawX, 0, CANVAS_W);
  const mainOY = clampFloat(rawY, 0, CANVAS_H);
  chains.push(
    `[0:v][main]overlay=${toExpr(mainOX)}:${toExpr(mainOY)}:format=auto:shortest=1[base0]`
  );

  // ---------- Stickers + Text (combined Z-order) ----------
  type Layer =
    | { kind: "sticker"; z: number; s: any; idx: number }
    | { kind: "text"; z: number; t: any; idx: number };

  const layers: Layer[] = [
    ...(stickers || []).map((s: any, idx: number) => ({
      kind: "sticker",
      z: s.z ?? 0,
      s,
      idx,
    })),
    ...(textOverlays || []).map((t: any, idx: number) => ({
      kind: "text",
      z: t.z ?? 0,
      t,
      idx,
    })),
  ].sort((a, b) => a.z - b.z);

  let last = "base0";
  const stickerInputBase = 2;

  for (const layer of layers) {
    if (layer.kind === "sticker") {
      const s = layer.s;
      const angle = ((Number(s.rotation) || 0) * Math.PI) / 180;
      const posX = clampFloat(Number(s?.position?.x) || 0, 0, CANVAS_W);
      const posY = clampFloat(Number(s?.position?.y) || 0, 0, CANVAS_H);

      const hasSize = s?.size?.width && s?.size?.height;
      const W = hasSize ? Math.round(s.size.width) : `iw*${s.scale || 1}`;
      const H = hasSize ? Math.round(s.size.height) : `ih*${s.scale || 1}`;

      const tag = `s${layer.idx}`;
      const steps: string[] = ["format=rgba", `scale=${W}:${H}`];
      if (angle !== 0)
        steps.push(`rotate=${angle}:ow=rotw(iw):oh=roth(ih):c=black@0`);
      if (typeof s.opacity === "number" && s.opacity >= 0 && s.opacity < 1) {
        steps.push(`colorchannelmixer=aa=${s.opacity}`);
      }

      chains.push(
        `[${stickerInputBase + layer.idx}:v]${steps.join(",")}[${tag}]`
      );
      const out = `base_s_${layer.idx}`;
      chains.push(
        `[${last}][${tag}]overlay=${toExpr(posX)}:${toExpr(posY)}:format=auto:shortest=1[${out}]`
      );
      last = out;
    } else {
      // --- TEXT OVERLAY PIPELINE (video) ---
      const t = layer.t;

      // Pixels default; ratio if <=1
      const pxX = clampFloat(toPx(Number(t?.x) || 0, CANVAS_W), 0, CANVAS_W);
      const pxY = clampFloat(toPx(Number(t?.y) || 0, CANVAS_H), 0, CANVAS_H);
      const pad = TEXT_BOX_PADDING_PX;

      const rawBoxW = Math.max(
        1,
        Math.round(toPx(Number(t?.width) || 0, CANVAS_W))
      );
      const baseBoxWidth = 400;
      const baseBoxHeight = 200;
      const baseFontSize = 24;

      const scaleFactor = Math.min(
        rawBoxW / baseBoxWidth,
        CANVAS_H / baseBoxHeight
      );
      const fontSize = Math.max(8, Math.floor(baseFontSize * scaleFactor));
      const lineSpacing = Math.floor(fontSize * 0.8);

      const { textEscaped, lines } = prepareText(String(t.text ?? ""));
      const rawBoxH = fontSize * lines + lineSpacing * (lines - 1);
      const boxW = rawBoxW + pad * 2;
      const boxH = rawBoxH + pad * 2;

      const angle = ((Number(t?.rotation) || 0) * Math.PI) / 180;

      const fontFile = await resolveFontPath(
        String(t.fontFamily || "Poppins"),
        String(t.fontWeight || "Medium")
      );
      const fontColor = rgbaToFFColor(String(t.color ?? "rgba(255,255,255,1)"));

      const useBox =
        typeof t.backgroundColor === "string" && t.backgroundColor.length > 0;
      const boxColor = useBox
        ? rgbaToFFColor(String(t.backgroundColor))
        : undefined;

      const tc = `tc${layer.idx}`;
      chains.push(`color=c=black@0:s=${boxW}x${boxH}:r=${TARGET_FPS} [${tc}]`);

      const tt = `tt${layer.idx}`;
      const drawtext =
        `drawtext=fontfile='${escapePath(fontFile)}'` +
        `:text='${textEscaped}'` +
        `:fontsize=${fontSize}` +
        `:fontcolor=${fontColor}` +
        `:x=(w-text_w)/2` +
        `:y=(h - ((${fontSize} * ${lines}) + (${lineSpacing} * (${lines} - 1)))) / 2` +
        `:line_spacing=${lineSpacing}` +
        (useBox ? `:box=1:boxcolor=${boxColor}:boxborderw=${pad}` : ``);

      chains.push(`[${tc}]${drawtext}[${tt}]`);

      const tOut = angle !== 0 ? `tr${layer.idx}` : tt;
      if (angle !== 0) {
        chains.push(
          `[${tt}]rotate=${angle}:ow=rotw(iw):oh=roth(ih):c=black@0[${tOut}]`
        );
      }

      const out = `base_t_${layer.idx}`;
      chains.push(
        `[${last}][${tOut}]overlay=${toExpr(pxX)}:${toExpr(pxY)}:format=auto:shortest=1[${out}]`
      );
      last = out;
    }
  }

  // lock final stream to TARGET_FPS (CFR)
  chains.push(`[${last}]fps=${TARGET_FPS}[vout]`);
  const finalV = `[vout]`;

  // ---- encoder selection (NVENC vs CPU) ----
  const useNvenc = process.env.VIDEO_ENCODER === "nvenc";
  const q = Number(meta?.output?.quality ?? 90);
  const crf = q >= 90 ? 18 : q >= 80 ? 20 : 23;
  const cq = q >= 90 ? 19 : q >= 80 ? 21 : 24;

  const common = [
    ...inputs,
    "-filter_complex",
    chains.join(";"),
    "-map",
    finalV,
    "-map",
    "1:a?",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    "-threads",
    "0",
    "-filter_threads",
    "2",
    "-shortest",
  ];

  if (useNvenc) {
    try {
      await execa(
        "ffmpeg",
        [
          ...common,
          "-c:v",
          "h264_nvenc",
          "-preset",
          process.env.NVENC_PRESET ?? "p5",
          "-rc",
          "vbr",
          "-cq",
          String(cq),
          "-b:v",
          "0",
          "-c:a",
          "copy",
          outputPath,
        ],
        { stdio: "inherit", timeout: 1000 * 60 * 10 }
      );
      return;
    } catch {
      // fallback to CPU
    }
  }

  try {
    await execa(
      "ffmpeg",
      [
        ...common,
        "-c:v",
        "libx264",
        "-preset",
        process.env.X264_PRESET ?? "medium",
        "-crf",
        String(crf),
        "-c:a",
        "copy",
        outputPath,
      ],
      { stdio: "inherit", timeout: 1000 * 60 * 10 }
    );
  } catch {
    await execa(
      "ffmpeg",
      [
        ...common,
        "-c:v",
        "libx264",
        "-preset",
        process.env.X264_PRESET ?? "medium",
        "-crf",
        String(crf),
        "-c:a",
        "aac",
        "-b:a",
        "160k",
        outputPath,
      ],
      { stdio: "inherit", timeout: 1000 * 60 * 10 }
    );
  }
}

// helpers (same as image.ts)
function clampFloat(n: number, min: number, max: number) {
  if (Number.isNaN(n)) return min;
  return Math.min(max, Math.max(min, n));
}
function toExpr(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(4);
}

function prepareText(raw: string) {
  const normalized = raw.replace(/<br\s*\/?>/gi, "\n");
  const lines = normalized.split("\n").length;
  const escaped = normalized
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/:/g, "\\:")
    .replace(/'/g, "'\\''")
    .replace(/\n/g, "\n");
  return { textEscaped: escaped, lines, rawText: normalized };
}

function rgbaToFFColor(rgba: string) {
  const m = rgba.match(
    /rgba?\s*\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)/i
  );
  if (m) {
    const r = clamp255(Number(m[1]));
    const g = clamp255(Number(m));
    const b = clamp255(Number(m));
    const a = clampAlpha(m !== undefined ? Number(m) : 1);
    return `0x${toHex(r)}${toHex(g)}${toHex(b)}@${a}`; // always six digits!
  }
  const hx = rgba.trim();
  if (/^#?[0-9a-fA-F]{6}$/.test(hx)) {
    const h = hx.replace(/^#/, "");
    return `0x${h.toUpperCase()}@1`;
  }
  return `0xFFFFFF@1`;
}
function toHex(n: number) {
  return n.toString(16).padStart(2, "0").toUpperCase();
}

function clamp255(n: number) {
  return Math.max(0, Math.min(255, Math.round(n)));
}
function clampAlpha(a: number) {
  return Math.max(0, Math.min(1, a));
}

function escapePath(p: string) {
  return p.replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/'/g, "\\'");
}
function toPx(val: number, total: number) {
  if (!Number.isFinite(val)) return 0;
  return val <= 1 ? val * total : val;
}
