import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { env } from "../config/env.js";
import { unprocessable } from "../lib/errors.js";

/**
 * Storage abstraction: local-disk driver for development, S3 swap-in for production.
 * No AWS dependency is required to run the demo.
 */
export interface StoredObject {
  key: string;
}

export interface StorageDriver {
  put(buf: Buffer, filename: string, contentType: string): Promise<StoredObject>;
}

const localDriver: StorageDriver = {
  async put(buf, filename) {
    const ext = path.extname(filename).slice(0, 12);
    const key = `${randomUUID()}${ext}`;
    const dir = path.resolve(env.STORAGE_LOCAL_DIR);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, key), buf);
    return { key };
  },
};

const s3Driver: StorageDriver = {
  async put() {
    // Production swap point: initialise @aws-sdk/client-s3 here using S3_* env vars.
    if (!env.S3_BUCKET || !env.S3_REGION) {
      throw unprocessable("S3 storage is not configured — set S3_* variables or use STORAGE_DRIVER=local");
    }
    throw unprocessable("S3 driver requires wiring @aws-sdk/client-s3 in src/services/storage.ts");
  },
};

export const storage: StorageDriver = env.STORAGE_DRIVER === "s3" ? s3Driver : localDriver;
