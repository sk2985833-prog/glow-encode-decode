import { startCpuProbe, type CpuProbeHandle } from "@/lib/cpuProbe";
import { tabId } from "@/lib/identity";

export type TelemetrySnapshot = {
  at: number;
  sourceTabId: string;
  leaderTabId: string | null;
  isLeader: boolean;
  cpu: { pct: number; supported: boolean; spike: boolean; history: number[] };
  mem: { pct: number; usedMb: number; limitMb: number | null; supported: boolean; spike: boolean; history: number[] };
};

type Thresholds = {
  cpuEnter: number;
  cpuExit: number;
  memEnter: number;
  memExit: number;
  dwellMs: number;
};

export const DEFAULT_TELEMETRY_THRESHOLDS: Thresholds = {
  cpuEnter: 55,
  cpuExit: 35,
  memEnter: 60,
  memExit: 45,
  dwellMs: 1500,
};

const CHANNEL = "steglab-telemetry.v2";
const LEASE_KEY = "steglab.telemetry.leader.v2";
const SNAPSHOT_KEY = "steglab.telemetry.snapshot.v2";
const THRESHOLD_KEY = "steglab.thresholds.v1";
const LEASE_MS = 4_000;
const HISTORY_LIMIT = 60;

type WireMessage =
  | { kind: "snapshot"; snapshot: TelemetrySnapshot }
  | { kind: "leader-release"; tabId: string }
  | { kind: "load-test"; tabId: string; ms: number };

type Listener = (snapshot: TelemetrySnapshot) => void;

function clamp(n: number, lo = 0, hi = 100) { return Math.max(lo, Math.min(hi, n)); }
function avg(values: number[]) { return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0; }

function loadThresholds(): Thresholds {
  try {
    const raw = localStorage.getItem(THRESHOLD_KEY);
    return raw ? { ...DEFAULT_TELEMETRY_THRESHOLDS, ...JSON.parse(raw) } : DEFAULT_TELEMETRY_THRESHOLDS;
  } catch { return DEFAULT_TELEMETRY_THRESHOLDS; }
}

function readStoredSnapshot(): TelemetrySnapshot | null {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TelemetrySnapshot;
    return Date.now() - parsed.at < 10_000 ? parsed : null;
  } catch { return null; }
}

function emptySnapshot(): TelemetrySnapshot {
  return {
    at: Date.now(),
    sourceTabId: tabId,
    leaderTabId: null,
    isLeader: false,
    cpu: { pct: 0, supported: true, spike: false, history: [] },
    mem: { pct: 0, usedMb: 0, limitMb: null, supported: false, spike: false, history: [] },
  };
}

class TelemetryManager {
  private channel: BroadcastChannel | null = null;
  private listeners = new Set<Listener>();
  private snapshot: TelemetrySnapshot = readStoredSnapshot() ?? emptySnapshot();
  private isLeader = false;
  private sampleId: number | null = null;
  private leaseId: number | null = null;
  private workerProbe: CpuProbeHandle | null = null;
  private drift: number[] = [];
  private workerDrift: number[] = [];
  private cpuHistory: number[] = this.snapshot.cpu.history.slice(-HISTORY_LIMIT);
  private memHistory: number[] = this.snapshot.mem.history.slice(-HISTORY_LIMIT);
  private lastTick = 0;
  private tickCount = 0;
  private cpuEma = this.snapshot.cpu.pct || 0;
  private memEma: number | null = this.snapshot.mem.supported ? this.snapshot.mem.pct : null;
  private cpuSpikeSince: number | null = null;
  private memSpikeSince: number | null = null;
  private thresholds = loadThresholds();
  private started = false;

  constructor() {
    if (typeof BroadcastChannel !== "undefined") {
      try {
        this.channel = new BroadcastChannel(CHANNEL);
        this.channel.onmessage = (event: MessageEvent<WireMessage>) => this.onMessage(event.data);
      } catch { this.channel = null; }
    }
    if (typeof window !== "undefined") {
      window.addEventListener("storage", this.onStorage);
      window.addEventListener("beforeunload", this.releaseLeadership);
    }
  }

