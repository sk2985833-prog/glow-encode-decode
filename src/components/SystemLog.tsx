import { useEffect, useRef } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export interface LogEntry {
  id: string;
  timestamp: number;
  level: "info" | "ok" | "warn" | "err" | "sys";
  source: string;
  message: string;
}

interface SystemLogProps {
  entries: LogEntry[];
  onClear: () => void;
}

const LEVEL_STYLES: Record<LogEntry["level"], { tag: string; color: string }> = {
  info: { tag: "INFO", color: "text-foreground/70" },
  ok:   { tag: " OK ", color: "text-[hsl(var(--decode-accent))]" },
  warn: { tag: "WARN", color: "text-yellow-400" },
  err:  { tag: "ERR ", color: "text-destructive" },
  sys:  { tag: "SYS ", color: "text-[hsl(var(--encode-accent))]" },
};

export default function SystemLog({ entries, onClear }: SystemLogProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries]);

  return (
    <div className="card-glass rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/30 bg-background/40">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--decode-accent))] animate-pulse" />
          <Label className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest">
            // syslog ─ live
          </Label>
          <span className="text-[9px] text-muted-foreground/40 font-mono">
            [{entries.length} events]
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          className="h-5 px-2 text-[9px] font-mono text-muted-foreground/60 hover:text-foreground"
        >
          flush
        </Button>
      </div>
      <div
        ref={scrollRef}
        className="max-h-[180px] overflow-y-auto bg-[hsl(222,30%,2.5%)]/60 px-3 py-2 font-mono text-[10px] leading-[1.55] space-y-0.5"
      >
        {entries.length === 0 ? (
          <div className="text-muted-foreground/40 italic">
            <span className="text-[hsl(var(--decode-accent))]">$</span> awaiting operator input...
          </div>
        ) : (
          entries.map((e) => {
            const s = LEVEL_STYLES[e.level];
            const t = new Date(e.timestamp).toISOString().slice(11, 23);
            return (
              <div key={e.id} className="flex items-start gap-2 hover:bg-background/30 px-1 -mx-1 rounded">
                <span className="text-muted-foreground/40 tabular-nums">{t}</span>
                <span className={`${s.color} font-bold whitespace-pre`}>[{s.tag}]</span>
                <span className="text-muted-foreground/60 uppercase text-[9px] mt-0.5">{e.source}</span>
                <span className={`${s.color} flex-1 break-words`}>{e.message}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}