import type { Stage } from "@/lib/threatEngineCore";
import { Label } from "@/components/ui/label";

interface Props {
  stages: Stage[];
  running: boolean;
}

const STAGE_LABEL: Record<string, string> = {
  normalize: "Initializing engine · normalizing input",
  signature_scan: "Matching against signature set",
  classify: "Classifying threat & severity",
  report: "Generating structured report",
};

export default function PipelinePanel({ stages, running }: Props) {
  return (
    <div className="card-glass rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/30 bg-background/40">
        <div className="flex items-center gap-2">
          <span className={`w-1.5 h-1.5 rounded-full ${running ? "bg-yellow-400 animate-pulse" : "bg-[hsl(var(--decode-accent))]"}`} />
          <Label className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest">// processing pipeline</Label>
        </div>
        <span className="text-[9px] font-mono text-muted-foreground/50">{running ? "running" : "idle"}</span>
      </div>
      <div className="px-3 py-2 font-mono text-[10px] space-y-1">
        {stages.length === 0 && (
          <div className="text-muted-foreground/40 italic px-1">awaiting analysis...</div>
        )}
        {stages.map((s, i) => (
          <div key={i} className="flex items-center gap-2 px-1">
            <span className="text-[hsl(var(--decode-accent))]">✓</span>
            <span className="text-foreground/80 flex-1 truncate">[{s.name}] {STAGE_LABEL[s.name] ?? ""}</span>
            <span className="text-muted-foreground/60 truncate max-w-[140px]" title={s.detail}>{s.detail}</span>
            <span className="tabular-nums text-[hsl(var(--encode-accent))] w-16 text-right">{s.ms} ms</span>
          </div>
        ))}
      </div>
    </div>
  );
}