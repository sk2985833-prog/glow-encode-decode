// Steganography utilities for LSB encoding/decoding

export type EncodingMode = 'lsb' | 'multi-bit' | 'random-pixel' | 'edge-based';

/** Bits per blue-channel pixel for the standard LSB mode. 1 = safest, 4 = max capacity but visible. */
export type LsbDepth = 1 | 2 | 3 | 4;
export const DEFAULT_LSB_DEPTH: LsbDepth = 1;

/** Qualitative reliability rating per depth. */
export function lsbReliability(depth: LsbDepth): { label: string; tone: "safe" | "ok" | "warn" | "risk"; note: string } {
  switch (depth) {
    case 1: return { label: "Excellent",   tone: "safe", note: "Imperceptible · max robustness · standard LSB" };
    case 2: return { label: "Good",        tone: "ok",   note: "≈2× capacity · minor χ² signature increase" };
    case 3: return { label: "Marginal",    tone: "warn", note: "≈3× capacity · visible on flat regions, detectable" };
    case 4: return { label: "Poor",        tone: "risk", note: "4× capacity · visible artifacts · trivially detectable" };
  }
}

export function stringToUint8Array(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

export function uint8ToBitArray(u8: Uint8Array): number[] {
  const bits: number[] = [];
  for (let i = 0; i < u8.length; i++) {
    for (let b = 7; b >= 0; b--) {
      bits.push((u8[i] >> b) & 1);
    }
  }
  return bits;
}

export function bitsToUint8Array(bits: number[]): Uint8Array {
  const bytes = new Uint8Array(Math.ceil(bits.length / 8));
  for (let i = 0; i < bytes.length; i++) {
    let val = 0;
    for (let b = 0; b < 8; b++) {
      const bit = bits[i * 8 + b];
      if (typeof bit === 'undefined') break;
      val = (val << 1) | bit;
    }
    bytes[i] = val;
  }
  return bytes;
}

// --- Standard LSB (Blue channel) ---
export function writeBitsToImageData(
  imgData: ImageData,
  bits: number[],
  onProgress?: (progress: number) => void,
  mode: EncodingMode = 'lsb',
  key?: number,
  depth: LsbDepth = DEFAULT_LSB_DEPTH
): ImageData {
  switch (mode) {
    case 'multi-bit':
      return writeBitsMultiBit(imgData, bits, onProgress);
    case 'random-pixel':
      return writeBitsRandomPixel(imgData, bits, onProgress, key, depth);
    case 'edge-based':
      return writeBitsEdgeBased(imgData, bits, onProgress, depth);
    default:
      return writeBitsLSB(imgData, bits, onProgress, depth);
  }
}

function writeBitsLSB(imgData: ImageData, bits: number[], onProgress?: (progress: number) => void, depth: LsbDepth = DEFAULT_LSB_DEPTH): ImageData {
  const data = imgData.data;
  const total = bits.length;
  const mask = 0xff << depth & 0xff; // clear lowest `depth` bits
  let bi = 0;
  let px = 0;
  while (bi < total) {
    const idx = px * 4 + 2; // Blue channel
    let pack = 0;
    let written = 0;
    for (let d = depth - 1; d >= 0 && bi < total; d--) {
      pack |= (bits[bi++] & 1) << d;
      written++;
    }
    // pad unused low bits with the original to minimize visible disturbance
    if (written < depth) {
      const origLow = data[idx] & ((1 << (depth - written)) - 1);
      pack = (pack & ~((1 << (depth - written)) - 1)) | origLow;
    }
    data[idx] = (data[idx] & mask) | pack;
    px++;
    if (onProgress && (px & 1023) === 0) onProgress(Math.floor((bi / total) * 100));
  }
  if (onProgress) onProgress(100);
  return imgData;
}

// --- Multi-bit LSB (2 bits in R, G, B channels) ---
function writeBitsMultiBit(imgData: ImageData, bits: number[], onProgress?: (progress: number) => void): ImageData {
  const data = imgData.data;
  const total = bits.length;
  let bitIdx = 0;
  for (let px = 0; px < data.length && bitIdx < total; px += 4) {
    // 2 bits in R
    if (bitIdx < total) { data[px] = (data[px] & 0xfc) | ((bits[bitIdx] << 1) | (bits[bitIdx + 1] || 0)); bitIdx += 2; }
    // 2 bits in G
    if (bitIdx < total) { data[px + 1] = (data[px + 1] & 0xfc) | ((bits[bitIdx] << 1) | (bits[bitIdx + 1] || 0)); bitIdx += 2; }
    // 2 bits in B
    if (bitIdx < total) { data[px + 2] = (data[px + 2] & 0xfc) | ((bits[bitIdx] << 1) | (bits[bitIdx + 1] || 0)); bitIdx += 2; }
    if (onProgress && px % 4000 === 0) onProgress(Math.floor((bitIdx / total) * 100));
  }
  if (onProgress) onProgress(100);
  return imgData;
}

// --- Random Pixel LSB (key-based pseudo-random order) ---
function seededShuffle(length: number, seed: number): number[] {
  const indices = Array.from({ length }, (_, i) => i);
  let s = seed;
  for (let i = indices.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    const j = Math.abs(s) % (i + 1);
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices;
}

function writeBitsRandomPixel(imgData: ImageData, bits: number[], onProgress?: (progress: number) => void, key?: number, depth: LsbDepth = DEFAULT_LSB_DEPTH): ImageData {
  const data = imgData.data;
  const total = bits.length;
  const pixelCount = data.length / 4;
  const seed = key || 483920;
  const order = seededShuffle(pixelCount, seed);
  const mask = 0xff << depth & 0xff;
  let bi = 0;
  let oi = 0;
  while (bi < total) {
    const idx = order[oi++] * 4 + 2;
    let pack = 0;
    for (let d = depth - 1; d >= 0 && bi < total; d--) pack |= (bits[bi++] & 1) << d;
    data[idx] = (data[idx] & mask) | pack;
    if (onProgress && (oi & 1023) === 0) onProgress(Math.floor((bi / total) * 100));
  }
  if (onProgress) onProgress(100);
  return imgData;
}

// --- Edge-based embedding (hide in high-contrast edges) ---
function writeBitsEdgeBased(imgData: ImageData, bits: number[], onProgress?: (progress: number) => void, depth: LsbDepth = DEFAULT_LSB_DEPTH): ImageData {
  const data = imgData.data;
  const w = imgData.width;
  const total = bits.length;
  
  // Find edge pixels (high gradient magnitude)
  const edgePixels: number[] = [];
  for (let y = 1; y < imgData.height - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = (y * w + x) * 4;
      const left = data[idx - 4] + data[idx - 3] + data[idx - 2];
      const right = data[idx + 4] + data[idx + 5] + data[idx + 6];
      const top = data[((y - 1) * w + x) * 4] + data[((y - 1) * w + x) * 4 + 1] + data[((y - 1) * w + x) * 4 + 2];
      const bottom = data[((y + 1) * w + x) * 4] + data[((y + 1) * w + x) * 4 + 1] + data[((y + 1) * w + x) * 4 + 2];
      const gradient = Math.abs(right - left) + Math.abs(bottom - top);
      if (gradient > 30) edgePixels.push(idx);
    }
  }
  
  // Fallback to standard if not enough edges (per-pixel capacity = depth)
  if (edgePixels.length * depth < total) {
    return writeBitsLSB(imgData, bits, onProgress, depth);
  }

  const mask = 0xff << depth & 0xff;
  let bi = 0;
  let ei = 0;
  while (bi < total) {
    const idx = edgePixels[ei++] + 2;
    let pack = 0;
    for (let d = depth - 1; d >= 0 && bi < total; d--) pack |= (bits[bi++] & 1) << d;
    data[idx] = (data[idx] & mask) | pack;
    if (onProgress && (ei & 1023) === 0) onProgress(Math.floor((bi / total) * 100));
  }
  if (onProgress) onProgress(100);
  return imgData;
}

// --- Reading ---
export function readBitsFromImageData(
  imgData: ImageData,
  bitCount: number,
  mode: EncodingMode = 'lsb',
  key?: number,
  depth: LsbDepth = DEFAULT_LSB_DEPTH
): number[] {
  switch (mode) {
    case 'multi-bit':
      return readBitsMultiBit(imgData, bitCount);
    case 'random-pixel':
      return readBitsRandomPixel(imgData, bitCount, key, depth);
    case 'edge-based':
      return readBitsEdgeBased(imgData, bitCount, depth);
    default:
      return readBitsLSB(imgData, bitCount, depth);
  }
}

function readBitsLSB(imgData: ImageData, bitCount: number, depth: LsbDepth = DEFAULT_LSB_DEPTH): number[] {
  const data = imgData.data;
  const bits: number[] = [];
  let px = 0;
  while (bits.length < bitCount) {
    const v = data[px * 4 + 2];
    for (let d = depth - 1; d >= 0 && bits.length < bitCount; d--) bits.push((v >> d) & 1);
    px++;
  }
  return bits;
}

function readBitsMultiBit(imgData: ImageData, bitCount: number): number[] {
  const data = imgData.data;
  const bits: number[] = [];
  for (let px = 0; px < data.length && bits.length < bitCount; px += 4) {
    // R
    if (bits.length < bitCount) { bits.push((data[px] >> 1) & 1); if (bits.length < bitCount) bits.push(data[px] & 1); }
    // G
    if (bits.length < bitCount) { bits.push((data[px + 1] >> 1) & 1); if (bits.length < bitCount) bits.push(data[px + 1] & 1); }
    // B
    if (bits.length < bitCount) { bits.push((data[px + 2] >> 1) & 1); if (bits.length < bitCount) bits.push(data[px + 2] & 1); }
  }
  return bits;
}

function readBitsRandomPixel(imgData: ImageData, bitCount: number, key?: number, depth: LsbDepth = DEFAULT_LSB_DEPTH): number[] {
  const data = imgData.data;
  const pixelCount = data.length / 4;
  const seed = key || 483920;
  const order = seededShuffle(pixelCount, seed);
  const bits: number[] = [];
  let oi = 0;
  while (bits.length < bitCount) {
    const v = data[order[oi++] * 4 + 2];
    for (let d = depth - 1; d >= 0 && bits.length < bitCount; d--) bits.push((v >> d) & 1);
  }
  return bits;
}

function readBitsEdgeBased(imgData: ImageData, bitCount: number, depth: LsbDepth = DEFAULT_LSB_DEPTH): number[] {
  const data = imgData.data;
  const w = imgData.width;
  const edgePixels: number[] = [];
  for (let y = 1; y < imgData.height - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = (y * w + x) * 4;
      const left = data[idx - 4] + data[idx - 3] + data[idx - 2];
      const right = data[idx + 4] + data[idx + 5] + data[idx + 6];
      const top = data[((y - 1) * w + x) * 4] + data[((y - 1) * w + x) * 4 + 1] + data[((y - 1) * w + x) * 4 + 2];
      const bottom = data[((y + 1) * w + x) * 4] + data[((y + 1) * w + x) * 4 + 1] + data[((y + 1) * w + x) * 4 + 2];
      const gradient = Math.abs(right - left) + Math.abs(bottom - top);
      if (gradient > 30) edgePixels.push(idx);
    }
  }
  if (edgePixels.length * depth < bitCount) return readBitsLSB(imgData, bitCount, depth);
  const bits: number[] = [];
  let ei = 0;
  while (bits.length < bitCount) {
    const v = data[edgePixels[ei++] + 2];
    for (let d = depth - 1; d >= 0 && bits.length < bitCount; d--) bits.push((v >> d) & 1);
  }
  return bits;
}