  getSnapshot() { return this.snapshot; }

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    if (!this.started) this.start();
    listener(this.snapshot);
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) this.stopFollowerTimersOnly();
    };
  }

  setThresholds(thresholds: Thresholds) {
    this.thresholds = thresholds;
    try { localStorage.setItem(THRESHOLD_KEY, JSON.stringify(thresholds)); } catch { /* noop */ }
  }

  getThresholds() { return this.thresholds; }

  requestLoadTest(ms = 2_000) {
    if (this.isLeader) this.workerProbe?.burst(ms);
    else this.post({ kind: "load-test", tabId, ms });
  }

  private start() {
    this.started = true;
    this.electLeader();
    if (this.leaseId == null) {
      this.leaseId = window.setInterval(() => this.electLeader(), 2_000);
    }
  }

  private stopFollowerTimersOnly() {
    if (this.listeners.size > 0) return;
    if (this.leaseId != null) {
      window.clearInterval(this.leaseId);
      this.leaseId = null;
    }
    if (!this.isLeader) this.started = false;
  }

  private onMessage(message?: WireMessage) {
    if (!message) return;
    if (message.kind === "snapshot") {
      if (message.snapshot.sourceTabId === tabId) return;
      this.applySnapshot({ ...message.snapshot, isLeader: false });
    } else if (message.kind === "leader-release") {
      if (message.tabId !== tabId) this.electLeader(true);
    } else if (message.kind === "load-test" && this.isLeader) {
      this.workerProbe?.burst(Math.max(250, Math.min(5_000, message.ms)));
    }
  }

  private onStorage = (event: StorageEvent) => {
    if (event.key === THRESHOLD_KEY) this.thresholds = loadThresholds();
    if (event.key === LEASE_KEY && !this.isLeader) this.electLeader();
  };

  private electLeader(force = false) {
    const now = Date.now();
    let current: { tabId: string; expiresAt: number } | null = null;
    try {
      const raw = localStorage.getItem(LEASE_KEY);
      current = raw ? JSON.parse(raw) : null;
    } catch { current = null; }

    const expired = !current || current.expiresAt <= now;
    const mine = current?.tabId === tabId;
    if (force || expired || mine) {
      try { localStorage.setItem(LEASE_KEY, JSON.stringify({ tabId, expiresAt: now + LEASE_MS })); } catch { /* noop */ }
      if (!this.isLeader) this.becomeLeader();
      return;
    }
    if (this.isLeader && current?.tabId !== tabId) this.resignLeader();
  }

  private becomeLeader() {
    this.isLeader = true;
    this.lastTick = performance.now();
    this.workerProbe = startCpuProbe((driftMs) => {
      this.workerDrift.push(driftMs);
      if (this.workerDrift.length > 15) this.workerDrift.shift();
    });
    if (this.sampleId == null) {
      this.sampleId = window.setInterval(() => this.sampleLeader(), 200);
    }
  }

  private resignLeader() {
    this.isLeader = false;
    if (this.sampleId != null) {
      window.clearInterval(this.sampleId);
      this.sampleId = null;
    }
    this.workerProbe?.stop();
    this.workerProbe = null;
  }

  private releaseLeadership = () => {
    if (!this.isLeader) return;
    try {
      const raw = localStorage.getItem(LEASE_KEY);
      const current = raw ? JSON.parse(raw) : null;
      if (current?.tabId === tabId) localStorage.removeItem(LEASE_KEY);
    } catch { /* noop */ }
    this.post({ kind: "leader-release", tabId });
    this.resignLeader();
  };

  private sampleLeader() {
    this.renewLease();
    const now = performance.now();
    const driftMs = Math.max(0, now - this.lastTick - 200);
    this.lastTick = now;
    this.drift.push(driftMs);
    if (this.drift.length > 15) this.drift.shift();
    this.tickCount++;

    const mainAvg = avg(this.drift);
    const workerAvg = avg(this.workerDrift);
    const pressure = clamp(((mainAvg * 0.7 + workerAvg * 0.3) / 200) * 100);
    const deadbanded = Math.abs(pressure - this.cpuEma) < 1.2 ? this.cpuEma : this.cpuEma + (pressure - this.cpuEma) * 0.28;
    this.cpuEma = clamp(deadbanded);

    if (this.tickCount % 5 !== 0) return;

    this.cpuHistory.push(this.cpuEma);
    if (this.cpuHistory.length > HISTORY_LIMIT) this.cpuHistory.shift();

    const mem = this.sampleMemory();
    const t = this.thresholds;
    const perfNow = performance.now();
    const cpuSpike = this.dwell(this.cpuEma, t.cpuEnter, t.cpuExit, perfNow, "cpu");
    const memSpike = mem.supported ? this.dwell(mem.pct, t.memEnter, t.memExit, perfNow, "mem") : false;

    this.applySnapshot({
      at: Date.now(),
      sourceTabId: tabId,
      leaderTabId: tabId,
      isLeader: true,
      cpu: { pct: this.cpuEma, supported: true, spike: cpuSpike, history: [...this.cpuHistory] },
      mem: { ...mem, spike: memSpike, history: [...this.memHistory] },
    });
    this.post({ kind: "snapshot", snapshot: this.snapshot });
  }

  private renewLease() {
    try { localStorage.setItem(LEASE_KEY, JSON.stringify({ tabId, expiresAt: Date.now() + LEASE_MS })); } catch { /* noop */ }
  }

  private sampleMemory() {
    type MemPerf = Performance & { memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number } };
    const m = (performance as MemPerf).memory;
    if (!m || m.jsHeapSizeLimit <= 0) {
      return { pct: 0, usedMb: 0, limitMb: null, supported: false };
    }
    const usedMb = m.usedJSHeapSize / 1024 / 1024;
    const limitMb = m.jsHeapSizeLimit / 1024 / 1024;
    const rawPct = clamp((usedMb / limitMb) * 100);
    this.memEma = this.memEma == null ? rawPct : this.memEma + (rawPct - this.memEma) * 0.08;
    this.memHistory.push(this.memEma);
    if (this.memHistory.length > HISTORY_LIMIT) this.memHistory.shift();
    return { pct: this.memEma, usedMb, limitMb, supported: true };
  }

  private dwell(value: number, enter: number, exit: number, now: number, key: "cpu" | "mem") {
    const sinceKey = key === "cpu" ? "cpuSpikeSince" : "memSpikeSince";
    const previous = key === "cpu" ? this.snapshot.cpu.spike : this.snapshot.mem.spike;
    if (value >= enter) {
      if (this[sinceKey] == null) this[sinceKey] = now;
      return previous || now - (this[sinceKey] ?? now) >= this.thresholds.dwellMs;
    }
    if (value <= exit) {
      this[sinceKey] = null;
      return false;
    }
    return previous;
  }

  private applySnapshot(snapshot: TelemetrySnapshot) {
    this.snapshot = snapshot;
    try { localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot)); } catch { /* noop */ }
    for (const listener of this.listeners) {
      try { listener(snapshot); } catch { /* subscriber isolation */ }
    }
  }

  private post(message: WireMessage) {
    try { this.channel?.postMessage(message); } catch { /* noop */ }
  }
}

export const telemetry = new TelemetryManager();
export { THRESHOLD_KEY as TELEMETRY_THRESHOLD_KEY };