import crypto from "node:crypto";

/**
 * Team join codes — typed easily at a live event, validated server-side.
 *
 * - 8 characters from an ambiguity-free alphabet (no I/L/O/0/1)
 * - displayed as XXXX-XXXX, accepted in any case with any separators
 * - generated with crypto.randomInt (cryptographically secure)
 * - stored as SHA-256 hash for lookup + AES-256-GCM cipher so the captain
 *   can re-display the code without keeping plaintext in the database
 */

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // 31 symbols, no ambiguous glyphs
const CODE_LENGTH = 8;

/** Raw code like "X7K4P9Q2"; display layer groups it as X7K4-P9Q2. */
export function generateJoinCode(): string {
  let out = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += ALPHABET[crypto.randomInt(0, ALPHABET.length)];
  }
  return out;
}

/** Normalize user input: uppercase, strip everything non-alphanumeric. */
export function normalizeJoinCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function isValidNormalizedCode(code: string): boolean {
  return code.length === CODE_LENGTH && [...code].every((c) => ALPHABET.includes(c));
}

export function hashJoinCode(normalized: string): string {
  return crypto.createHash("sha256").update(normalized).digest("hex");
}

function encryptionKey(): Buffer {
  const secret = process.env.AUTH_SECRET ?? "insecure-dev-secret";
  return crypto.scryptSync(secret, "team-join-code", 32);
}

/** Reversible copy so captains can view/copy their code again later. */
export function encryptJoinCode(normalized: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const enc = Buffer.concat([cipher.update(normalized, "utf8"), cipher.final()]);
  return `${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${enc.toString("base64url")}`;
}

export function decryptJoinCode(cipherText: string): string | null {
  try {
    const [ivB64, tagB64, dataB64] = cipherText.split(".");
    if (!ivB64 || !tagB64 || !dataB64) return null;
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      encryptionKey(),
      Buffer.from(ivB64, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return null; // legacy rows ('legacy') or key rotation — captain must regenerate
  }
}

/** "X7K4P9Q2" → "X7K4-P9Q2" for display. */
export function formatJoinCode(normalized: string): string {
  return normalized.slice(0, 4) + "-" + normalized.slice(4);
}
