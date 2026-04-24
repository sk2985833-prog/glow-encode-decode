import type { AnalyzeResult } from "@/lib/threatEngineCore";
import { ShieldAlert, ShieldCheck, AlertTriangle } from "lucide-react";

const SEV_STYLE: Record<string, { bar: string; chip: string; icon: JSX.Element }> = {
  CRITICAL: { bar: "bg-destructive",        chip: "bg-destructive/15 text-destructive border-destructive/40",            icon: <AlertTriangle className="h-4 w-4" /> },
  HIGH:     { bar: "bg-destructive/80",     chip: "bg-destructive/10 text-destructive border-destructive/30",            icon: <ShieldAlert className="h-4 w-4" /> },
  MEDIUM:   { bar: "bg-yellow-500",         chip: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",               icon: <ShieldAlert className="h-4 w-4" /> },
  LOW:      { bar: "bg-yellow-500/60",      chip: "bg-yellow-500/5 text-yellow-300 border-yellow-500/20",                icon: <ShieldAlert className="h-4 w-4" /> },
  NONE:     { bar: "bg-[hsl(var(--decode-accent))]", chip: "bg-[hsl(var(--decode-accent))]/10 text-[hsl(var(--decode-accent))] border-[hsl(var(--decode-accent))]/30", icon: <ShieldCheck className="h-4 w-4" /> },
};

export default function ThreatReportCard({ result }: { result: AnalyzeResult }) {
  const sev = SEV_STYLE[result.severity] ?? SEV_STYLE.NONE;
  const pct = Math.round(result.confidence * 100);

  return (
    <div className="card-glass rounded-xl overflow-hidden animate-slide-up">
      <div className={`h-1 ${sev.bar}`} />
      <div className="p-4 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-md border ${sev.chip}`}>{sev.icon}</div>
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">// threat classification</div>
              <div className="font-mono text-lg font-bold tracking-tight">{result.threat}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-1 rounded text-[10px] font-mono font-bold border ${sev.chip}`}>SEV: {result.severity}</span>
            <span className="px-2 py-1 rounded text-[10px] font-mono border border-border/40 text-muted-foreground bg-background/40">
              src: {result.source}
            </span>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">// confidence</span>
            <span className="font-mono text-[11px] tabular-nums">{pct}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-border/30 overflow-hidden">
            <div className={`h-full ${sev.bar} transition-all`} style={{ width: `${pct}%` }} />
          </div>
        </div>

        <Section title="// analysis" body={result.analysis} />
        <Section title="// impact" body={result.impact} />
        <Section title="// recommendation" body={result.recommendation} accent />

        {result.hits.length > 0 && (
          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70 mb-1.5">
              // signature matches ({result.hits.length})
            </div>
            <div className="space-y-1">
              {result.hits.map((h) => (
                <div key={h.id} className="flex items-center gap-2 px-2 py-1.5 rounded bg-background/40 border border-border/30 font-mono text-[10px]">
                  <span className="text-[hsl(var(--encode-accent))]">{h.id}</span>
                  <span className="text-muted-foreground/60">·</span>
                  <span className="text-foreground/80 flex-1 truncate">{h.name}</span>
                  <span className="tabular-nums text-yellow-400/80">w={h.weight}</span>
                  <code className="text-destructive/80 truncate max-w-[200px]" title={h.match}>{h.match}</code>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/30 font-mono text-[10px] text-muted-foreground">
          <div><span className="text-muted-foreground/50">signatures: </span><span className="text-foreground/80 tabular-nums">{result.signaturesLoaded}</span></div>
          <div><span className="text-muted-foreground/50">hits: </span><span className="text-foreground/80 tabular-nums">{result.hits.length}</span></div>
          <div className="text-right"><span className="text-muted-foreground/50">scan: </span><span className="text-foreground/80 tabular-nums">{result.totalMs} ms</span></div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, body, accent }: { title: string; body: string; accent?: boolean }) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70 mb-1">{title}</div>
      <p className={`text-xs leading-relaxed font-mono ${accent ? "text-[hsl(var(--decode-accent))]" : "text-foreground/85"}`}>{body}</p>
    </div>
  );
}