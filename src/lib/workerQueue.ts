import type { EncodingMode, LsbDepth } from "@/lib/steganography";
import { DEFAULT_LSB_DEPTH } from "@/lib/steganography";

type PixelMode = "rgb" | "red" | "green" | "blue" | "lsb-map" | "lsb-blue";

type WorkerTask =
  | { id: string; type: "writeBits"; width: number; height: number; buffer: ArrayBuffer; bits: number[]; mode: EncodingMode; key?: number; depth: LsbDepth }
  | { id: string; type: "readPayloadAuto"; width: number; height: number; buffer: ArrayBuffer; key?: number }
  | { id: string; type: "steganalysis"; width: number; height: number; buffer: ArrayBuffer }
  | { id: string; type: "pixelView"; width: number; height: number; buffer: ArrayBuffer; mode: PixelMode };

type QueueItem = {
  task: WorkerTask;
  transfer: Transferable[];
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
  signal?: AbortSignal;
};

const MAX_QUEUE = 12;
const MAX_CONCURRENT = 1;

class WorkerQueue {
  private worker: Worker | null = null;
  private queue: QueueItem[] = [];
  private inFlight = new Map<string, QueueItem>();

  run<T>(task: Omit<WorkerTask, "id">, transfer: Transferable[] = [], signal?: AbortSignal): Promise<T> {
    if (signal?.aborted) return Promise.reject(new DOMException("Operation aborted", "AbortError"));
    if (this.queue.length + this.inFlight.size >= MAX_QUEUE) {
      return Promise.reject(new Error("Worker queue overflow — retry after current operations complete"));
    }
    const id = crypto.randomUUID();
    return new Promise<T>((resolve, reject) => {
      const item: QueueItem = { task: { ...task, id } as WorkerTask, transfer, resolve: resolve as (value: unknown) => void, reject, signal };
      const abort = () => {
        this.queue = this.queue.filter((q) => q !== item);
        if (this.inFlight.has(id)) this.restartWorker();
        reject(new DOMException("Operation aborted", "AbortError"));
      };
      signal?.addEventListener("abort", abort, { once: true });
      this.queue.push(item);
      this.pump();
    });
  }

  private getWorker() {
    if (this.worker) return this.worker;
    this.worker = new Worker(new URL("./imageOpsWorker.ts", import.meta.url), { type: "module" });
    this.worker.onmessage = (event: MessageEvent<{ id: string; ok: boolean; result?: unknown; error?: string }>) => {
      const item = this.inFlight.get(event.data.id);
      if (!item) return;
      this.inFlight.delete(event.data.id);
      if (event.data.ok) item.resolve(event.data.result);
      else item.reject(new Error(event.data.error || "Worker task failed"));
      this.pump();
    };
    this.worker.onerror = (event) => {
      const pending = [...this.inFlight.values()];
      this.restartWorker();
      pending.forEach((item) => item.reject(new Error(event.message || "Worker crashed")));
    };
    return this.worker;
  }

  private restartWorker() {
    this.worker?.terminate();
    this.worker = null;
    this.inFlight.clear();
    this.pump();
  }

  private pump() {
    if (this.inFlight.size >= MAX_CONCURRENT) return;
    const item = this.queue.shift();
    if (!item) return;
    if (item.signal?.aborted) {
      item.reject(new DOMException("Operation aborted", "AbortError"));
      this.pump();
      return;
    }
    this.inFlight.set(item.task.id, item);
    this.getWorker().postMessage(item.task, item.transfer);
  }
}

export const workerQueue = new WorkerQueue();

export async function writeBitsOffThread(args: { width: number; height: number; data: Uint8ClampedArray; bits: number[]; mode: EncodingMode; key?: number; depth?: LsbDepth; signal?: AbortSignal }) {
  return workerQueue.run<{ buffer: ArrayBuffer }>({ type: "writeBits", width: args.width, height: args.height, buffer: args.data.buffer as ArrayBuffer, bits: args.bits, mode: args.mode, key: args.key, depth: args.depth ?? DEFAULT_LSB_DEPTH }, [args.data.buffer as ArrayBuffer], args.signal);
}

export async function readPayloadAutoOffThread(args: { width: number; height: number; data: Uint8ClampedArray; key?: number; signal?: AbortSignal }) {
  return workerQueue.run<{ found: boolean; mode?: EncodingMode; depth?: LsbDepth; valid?: boolean; length?: number; payload?: string }>({ type: "readPayloadAuto", width: args.width, height: args.height, buffer: args.data.buffer as ArrayBuffer, key: args.key }, [args.data.buffer as ArrayBuffer], args.signal);
}

export async function steganalysisOffThread(args: { width: number; height: number; data: Uint8ClampedArray; signal?: AbortSignal }) {
  return workerQueue.run<{ entropy: { r: number; g: number; b: number }; lsbRandomness: { r: number; g: number; b: number }; chiSquare: { r: number; g: number; b: number }; histogram: number[]; probability: number }>({ type: "steganalysis", width: args.width, height: args.height, buffer: args.data.buffer as ArrayBuffer }, [args.data.buffer as ArrayBuffer], args.signal);
}

export async function pixelViewOffThread(args: { width: number; height: number; data: Uint8ClampedArray; mode: PixelMode; signal?: AbortSignal }) {
  return workerQueue.run<{ buffer: ArrayBuffer }>({ type: "pixelView", width: args.width, height: args.height, buffer: args.data.buffer as ArrayBuffer, mode: args.mode }, [args.data.buffer as ArrayBuffer], args.signal);
}