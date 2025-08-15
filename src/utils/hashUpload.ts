import crypto from "node:crypto";
import fs from "node:fs";

/**
 * Deterministic ID for (file content + metadata).
 * If the same upload+metadata arrives twice while a job is active,
 * BullMQ will reject the duplicate because jobId is the same.
 */
export function hashFileAndMeta(filePath: string, meta: any): Promise<string> {
  return new Promise((resolve, reject) => {
    const h = crypto.createHash("sha1"); // good enough for dedupe
    const s = fs.createReadStream(filePath);
    s.on("data", (d) => h.update(d));
    s.on("error", reject);
    s.on("end", () => {
      h.update(JSON.stringify(meta));
      resolve(h.digest("hex"));
    });
  });
}
