import { createCipheriv, createDecipheriv, randomBytes, createHash } from "node:crypto";

const ALGO = "aes-256-gcm";

const normalizeKey = (raw: string): Buffer => {
  const trimmed = raw.trim();

  try {
    const maybeBase64 = Buffer.from(trimmed, "base64");
    if (maybeBase64.length === 32) {
      return maybeBase64;
    }
  } catch {
    // Ignore and continue with UTF-8/hash fallback.
  }

  const utf8 = Buffer.from(trimmed, "utf8");
  if (utf8.length === 32) {
    return utf8;
  }

  return createHash("sha256").update(utf8).digest();
};

export class CryptoBox {
  private readonly key: Buffer;

  constructor(secret: string) {
    this.key = normalizeKey(secret);
  }

  encrypt(plainText: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv(ALGO, this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
  }

  decrypt(sealed: string): string {
    const [ivB64, tagB64, dataB64] = sealed.split(":");
    if (!ivB64 || !tagB64 || !dataB64) {
      throw new Error("Invalid encrypted payload format");
    }

    const iv = Buffer.from(ivB64, "base64");
    const tag = Buffer.from(tagB64, "base64");
    const encrypted = Buffer.from(dataB64, "base64");

    const decipher = createDecipheriv(ALGO, this.key, iv);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return plain.toString("utf8");
  }
}
