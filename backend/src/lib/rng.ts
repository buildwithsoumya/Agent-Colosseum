import crypto from "node:crypto";

/** Cryptographically sound float in [0, 1). Server-side only. */
export function secureRandomFloat(): number {
  return crypto.randomBytes(6).readUIntBE(0, 6) / 2 ** 56;
}

/** Deterministic seeded PRNG for reproducible simulated evaluation runs. */
export function seededRandom(seed: string): () => number {
  let h = crypto.createHash("sha256").update(seed).digest().readUInt32LE(0) || 1;
  return () => {
    // xorshift32
    h ^= h << 13;
    h >>>= 0;
    h ^= h >> 17;
    h ^= h << 5;
    h >>>= 0;
    return h / 0x100000000;
  };
}

export const randomToken = (bytes = 32): string => crypto.randomBytes(bytes).toString("hex");

export const sha256 = (value: string): string => crypto.createHash("sha256").update(value).digest("hex");

export const inviteCode = (): string => {
  // unambiguous alphabet — no 0/O/1/I
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  const bytes = crypto.randomBytes(6);
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out;
};

export const clamp = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v));
