import { useState, useEffect } from "react";

interface StatusBarProps {
  opCount?: number;
  activeOp?: string;
}

export default function StatusBar({ opCount = 0, activeOp = "IDLE" }: StatusBarProps) {
  const [time, setTime] = useState(new Date());
  const [load, setLoad] = useState({ cpu: 12, mem: 34, net: 0 });

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    const l = setInterval(() => {
      setLoad({
        cpu: 8 + Math.floor(Math.random() * 14),
        mem: 28 + Math.floor(Math.random() * 12),
        net: Math.floor(Math.random() * 4),
      });
    }, 1500);
    return () => { clearInterval(t); clearInterval(l); };
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
            <span className="tabular-nums text-foreground/80">{load.cpu.toString().padStart(2, "0")}%</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="text-muted-foreground/40">MEM</span>
            <span className="tabular-nums text-foreground/80">{load.mem.toString().padStart(2, "0")}%</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="text-muted-foreground/40">NET</span>
            <span className="tabular-nums text-[hsl(var(--decode-accent))]">OFFLINE</span>
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
