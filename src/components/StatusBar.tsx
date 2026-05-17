import { useState, useEffect, useRef } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Settings2, Zap } from "lucide-react";
import { startCpuProbe } from "@/lib/cpuProbe";

/** Tiny SVG sparkline — renders last N data points as a polyline */
function Sparkline({ data, width = 48, height = 14, color }: { data: number[]; width?: number; height?: number; color: string }) {
  if (data.length < 2) return <span style={{ display: "inline-block", width, height }} />;
  const max = Math.max(...data, 1);
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - (v / max) * (height - 2) - 1;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return (
    <svg width={width} height={height} className="inline-block align-middle" style={{ minWidth: width }}>
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

interface StatusBarProps {
  opCount?: number;
  activeOp?: string;
  lastActivityAt?: number; // ms epoch — bump when user/op activity happens
  activeProgress?: number; // 0..100 — drives the ACTIVE op progress bar
}

/**
 * Real browser-local telemetry — no fake values, no remote calls.
 *  CPU  → event-loop drift sampling (real UI-thread pressure; browsers do not expose OS CPU%).
 *  MEM  → performance.memory (Chromium) usedJSHeapSize / jsHeapSizeLimit when available.
 *  LIVE → tab is visible AND there has been activity in the last 5s.
 */
type Thresholds = {
  cpuEnter: number;   // % to enter spike
  cpuExit: number;    // % to exit spike (hysteresis)
  memEnter: number;
  memExit: number;
  dwellMs: number;    // sustained ms above enter to flag
};

const DEFAULT_THRESHOLDS: Thresholds = {
  cpuEnter: 55,
  cpuExit: 35,
  memEnter: 60,
  memExit: 45,
  dwellMs: 1500,
};
const THRESHOLD_KEY = "steglab.thresholds.v1";

function loadThresholds(): Thresholds {
  try {
    const raw = localStorage.getItem(THRESHOLD_KEY);
    if (!raw) return DEFAULT_THRESHOLDS;
    return { ...DEFAULT_THRESHOLDS, ...JSON.parse(raw) };
  } catch { return DEFAULT_THRESHOLDS; }
}

export default function StatusBar({ opCount = 0, activeOp = "IDLE", lastActivityAt, activeProgress }: StatusBarProps) {
  const [time, setTime] = useState(new Date());
  const [cpu, setCpu] = useState<{ pct: number; supported: boolean }>({ pct: 0, supported: true });
  const [mem, setMem] = useState<{ pct: number; usedMb: number; limitMb: number | null; supported: boolean }>({ pct: 0, usedMb: 0, limitMb: null, supported: false });
  const [live, setLive] = useState(false);
  const driftBufRef = useRef<number[]>([]);
  const workerDriftBufRef = useRef<number[]>([]);
  const [cpuHistory, setCpuHistory] = useState<number[]>([]);
  const [memHistory, setMemHistory] = useState<number[]>([]);
  const cpuHistRef = useRef<number[]>([]);
  const memHistRef = useRef<number[]>([]);
  const [cpuSpike, setCpuSpike] = useState(false);
  const [memSpike, setMemSpike] = useState(false);
  const cpuSpikeSinceRef = useRef<number | null>(null);
  const memSpikeSinceRef = useRef<number | null>(null);
  const prevCpuRef = useRef(0);
  const memEmaRef = useRef<number | null>(null);
  const [thresholds, setThresholds] = useState<Thresholds>(loadThresholds);
  const [realism, setRealism] = useState(false);
  const probeRef = useRef<ReturnType<typeof startCpuProbe> | null>(null);

  // Persist thresholds
  useEffect(() => {
    try { localStorage.setItem(THRESHOLD_KEY, JSON.stringify(thresholds)); } catch { /* noop */ }
  }, [thresholds]);

  // Cross-thread CPU probe (Web Worker) — runs continuously, fills workerDriftBuf.
  useEffect(() => {
    const handle = startCpuProbe((drift) => {
      const buf = workerDriftBufRef.current;
      buf.push(drift);
      if (buf.length > 10) buf.shift();
    });
    probeRef.current = handle;
    return () => handle.stop();
  }, []);

  // Main-thread drift sampler. Combined with worker drift for a more accurate signal.
  useEffect(() => {
    let lastTick = performance.now();
    let stop = false;
    const tick = () => {
      if (stop) return;
      const now = performance.now();
      const drift = Math.max(0, now - lastTick - 200);
      lastTick = now;
      const buf = driftBufRef.current;
      buf.push(drift);
      if (buf.length > 10) buf.shift();
      // Blend main + worker drift. Worker pressure means the whole machine is busy,
      // not just our UI thread.
      const mainAvg = buf.reduce((a, b) => a + b, 0) / buf.length;
      const wbuf = workerDriftBufRef.current;
      const workerAvg = wbuf.length ? wbuf.reduce((a, b) => a + b, 0) / wbuf.length : 0;
      const raw = Math.min(100, ((mainAvg * 0.65 + workerAvg * 0.35) / 200) * 100);
      // DEADBAND: real dashboards stay stable until meaningful change occurs.
      const prev = prevCpuRef.current;
      const next = Math.abs(raw - prev) < 1.5 ? prev : prev + (raw - prev) * 0.55;
      prevCpuRef.current = next;
      setCpu({ pct: next, supported: true });
      // Accumulate history every ~1s (every 5th tick)
      if (buf.length % 5 === 0) {
        const h = cpuHistRef.current;
        h.push(next);
        if (h.length > 30) h.shift();
        cpuHistRef.current = h;
        setCpuHistory([...h]);
        // Dwell-time spike: enter only if sustained > dwellMs above cpuEnter
        const now2 = performance.now();
        if (next >= thresholds.cpuEnter) {
          if (cpuSpikeSinceRef.current == null) cpuSpikeSinceRef.current = now2;
          if (!cpuSpike && now2 - (cpuSpikeSinceRef.current ?? now2) >= thresholds.dwellMs) {
            setCpuSpike(true);
          }
        } else if (next <= thresholds.cpuExit) {
          cpuSpikeSinceRef.current = null;
          if (cpuSpike) setCpuSpike(false);
        }
      }
      setTimeout(tick, 200);
    };
    const id = setTimeout(tick, 200);
    return () => { stop = true; clearTimeout(id); };
  }, [thresholds, cpuSpike]);

  // Memory sampler (Chromium only). Updates every 1s, smoothed with an EMA so it
  // drifts slowly rather than oscillating — matches how real RSS behaves.
  useEffect(() => {
    type MemPerf = Performance & { memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number } };
    const sample = () => {
      const m = (performance as MemPerf).memory;
      if (m && m.jsHeapSizeLimit > 0) {
        const usedMb = m.usedJSHeapSize / 1024 / 1024;
        const limitMb = m.jsHeapSizeLimit / 1024 / 1024;
        const rawPct = Math.min(100, (usedMb / limitMb) * 100);
        // EMA — α=0.12 → ~8s effective window. Memory feels "heavy".
        const prevEma = memEmaRef.current ?? rawPct;
        const ema = prevEma + (rawPct - prevEma) * 0.12;
        memEmaRef.current = ema;
        setMem({ pct: ema, usedMb, limitMb, supported: true });
        const h = memHistRef.current;
        h.push(ema);
        if (h.length > 30) h.shift();
        memHistRef.current = h;
        setMemHistory([...h]);
        const now2 = performance.now();
        if (ema >= thresholds.memEnter) {
          if (memSpikeSinceRef.current == null) memSpikeSinceRef.current = now2;
          if (!memSpike && now2 - (memSpikeSinceRef.current ?? now2) >= thresholds.dwellMs) {
            setMemSpike(true);
          }
        } else if (ema <= thresholds.memExit) {
          memSpikeSinceRef.current = null;
          if (memSpike) setMemSpike(false);
        }
      } else {
        setMem({ pct: 0, usedMb: 0, limitMb: null, supported: false });
      }
    };
    sample();
    const id = setInterval(sample, 1000);
    return () => clearInterval(id);
  }, [thresholds, memSpike]);

  // Wall clock
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // LIVE: visible tab + activity within last 5s
  useEffect(() => {
    const update = () => {
      const visible = typeof document !== "undefined" ? document.visibilityState === "visible" : true;
      const recent = lastActivityAt ? Date.now() - lastActivityAt < 5000 : false;
      setLive(visible && (recent || activeOp !== "IDLE"));
    };
    update();
    const id = setInterval(update, 1000);
    document.addEventListener("visibilitychange", update);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", update); };
  }, [lastActivityAt, activeOp]);

  const utc = time.toISOString().slice(11, 19);
  const local = time.toLocaleTimeString("en-US", { hour12: false });
  const dateStr = time.toISOString().slice(0, 10);
  const cpuLabel = formatPercent(cpu.pct);
  const memLabel = mem.supported ? `${Math.max(1, Math.round(mem.usedMb))}MB` : "n/a";
  const showProgress = activeOp !== "IDLE" && typeof activeProgress === "number";
  const progress = Math.max(0, Math.min(100, activeProgress ?? 0));

  return (
    <div className="w-full border-b border-border/40 bg-card/60 backdrop-blur-md font-mono text-[10px] text-muted-foreground/70 select-none">
      {/* Classification banner */}
      <div className="bg-[hsl(var(--encode-accent))]/10 border-b border-[hsl(var(--encode-accent))]/20 px-4 py-0.5 text-center text-[9px] tracking-[0.3em] text-[hsl(var(--encode-accent))]/80 uppercase">
        // Unclassified // For Research &amp; Educational Use Only //
      </div>
      {/* Telemetry row */}
      <div className="px-4 py-1.5 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--decode-accent))] animate-pulse" />
            SYS:OK
          </span>
          <span className="flex items-center gap-1.5 border-l border-border/30 pl-4" title={cpuSpike ? "⚡ CPU spike detected" : "Real browser UI-thread load from event-loop drift; OS-level CPU is not exposed to web pages"}>
            <span className={`text-muted-foreground/40 ${cpuSpike ? "text-destructive animate-pulse" : ""}`}>CPU{cpuSpike ? "⚡" : ""}</span>
            <Sparkline data={cpuHistory} color="hsl(var(--decode-accent))" />
            <MetricBar pct={cpu.pct} live={cpu.supported} />
            <span className="tabular-nums text-foreground/80 w-10 text-right">{cpuLabel}</span>
          </span>
          <span className="flex items-center gap-1.5" title={memSpike ? "⚡ Memory spike detected" : mem.supported ? `Real JS heap: ${mem.usedMb.toFixed(1)}MB used${mem.limitMb ? ` / ${mem.limitMb.toFixed(0)}MB limit` : ""}` : "Live JS heap usage is not exposed by this browser"}>
            <span className={`text-muted-foreground/40 ${memSpike ? "text-yellow-400 animate-pulse" : ""}`}>MEM{memSpike ? "⚡" : ""}</span>
            <Sparkline data={memHistory} color="hsl(var(--encode-accent))" />
            <MetricBar pct={mem.pct} live={mem.supported} />
            <span className="tabular-nums text-foreground/80 w-12 text-right">{memLabel}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="text-muted-foreground/40">SRC</span>
            <span className={`tabular-nums ${live ? "text-[hsl(var(--decode-accent))]" : "text-muted-foreground/60"}`}>
              {live ? "LIVE" : "IDLE"}
            </span>
          </span>
          <span className="flex items-center gap-1.5 border-l border-border/30 pl-4">
            <span className="text-muted-foreground/40">OPS</span>
            <span className="tabular-nums text-[hsl(var(--encode-accent))]">{opCount.toString().padStart(4, "0")}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="text-muted-foreground/40">ACTIVE</span>
            <span className="text-foreground/80 uppercase">{activeOp}</span>
            {showProgress && (
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-16 h-1 rounded-sm bg-border/40 overflow-hidden">
                  <span
                    className="block h-full bg-[hsl(var(--encode-accent))] transition-[width] duration-200 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </span>
                <span className="tabular-nums text-[hsl(var(--encode-accent))] w-8 text-right">{Math.round(progress)}%</span>
              </span>
            )}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => {
              setRealism((v) => {
                const next = !v;
                if (next) probeRef.current?.burst(2500);
                return next;
              });
            }}
            title="Realism / test mode — runs a synthetic CPU burst so spike alerts become observable"
            className={`flex items-center gap-1 text-[10px] tracking-wider px-1.5 py-0.5 rounded border transition-colors ${
              realism
                ? "border-[hsl(var(--decode-accent))]/60 text-[hsl(var(--decode-accent))] bg-[hsl(var(--decode-accent))]/10"
                : "border-border/40 text-muted-foreground/60 hover:text-foreground/80"
            }`}
          >
            <Zap className="h-2.5 w-2.5" />
            {realism ? "TEST" : "TEST"}
          </button>
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                title="Configure CPU/MEM spike thresholds, hysteresis, and dwell time"
                className="text-muted-foreground/60 hover:text-foreground/80 transition-colors"
              >
                <Settings2 className="h-3 w-3" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-72 font-mono text-[11px] bg-card/95 backdrop-blur border-border/60" align="end">
              <div className="space-y-3">
                <div className="text-[10px] tracking-widest text-[hsl(var(--encode-accent))]">// SPIKE TUNING</div>
                {[
                  { k: "cpuEnter" as const, label: "CPU enter %", min: 30, max: 100 },
                  { k: "cpuExit" as const,  label: "CPU exit %",  min: 10, max: 90 },
                  { k: "memEnter" as const, label: "MEM enter %", min: 30, max: 100 },
                  { k: "memExit" as const,  label: "MEM exit %",  min: 10, max: 90 },
                  { k: "dwellMs" as const,  label: "Dwell (ms)",  min: 200, max: 6000 },
                ].map(({ k, label, min, max }) => (
                  <label key={k} className="block">
                    <div className="flex justify-between text-muted-foreground/70">
                      <span>{label}</span>
                      <span className="tabular-nums text-foreground/90">{thresholds[k]}</span>
                    </div>
                    <input
                      type="range"
                      min={min}
                      max={max}
                      step={k === "dwellMs" ? 100 : 1}
                      value={thresholds[k]}
                      onChange={(e) => setThresholds((t) => ({ ...t, [k]: Number(e.target.value) }))}
                      className="w-full accent-[hsl(var(--encode-accent))]"
                    />
                  </label>
                ))}
                <button
                  type="button"
                  onClick={() => setThresholds(DEFAULT_THRESHOLDS)}
                  className="w-full text-[10px] tracking-wider py-1 border border-border/60 rounded hover:bg-muted/40"
                >
                  RESET DEFAULTS
                </button>
              </div>
            </PopoverContent>
          </Popover>
          <span className="text-muted-foreground/40">CRYPTO</span>
          <span className="text-[hsl(var(--decode-accent))]">AES-256-GCM</span>
          <span className="border-l border-border/30 pl-4 text-muted-foreground/40">UTC</span>
          <span className="tabular-nums text-foreground/80">{dateStr} {utc}</span>
          <span className="border-l border-border/30 pl-4 text-muted-foreground/40">LOC</span>
          <span className="tabular-nums text-foreground/80">{local}</span>
        </div>
      </div>
    </div>
  );
}

function MetricBar({ pct, live }: { pct: number; live: boolean }) {
  const w = Math.max(0, Math.min(100, pct));
  const color =
    !live ? "bg-muted-foreground/30"
    : w > 80 ? "bg-destructive"
    : w > 60 ? "bg-yellow-500"
    : "bg-[hsl(var(--decode-accent))]";
  return (
    <span className="inline-block w-12 h-1.5 rounded-sm bg-border/40 overflow-hidden">
      <span className={`block h-full ${color} transition-all`} style={{ width: `${w}%` }} />
    </span>
  );
}

function formatPercent(value: number) {
  if (value > 0 && value < 1) return "<1%";
  return `${Math.round(value).toString().padStart(2, "0")}%`;
}
