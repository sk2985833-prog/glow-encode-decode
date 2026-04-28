import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface StatusBarProps {
  opCount?: number;
  activeOp?: string;
}

export default function StatusBar({ opCount = 0, activeOp = "IDLE" }: StatusBarProps) {
  const [time, setTime] = useState(new Date());
  const [load, setLoad] = useState<{ cpu: number; mem: number; live: boolean }>({ cpu: 0, mem: 0, live: false });

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    let cancelled = false;
    const poll = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("system-stats", { method: "GET" });
        if (cancelled || error || !data) return;
        setLoad({
          cpu: Math.round(data.cpu?.percent ?? 0),
          mem: Math.round(data.memory?.percent ?? 0),
          live: true,
        });
      } catch { /* offline → keep last known */ }
    };
    poll();
    const l = setInterval(poll, 1000);
    return () => { cancelled = true; clearInterval(t); clearInterval(l); };
  }, []);

  const utc = time.toISOString().slice(11, 19);
  const local = time.toLocaleTimeString("en-US", { hour12: false });
  const dateStr = time.toISOString().slice(0, 10);

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
          <span className="flex items-center gap-1.5 border-l border-border/30 pl-4">
            <span className="text-muted-foreground/40">CPU</span>
            <MetricBar pct={load.cpu} live={load.live} />
            <span className="tabular-nums text-foreground/80 w-9 text-right">{load.live ? `${load.cpu.toString().padStart(2, "0")}%` : "--%"}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="text-muted-foreground/40">MEM</span>
            <MetricBar pct={load.mem} live={load.live} />
            <span className="tabular-nums text-foreground/80 w-9 text-right">{load.live ? `${load.mem.toString().padStart(2, "0")}%` : "--%"}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="text-muted-foreground/40">SRC</span>
            <span className={`tabular-nums ${load.live ? "text-[hsl(var(--decode-accent))]" : "text-muted-foreground/60"}`}>
              {load.live ? "LIVE" : "PEND"}
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
