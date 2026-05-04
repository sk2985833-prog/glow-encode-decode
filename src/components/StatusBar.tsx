import { useState, useEffect, useRef } from "react";

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
}

/**
 * Real browser-local telemetry — no fake values, no remote calls.
 *  CPU  → event-loop drift sampling (real UI-thread pressure; browsers do not expose OS CPU%).
 *  MEM  → performance.memory (Chromium) usedJSHeapSize / jsHeapSizeLimit when available.
 *  LIVE → tab is visible AND there has been activity in the last 5s.
 */
export default function StatusBar({ opCount = 0, activeOp = "IDLE", lastActivityAt }: StatusBarProps) {
  const [time, setTime] = useState(new Date());
  const [cpu, setCpu] = useState<{ pct: number; supported: boolean }>({ pct: 0, supported: true });
  const [mem, setMem] = useState<{ pct: number; usedMb: number; limitMb: number | null; supported: boolean }>({ pct: 0, usedMb: 0, limitMb: null, supported: false });
  const [live, setLive] = useState(false);
  const driftBufRef = useRef<number[]>([]);
  const [cpuHistory, setCpuHistory] = useState<number[]>([]);
  const [memHistory, setMemHistory] = useState<number[]>([]);
  const cpuHistRef = useRef<number[]>([]);
  const memHistRef = useRef<number[]>([]);

  // Event-loop drift sampler (CPU pressure proxy). Schedule every 200ms; measure overshoot.
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
      // Map drift (0-200ms) to 0-100%. Anything over 200ms is pegged.
      const avg = buf.reduce((a, b) => a + b, 0) / buf.length;
      const pct = Math.min(100, (avg / 200) * 100);
      setCpu({ pct, supported: true });
      // Accumulate history every ~1s (every 5th tick)
      if (buf.length % 5 === 0) {
        const h = cpuHistRef.current;
        h.push(pct);
        if (h.length > 30) h.shift();
        cpuHistRef.current = h;
        setCpuHistory([...h]);
      }
      setTimeout(tick, 200);
    };
    const id = setTimeout(tick, 200);
    return () => { stop = true; clearTimeout(id); };
  }, []);

  // Memory sampler (Chromium only). Updates every 1s.
  useEffect(() => {
    type MemPerf = Performance & { memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number } };
    const sample = () => {
      const m = (performance as MemPerf).memory;
      if (m && m.jsHeapSizeLimit > 0) {
        const usedMb = m.usedJSHeapSize / 1024 / 1024;
        const limitMb = m.jsHeapSizeLimit / 1024 / 1024;
        const pct = Math.min(100, (usedMb / limitMb) * 100);
        setMem({ pct, usedMb, limitMb, supported: true });
        const h = memHistRef.current;
        h.push(pct);
        if (h.length > 30) h.shift();
        memHistRef.current = h;
        setMemHistory([...h]);
      } else {
        setMem({ pct: 0, usedMb: 0, limitMb: null, supported: false });
      }
    };
    sample();
    const id = setInterval(sample, 1000);
    return () => clearInterval(id);
  }, []);

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
          <span className="flex items-center gap-1.5 border-l border-border/30 pl-4" title="Real browser UI-thread load from event-loop drift; OS-level CPU is not exposed to web pages">
            <span className="text-muted-foreground/40">CPU</span>
            <Sparkline data={cpuHistory} color="hsl(var(--decode-accent))" />
            <MetricBar pct={cpu.pct} live={cpu.supported} />
            <span className="tabular-nums text-foreground/80 w-10 text-right">{cpuLabel}</span>
          </span>
          <span className="flex items-center gap-1.5" title={mem.supported ? `Real JS heap: ${mem.usedMb.toFixed(1)}MB used${mem.limitMb ? ` / ${mem.limitMb.toFixed(0)}MB limit` : ""}` : "Live JS heap usage is not exposed by this browser"}>
            <span className="text-muted-foreground/40">MEM</span>
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
          </span>
        </div>
        <div className="flex items-center gap-4">
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
