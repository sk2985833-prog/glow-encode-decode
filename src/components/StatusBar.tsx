import { useState, useEffect } from "react";

export default function StatusBar() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const fmt = time.toLocaleTimeString("en-US", { hour12: false });

  return (
    <div className="w-full border-b border-border/30 bg-card/50 backdrop-blur-md px-4 py-1.5 flex items-center justify-between font-mono text-[10px] text-muted-foreground/60 select-none">
      <div className="flex items-center gap-4">
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--decode-accent))] animate-pulse" />
          SYSTEM: ACTIVE
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--encode-accent))] animate-pulse" />
          THREAT ENGINE: READY
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse" />
          INPUT MONITOR: LIVE
        </span>
      </div>
      <div className="flex items-center gap-4">
        <span>v2.1.0</span>
        <span className="tabular-nums">{fmt}</span>
      </div>
    </div>
  );
}