// Crypto helpers
export async function deriveKeyFromPassword(password: string, salt: BufferSource): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveKey']
  );
  return await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: 250000, hash: 'SHA-256' },
    keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
  );
}

export async function encryptMessage(password: string, plaintext: string): Promise<string> {
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKeyFromPassword(password, salt);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plaintext));
  const payload = new Uint8Array(salt.byteLength + iv.byteLength + ct.byteLength);
  payload.set(salt, 0);
  payload.set(iv, salt.byteLength);
  payload.set(new Uint8Array(ct), salt.byteLength + iv.byteLength);
  return btoa(String.fromCharCode(...Array.from(payload)));
}

export async function decryptMessage(password: string, b64payload: string): Promise<string> {
  const binary = atob(b64payload);
  const arr = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
  const salt = arr.slice(0, 16);
  const iv = arr.slice(16, 28);
  const ct = arr.slice(28).buffer;
  const key = await deriveKeyFromPassword(password, salt);
  const dec = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
  return new TextDecoder().decode(dec);
}

export function calculateCapacity(width: number, height: number, mode: EncodingMode = 'lsb', depth: LsbDepth = DEFAULT_LSB_DEPTH): number {
  const pixels = width * height;
  switch (mode) {
    case 'multi-bit':
      return Math.floor((pixels * 6 - 32) / 8); // 6 bits per pixel (2 per channel)
    case 'random-pixel':
    case 'edge-based':
    default:
      return Math.floor((pixels * depth - 32) / 8); // depth bits per pixel
  }
}

