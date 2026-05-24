import {
  bitsToUint8Array,
  calculateEntropy,
  calculateLSBRandomness,
  detectChiSquare,
  getHistogram,
  readBitsFromImageData,
  writeBitsToImageData,
  type EncodingMode,
  type LsbDepth,
  DEFAULT_LSB_DEPTH,
} from "./steganography";

type TaskMessage =
  | { id: string; type: "writeBits"; width: number; height: number; buffer: ArrayBuffer; bits: number[]; mode: EncodingMode; key?: number; depth: LsbDepth }
  | { id: string; type: "readPayloadAuto"; width: number; height: number; buffer: ArrayBuffer; key?: number }
  | { id: string; type: "steganalysis"; width: number; height: number; buffer: ArrayBuffer }
  | { id: string; type: "pixelView"; width: number; height: number; buffer: ArrayBuffer; mode: "rgb" | "red" | "green" | "blue" | "lsb-map" | "lsb-blue" };

const ctx = self as unknown as { postMessage: (message: unknown, transfer?: Transferable[]) => void; onmessage: ((event: MessageEvent<TaskMessage>) => void) | null };

function imageData(width: number, height: number, buffer: ArrayBuffer): ImageData {
  return new ImageData(new Uint8ClampedArray(buffer), width, height);
}

function tryReadHeader(imgData: ImageData, mode: EncodingMode, key?: number, depth: LsbDepth = DEFAULT_LSB_DEPTH) {
  try {
    const headerBits = readBitsFromImageData(imgData, 32, mode, key, depth);
    const headerBytes = bitsToUint8Array(headerBits);
    const length = (headerBytes[0] << 24) | (headerBytes[1] << 16) | (headerBytes[2] << 8) | headerBytes[3];
    if (length <= 0 || length > 500_000) return { valid: false, length: 0, payload: "" };
    const totalBits = (4 + length) * 8;
    const allBits = readBitsFromImageData(imgData, totalBits, mode, key, depth);
    const allBytes = bitsToUint8Array(allBits);
    const payload = new TextDecoder().decode(allBytes.slice(4));
    const valid = payload.startsWith("MODE:") || payload.startsWith("ENC:") || payload.startsWith("PLAIN:") || payload.startsWith("FILE:");
    return { valid, length, payload };
  } catch {
    return { valid: false, length: 0, payload: "" };
  }
}

function probabilityFromMetrics(entropyB: number, lsbB: number, chiB: number, hist: number[]) {
  let score = 0;
  if (entropyB > 7.5) score += 25;
  else if (entropyB > 7.0) score += 15;
  const lsbDev = Math.abs(lsbB - 0.5);
  if (lsbDev < 0.02) score += 30;
  else if (lsbDev < 0.05) score += 15;
  if (chiB < 1.5) score += 25;
  else if (chiB < 3.0) score += 10;
  let equalPairs = 0;
  for (let i = 0; i < 256; i += 2) if (Math.abs(hist[i] - hist[i + 1]) <= 1) equalPairs++;
  if (equalPairs > 50) score += 20;
  else if (equalPairs > 20) score += 10;
  return Math.min(score, 100);
}

ctx.onmessage = (event: MessageEvent<TaskMessage>) => {
  const task = event.data;
  try {
    if (task.type === "writeBits") {
      const imgData = imageData(task.width, task.height, task.buffer);
      writeBitsToImageData(imgData, task.bits, undefined, task.mode, task.key, task.depth);
      ctx.postMessage({ id: task.id, ok: true, result: { buffer: imgData.data.buffer } }, [imgData.data.buffer]);
      return;
    }

    if (task.type === "readPayloadAuto") {
      const imgData = imageData(task.width, task.height, task.buffer);
      const modes: EncodingMode[] = ["lsb", "multi-bit", "random-pixel", "edge-based"];
      for (const mode of modes) {
        const key = mode === "random-pixel" ? task.key : undefined;
        const depths: LsbDepth[] = mode === "multi-bit" ? [1] : [1, 2, 3, 4];
        for (const depth of depths) {
          const result = tryReadHeader(imgData, mode, key, depth);
          if (result.valid) {
            ctx.postMessage({ id: task.id, ok: true, result: { found: true, mode, depth, ...result } });
            return;
          }
        }
      }
      ctx.postMessage({ id: task.id, ok: true, result: { found: false } });
      return;
    }

    if (task.type === "steganalysis") {
      const data = new Uint8ClampedArray(task.buffer);
      const entropy = { r: calculateEntropy(data, 0), g: calculateEntropy(data, 1), b: calculateEntropy(data, 2) };
      const lsbRandomness = { r: calculateLSBRandomness(data, 0), g: calculateLSBRandomness(data, 1), b: calculateLSBRandomness(data, 2) };
      const chiSquare = { r: detectChiSquare(data, 0), g: detectChiSquare(data, 1), b: detectChiSquare(data, 2) };
      const histogram = getHistogram(data, 2);
      const probability = probabilityFromMetrics(entropy.b, lsbRandomness.b, chiSquare.b, histogram);
      ctx.postMessage({ id: task.id, ok: true, result: { entropy, lsbRandomness, chiSquare, histogram, probability } });
      return;
    }

    if (task.type === "pixelView") {
      const data = new Uint8ClampedArray(task.buffer);
      if (task.mode !== "rgb") {
        for (let i = 0; i < data.length; i += 4) {
          if (task.mode === "red") { data[i + 1] = 0; data[i + 2] = 0; }
          else if (task.mode === "green") { data[i] = 0; data[i + 2] = 0; }
          else if (task.mode === "blue") { data[i] = 0; data[i + 1] = 0; }
          else if (task.mode === "lsb-map") { data[i] = (data[i] & 1) * 255; data[i + 1] = (data[i + 1] & 1) * 255; data[i + 2] = (data[i + 2] & 1) * 255; }
          else if (task.mode === "lsb-blue") { const lsb = data[i + 2] & 1; data[i] = 0; data[i + 1] = lsb * 255; data[i + 2] = lsb * 255; data[i + 3] = 255; }
        }
      }
      ctx.postMessage({ id: task.id, ok: true, result: { buffer: data.buffer } }, [data.buffer]);
    }
  } catch (error) {
    ctx.postMessage({ id: task.id, ok: false, error: (error as Error)?.message ?? String(error) });
  }
};