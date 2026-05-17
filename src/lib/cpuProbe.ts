/**
 * Cross-thread CPU pressure probe.
 *
 * A dedicated Web Worker schedules its own 200ms timer and reports drift back to
 * the main thread. Because the worker has its own event loop, any drift it sees
 * reflects real OS-level scheduling pressure rather than only main-thread JS work.
 * Combined with the main-thread drift sampler, this gives a much more honest
 * "is the machine actually busy?" signal than either source alone.
 */

const WORKER_SRC = `
  let last = performance.now();
  setInterval(() => {
    const now = performance.now();
    const drift = Math.max(0, now - last - 200);
    last = now;
    postMessage(drift);
  }, 200);
`;

export type CpuProbeHandle = {
  stop: () => void;
  burst: (ms: number) => void;
};

export function startCpuProbe(onDrift: (workerDriftMs: number) => void): CpuProbeHandle {
  let worker: Worker | null = null;
  try {
    const blob = new Blob([WORKER_SRC], { type: "application/javascript" });
    const url = URL.createObjectURL(blob);
    worker = new Worker(url);
    worker.onmessage = (e: MessageEvent<number>) => onDrift(e.data);
  } catch {
    worker = null;
  }
  return {
    stop: () => { try { worker?.terminate(); } catch { /* noop */ } },
    /** Run a synthetic main-thread CPU burst — used by the realism/test mode. */
    burst: (ms: number) => {
      const end = performance.now() + ms;
      // Busy-loop in slices so we don't completely freeze paint
      const slice = () => {
        const sliceEnd = Math.min(performance.now() + 40, end);
        while (performance.now() < sliceEnd) {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          let _x = 0;
          for (let i = 0; i < 1_000_00; i++) _x += Math.sqrt(i);
        }
        if (performance.now() < end) setTimeout(slice, 10);
      };
      slice();
    },
  };
}