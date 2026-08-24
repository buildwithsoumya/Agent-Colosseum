import crypto from "node:crypto";

/** Deterministic seeded PRNG for reproducible simulated evaluation runs. */
export function seededRandom(seed: string): () => number {
  let h = crypto.createHash("sha256").update(seed).digest().readUInt32LE(0) || 1;
  return () => {
    h ^= h << 13;
    h >>>= 0;
    h ^= h >> 17;
    h ^= h << 5;
    h >>>= 0;
    return h / 0x100000000;
  };
}

export const clamp = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v));
