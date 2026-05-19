/**
 * Operations orchestrator — single source of truth for every async op the app runs.
 *
 * Every encode/decode/analyze/export goes through `beginOp` → trace stages → `endOp`.
 * This removes the brittle "parse strings out of log messages to drive UI state"
 * pattern that previously caused the ACTIVE indicator to flicker and OP IDs to
 * desync across modules.
 *
 * - Monotonic, collision-free request IDs scoped to a session.
 * - Per-op trace log of real processing stages (no setTimeout placeholders).
 * - Deterministic dwell on completion so the UI can actually render the 100% state.
 * - Pub/sub so any component can observe op lifecycle without prop drilling.
 */

export type OpModule = "AES" | "STEG" | "ANALYSIS" | "EXPORT" | "SYSTEM" | "WIPE";
export type OpStatus = "running" | "ok" | "error";

export interface OpTrace {
  stage: string;
  at: number; // performance.now()
  detail?: string;
}

export interface OpRecord {
  /** Internal UUID — globally unique even across sessions. */
  uuid: string;
  /** Display ID — e.g. "SL-2026-ABC123-0007". */
  requestId: string;
  /** Short ID for status bar — e.g. "OP-07". */
  shortId: string;
  /** Root request ID (== requestId unless this is a child op). */
  rootRequestId: string;
  module: OpModule;
  label: string;
  status: OpStatus;
  startTime: number;       // performance.now()
  startedAt: number;       // Date.now()
  endTime?: number;
  endedAt?: number;
  duration?: number;
  trace: OpTrace[];
  error?: string;
}

export type OpEvent =
  | { kind: "begin"; op: OpRecord }
  | { kind: "trace"; op: OpRecord; entry: OpTrace }
  | { kind: "end"; op: OpRecord };

type Listener = (evt: OpEvent) => void;

class OpsOrchestrator {
  private sessionId = "";
  private counter = 0;
  private byId = new Map<string, OpRecord>();
  private listeners = new Set<Listener>();

  init(sessionId: string) {
    this.sessionId = sessionId;
    this.counter = 0;
    this.byId.clear();
  }

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(evt: OpEvent) {
    // Defensive copy — listeners must not mutate the record.
    for (const l of this.listeners) {
      try { l(evt); } catch { /* listener errors must not break op flow */ }
    }
  }

  begin(module: OpModule, label: string, parentId?: string): OpRecord {
    this.counter++;
    const seq = this.counter.toString().padStart(4, "0");
    const requestId = `${this.sessionId || "NO-SESSION"}-${seq}`;
    const shortId = `OP-${seq.slice(-2)}`;
    const parent = parentId ? this.byId.get(parentId) : undefined;
    const op: OpRecord = {
      uuid: cryptoUuid(),
      requestId,
      shortId,
      rootRequestId: parent?.rootRequestId ?? requestId,
      module,
      label,
      status: "running",
      startTime: performance.now(),
      startedAt: Date.now(),
      trace: [{ stage: "begin", at: performance.now(), detail: label }],
    };
    this.byId.set(op.uuid, op);
    this.emit({ kind: "begin", op });
    return op;
  }

  trace(uuid: string, stage: string, detail?: string) {
    const op = this.byId.get(uuid);
    if (!op || op.status !== "running") return;
    const entry: OpTrace = { stage, at: performance.now(), detail };
    op.trace.push(entry);
    this.emit({ kind: "trace", op, entry });
  }

  end(uuid: string, status: OpStatus = "ok", error?: string) {
    const op = this.byId.get(uuid);
    if (!op || op.status !== "running") return;
    op.status = status;
    op.error = error;
    op.endTime = performance.now();
    op.endedAt = Date.now();
    op.duration = op.endTime - op.startTime;
    op.trace.push({ stage: `end:${status}`, at: op.endTime, detail: error });
    this.emit({ kind: "end", op });
  }

  /** Snapshot of every op recorded in this session. */
  list(): OpRecord[] {
    return Array.from(this.byId.values()).sort((a, b) => a.startTime - b.startTime);
  }

  count() { return this.byId.size; }
}

function cryptoUuid(): string {
  try { return crypto.randomUUID(); }
  catch { return `op-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`; }
}

/** Singleton — every module in the app shares this. */
export const ops = new OpsOrchestrator();

/**
 * Convenience wrapper: run an async function as a tracked op.
 * Auto-ends on success or error; rethrows so callers can still react.
 */
export async function runOp<T>(
  module: OpModule,
  label: string,
  fn: (op: OpRecord, trace: (stage: string, detail?: string) => void) => Promise<T>,
): Promise<{ op: OpRecord; value: T }> {
  const op = ops.begin(module, label);
  const trace = (stage: string, detail?: string) => ops.trace(op.uuid, stage, detail);
  try {
    const value = await fn(op, trace);
    ops.end(op.uuid, "ok");
    return { op, value };
  } catch (err) {
    ops.end(op.uuid, "error", (err as Error)?.message ?? String(err));
    throw err;
  }
}