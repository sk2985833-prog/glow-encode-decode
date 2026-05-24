/**
 * Operational identity — sessionId, tabId, and request-ID factory.
 *
 * - sessionId persists in localStorage  → stable across reloads, shared by all tabs.
 * - tabId persists in sessionStorage    → unique per tab, cleared when the tab closes.
 * - requestId / rootRequestId are minted via crypto.randomUUID + a per-tab monotonic
 *   counter so two tabs cannot collide even if they fire ops at the same instant.
 *
 * A BroadcastChannel ("steglab-ops") is exposed so any module can publish op
 * lifecycle events to peer tabs and react to them — preventing duplicate
 * polling, desynced graphs, and crossed responses across tabs of the same
 * session.
 */

const SESSION_KEY = "steglab.sessionId.v1";
const TAB_KEY = "steglab.tabId.v1";

function uuid(): string {
  try { return crypto.randomUUID(); }
  catch {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0"));
    return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
  }
}

function readOrCreate(storage: Storage, key: string, prefix: string): string {
  try {
    const existing = storage.getItem(key);
    if (existing && existing.length > 8) return existing;
    const fresh = `${prefix}-${uuid()}`;
    storage.setItem(key, fresh);
    return fresh;
  } catch {
    // Private mode / disabled storage — degrade to in-memory.
    return `${prefix}-${uuid()}`;
  }
}

/** Stable across reloads & tabs of the same browser profile. */
export const sessionId: string = (() => {
  if (typeof window === "undefined") return `SES-${uuid()}`;
  return readOrCreate(window.localStorage, SESSION_KEY, "SES");
})();

/** Unique per browser tab. Cleared when the tab is closed. */
export const tabId: string = (() => {
  if (typeof window === "undefined") return `TAB-${uuid()}`;
  return readOrCreate(window.sessionStorage, TAB_KEY, "TAB");
})();

/** Short, human-friendly session label for the UI ("SL-2026-AB12CD"). */
export const sessionLabel: string = (() => {
  const tail = sessionId.slice(-6).toUpperCase();
  return `SL-${new Date().getFullYear()}-${tail}`;
})();

let counter = 0;
/**
 * Mint a globally-unique request ID. Combines the tab ID with a UUID so two
 * tabs in the same session cannot collide even at identical timestamps.
 */
export function newRequestId(): string {
  counter++;
  const seq = counter.toString().padStart(4, "0");
  return `${tabId}-${seq}-${uuid().slice(0, 8)}`;
}

export function newPipelineId(): string {
  return `PIPE-${tabId}-${uuid().slice(0, 12)}`;
}

/* ------------------------------------------------------------------ */
/* Cross-tab coordination                                              */
/* ------------------------------------------------------------------ */

export type CrossTabEvent =
  | { kind: "op-begin"; tabId: string; shortId: string; module: string; at: number }
  | { kind: "op-end"; tabId: string; shortId: string; status: string; at: number }
  | { kind: "hello"; tabId: string; at: number };

type Listener = (evt: CrossTabEvent) => void;

let channel: BroadcastChannel | null = null;
const listeners = new Set<Listener>();

if (typeof BroadcastChannel !== "undefined") {
  try {
    channel = new BroadcastChannel("steglab-ops");
    channel.onmessage = (e: MessageEvent<CrossTabEvent>) => {
      // Ignore our own messages — BroadcastChannel does this already, but defend
      // in depth in case a future polyfill echoes back.
      if (e.data?.tabId === tabId) return;
      for (const l of listeners) {
        try { l(e.data); } catch { /* listener errors must not break the bus */ }
      }
    };
    // Announce presence so peers can update their "active tabs" counts.
    channel.postMessage({ kind: "hello", tabId, at: Date.now() });
  } catch {
    channel = null;
  }
}

export function broadcast(evt: CrossTabEvent): void {
  if (!channel) return;
  try { channel.postMessage(evt); } catch { /* noop */ }
}

export function onCrossTab(fn: Listener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

// Best-effort cleanup so the channel doesn't leak if the page is hot-reloaded.
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    try { channel?.close(); } catch { /* noop */ }
  });
}