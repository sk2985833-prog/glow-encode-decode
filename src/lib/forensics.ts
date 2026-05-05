/**
 * Text forensics: entropy, encoding detection, character distribution.
 * All logic is real — no simulated data.
 */

/** Shannon entropy of a string (bits per character). */
export function textEntropy(input: string): number {
  if (!input.length) return 0;
  const freq = new Map<string, number>();
  for (const ch of input) freq.set(ch, (freq.get(ch) || 0) + 1);
  let entropy = 0;
  for (const count of freq.values()) {
    const p = count / input.length;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

/** Character class distribution breakdown. */
export interface CharDistribution {
  uppercase: number;
  lowercase: number;
  digits: number;
  whitespace: number;
  punctuation: number;
  control: number;
  extended: number;
  total: number;
}

export function charDistribution(input: string): CharDistribution {
  const d: CharDistribution = { uppercase: 0, lowercase: 0, digits: 0, whitespace: 0, punctuation: 0, control: 0, extended: 0, total: input.length };
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    if (c >= 65 && c <= 90) d.uppercase++;
    else if (c >= 97 && c <= 122) d.lowercase++;
    else if (c >= 48 && c <= 57) d.digits++;
    else if (c === 32 || c === 9 || c === 10 || c === 13) d.whitespace++;
    else if (c >= 33 && c <= 126) d.punctuation++;
    else if (c < 32) d.control++;
    else d.extended++;
  }
  return d;
}

/** Encoding likelihood scores (0-1). */
export interface EncodingLikelihood {
  base64: number;
  hex: number;
  url: number;
  plaintext: number;
  binary: number;
}

export function detectEncoding(input: string): EncodingLikelihood {
  const trimmed = input.trim();
  if (!trimmed.length) return { base64: 0, hex: 0, url: 0, plaintext: 1, binary: 0 };

  // Base64: [A-Za-z0-9+/=] with optional line breaks
  const b64Clean = trimmed.replace(/[\r\n\s]/g, "");
  const b64Chars = b64Clean.replace(/[A-Za-z0-9+/=]/g, "").length;
  const b64Ratio = b64Clean.length > 0 ? 1 - b64Chars / b64Clean.length : 0;
  const b64LenOk = b64Clean.length % 4 === 0 && b64Clean.length >= 4;
  const base64 = b64Ratio > 0.95 && b64LenOk ? Math.min(1, b64Ratio * (b64Clean.length > 8 ? 1 : 0.5)) : b64Ratio * 0.3;

  // Hex: [0-9a-fA-F] possibly with spaces or 0x prefix
  const hexClean = trimmed.replace(/[\s0x]/gi, "");
  const hexChars = hexClean.replace(/[0-9a-fA-F]/g, "").length;
  const hexRatio = hexClean.length > 0 ? 1 - hexChars / hexClean.length : 0;
  const hexLenOk = hexClean.length % 2 === 0 && hexClean.length >= 2;
  const hex = hexRatio > 0.95 && hexLenOk ? Math.min(1, hexRatio * (hexClean.length > 4 ? 1 : 0.4)) : hexRatio * 0.2;

  // URL encoding: contains %XX sequences
  const urlMatches = trimmed.match(/%[0-9a-fA-F]{2}/g);
  const url = urlMatches ? Math.min(1, urlMatches.length / (trimmed.length / 3) * 0.8) : 0;

  // Binary: contains non-printable characters
  const nonPrintable = trimmed.replace(/[\x20-\x7E\r\n\t]/g, "").length;
  const binary = nonPrintable / trimmed.length;

  const plaintext = Math.max(0, 1 - Math.max(base64, hex, url, binary));

  return { base64, hex, url, plaintext, binary };
}

/** Format a forensics report as structured text. */
export function formatForensicsReport(input: string): {
  entropy: number;
  distribution: CharDistribution;
  encoding: EncodingLikelihood;
  topEncoding: string;
} {
  const entropy = textEntropy(input);
  const distribution = charDistribution(input);
  const encoding = detectEncoding(input);
  const entries = Object.entries(encoding) as [string, number][];
  const topEncoding = entries.reduce((a, b) => (b[1] > a[1] ? b : a))[0];
  return { entropy, distribution, encoding, topEncoding };
}

/** Generate a SHA-256 hash of a string and return hex. */
export async function sha256Report(data: string): Promise<string> {
  const bytes = new TextEncoder().encode(data);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");
}