export function generatePassword(length: number = 16): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@#$%&*';
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[array[i] % chars.length];
  }
  return result;
}

// --- SHA-256 integrity helpers ---
export async function sha256Hex(data: Uint8Array | string): Promise<string> {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// --- Steganalysis utilities ---
export function calculateEntropy(data: Uint8ClampedArray, channel: number): number {
  const freq = new Float64Array(256);
  const pixelCount = data.length / 4;
  for (let i = 0; i < data.length; i += 4) {
    freq[data[i + channel]]++;
  }
  let entropy = 0;
  for (let i = 0; i < 256; i++) {
    if (freq[i] > 0) {
      const p = freq[i] / pixelCount;
      entropy -= p * Math.log2(p);
    }
  }
  return entropy;
}

export function calculateLSBRandomness(data: Uint8ClampedArray, channel: number): number {
  let flips = 0;
  let lastBit = data[channel] & 1;
  const pixelCount = data.length / 4;
  for (let i = 4; i < data.length; i += 4) {
    const bit = data[i + channel] & 1;
    if (bit !== lastBit) flips++;
    lastBit = bit;
  }
  // Perfect random would be ~0.5 flip rate
  return flips / (pixelCount - 1);
}

export function getHistogram(data: Uint8ClampedArray, channel: number): number[] {
  const hist = new Array(256).fill(0);
  for (let i = 0; i < data.length; i += 4) {
    hist[data[i + channel]]++;
  }
  return hist;
}

export function detectChiSquare(data: Uint8ClampedArray, channel: number): number {
  const hist = getHistogram(data, channel);
  let chi = 0;
  let pairs = 0;
  // Compare pairs of values (2i, 2i+1) - PoV test
  for (let i = 0; i < 256; i += 2) {
    const expected = (hist[i] + hist[i + 1]) / 2;
    if (expected > 0) {
      chi += Math.pow(hist[i] - expected, 2) / expected;
      chi += Math.pow(hist[i + 1] - expected, 2) / expected;
      pairs++;
    }
  }
  return pairs > 0 ? chi / pairs : 0;
}

// --- Metadata extraction ---
export function extractEXIF(arrayBuffer: ArrayBuffer): Record<string, string> {
  const view = new DataView(arrayBuffer);
  const result: Record<string, string> = {};
  
  // Check JPEG SOI marker
  if (view.getUint16(0) !== 0xFFD8) {
    result['Format'] = 'Not JPEG (no EXIF)';
    return result;
  }
  
  let offset = 2;
  while (offset < view.byteLength - 2) {
    const marker = view.getUint16(offset);
    if (marker === 0xFFE1) { // APP1 (EXIF)
      const length = view.getUint16(offset + 2);
      // Check for "Exif\0\0"
      const exifHeader = String.fromCharCode(
        view.getUint8(offset + 4), view.getUint8(offset + 5),
        view.getUint8(offset + 6), view.getUint8(offset + 7)
      );
      if (exifHeader === 'Exif') {
        result['EXIF'] = 'Present';
        result['EXIF Data Size'] = `${length} bytes`;
        // Parse TIFF header
        const tiffOffset = offset + 10;
        const bigEndian = view.getUint16(tiffOffset) === 0x4D4D;
        result['Byte Order'] = bigEndian ? 'Big Endian (Motorola)' : 'Little Endian (Intel)';
        
        try {
          const ifdOffset = bigEndian ? view.getUint32(tiffOffset + 4) : view.getUint32(tiffOffset + 4, true);
          const tagCount = bigEndian ? view.getUint16(tiffOffset + ifdOffset) : view.getUint16(tiffOffset + ifdOffset, true);
          result['IFD Tags'] = `${tagCount} tags found`;
          
          for (let i = 0; i < Math.min(tagCount, 20); i++) {
            const entryOffset = tiffOffset + ifdOffset + 2 + i * 12;
            if (entryOffset + 12 > view.byteLength) break;
            const tag = bigEndian ? view.getUint16(entryOffset) : view.getUint16(entryOffset, true);
            const tagNames: Record<number, string> = {
              0x010F: 'Camera Make', 0x0110: 'Camera Model', 0x0112: 'Orientation',
              0x011A: 'X Resolution', 0x011B: 'Y Resolution', 0x0128: 'Resolution Unit',
              0x0131: 'Software', 0x0132: 'Date/Time', 0x8769: 'EXIF IFD',
              0x8825: 'GPS IFD', 0xA001: 'Color Space', 0xA002: 'Pixel X Dimension',
              0xA003: 'Pixel Y Dimension',
            };
            if (tagNames[tag]) {
              const type = bigEndian ? view.getUint16(entryOffset + 2) : view.getUint16(entryOffset + 2, true);
              const count = bigEndian ? view.getUint32(entryOffset + 4) : view.getUint32(entryOffset + 4, true);
              if (type === 3 && count === 1) { // SHORT
                const val = bigEndian ? view.getUint16(entryOffset + 8) : view.getUint16(entryOffset + 8, true);
                result[tagNames[tag]] = String(val);
              } else if (type === 4 && count === 1) { // LONG
                const val = bigEndian ? view.getUint32(entryOffset + 8) : view.getUint32(entryOffset + 8, true);
                result[tagNames[tag]] = String(val);
              } else if (type === 2) { // ASCII
                if (count <= 4) {
                  let str = '';
                  for (let c = 0; c < count - 1; c++) str += String.fromCharCode(view.getUint8(entryOffset + 8 + c));
                  result[tagNames[tag]] = str;
                } else {
                  const strOffset = bigEndian ? view.getUint32(entryOffset + 8) : view.getUint32(entryOffset + 8, true);
                  let str = '';
                  for (let c = 0; c < Math.min(count - 1, 64); c++) {
                    if (tiffOffset + strOffset + c < view.byteLength) {
                      str += String.fromCharCode(view.getUint8(tiffOffset + strOffset + c));
                    }
                  }
                  result[tagNames[tag]] = str;
                }
              } else {
                result[tagNames[tag]] = 'Found';
              }
            }
          }
        } catch {
          result['Parse Note'] = 'Partial EXIF data extracted';
        }
      }
      break;
    } else if ((marker & 0xFF00) === 0xFF00) {
      const segLength = view.getUint16(offset + 2);
      offset += 2 + segLength;
    } else {
      break;
    }
  }
  
  if (Object.keys(result).length === 0) {
    result['EXIF'] = 'Not found';
    result['Note'] = 'PNG/BMP files typically do not contain EXIF data';
  }
  
  return result;
}

// --- Attack simulation ---
export function simulateJPEGCompression(canvas: HTMLCanvasElement, quality: number): Promise<HTMLCanvasElement> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) { resolve(canvas); return; }
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = canvas.width;
        c.height = canvas.height;
        const ctx = c.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
        resolve(c);
      };
      img.src = url;
    }, 'image/jpeg', quality);
  });
}

export function simulateResize(canvas: HTMLCanvasElement, scale: number): HTMLCanvasElement {
  const c1 = document.createElement('canvas');
  c1.width = Math.round(canvas.width * scale);
  c1.height = Math.round(canvas.height * scale);
  const ctx1 = c1.getContext('2d')!;
  ctx1.drawImage(canvas, 0, 0, c1.width, c1.height);
  // Scale back
  const c2 = document.createElement('canvas');
  c2.width = canvas.width;
  c2.height = canvas.height;
  const ctx2 = c2.getContext('2d')!;
  ctx2.drawImage(c1, 0, 0, c2.width, c2.height);
  return c2;
}

export function simulateNoise(canvas: HTMLCanvasElement, intensity: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = canvas.width;
  c.height = canvas.height;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(canvas, 0, 0);
  const imgData = ctx.getImageData(0, 0, c.width, c.height);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.max(0, Math.min(255, data[i] + (Math.random() - 0.5) * intensity * 2));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + (Math.random() - 0.5) * intensity * 2));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + (Math.random() - 0.5) * intensity * 2));
  }
  ctx.putImageData(imgData, 0, 0);
  return c;
}
