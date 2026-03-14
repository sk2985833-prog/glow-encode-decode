// Steganography utilities for LSB encoding/decoding

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

export function writeBitsToImageData(
  imgData: ImageData,
  bits: number[],
  onProgress?: (progress: number) => void
): ImageData {
  const data = imgData.data;
  const total = bits.length;
  
  for (let i = 0; i < total; i++) {
    const idx = i * 4 + 2; // Blue channel
    const bit = bits[i];
    data[idx] = (data[idx] & 0xfe) | bit;
    
    if (onProgress && i % 1000 === 0) {
      onProgress(Math.floor((i / total) * 100));
    }
  }
  
  if (onProgress) onProgress(100);
  return imgData;
}

export function readBitsFromImageData(imgData: ImageData, bitCount: number): number[] {
  const data = imgData.data;
  const bits: number[] = [];
  
  for (let i = 0; i < bitCount; i++) {
    const idx = i * 4 + 2; // Blue channel
    bits.push(data[idx] & 1);
  }
  
  return bits;
}

// Crypto helpers
export async function deriveKeyFromPassword(password: string, salt: BufferSource): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
  
  return await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: 250000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
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
  const len = binary.length;
  const arr = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    arr[i] = binary.charCodeAt(i);
  }
  
  const data = arr;
  const salt = data.slice(0, 16);
  const iv = data.slice(16, 28);
  const ct = data.slice(28).buffer;
  
  const key = await deriveKeyFromPassword(password, salt);
  const dec = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
  
  return new TextDecoder().decode(dec);
}

export function calculateCapacity(width: number, height: number): number {
  const pixels = width * height;
  const bitCap = pixels; // 1 bit per pixel
  return Math.floor((bitCap - 32) / 8); // Reserve 32 bits for length header
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
