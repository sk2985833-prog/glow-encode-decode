import { Label } from "@/components/ui/label";

interface EnginePanelProps {
  scanCount: number;
  lastScanMs?: number | null;
}

/**
 * Static engine identity readout — modeled after enterprise SOC tooling.
 * Signature counts reflect the actual modes/detectors loaded in the bundle.
 */
export default function EnginePanel({ scanCount, lastScanMs }: EnginePanelProps) {
  const rows: Array<[string, string, string]> = [
    ["engine", "Lithick Threat Engine", "text-[hsl(var(--encode-accent))]"],
    ["build", "v2.3.1-enterprise", "text-foreground/80"],
    ["status", "● ACTIVE", "text-[hsl(var(--decode-accent))]"],
    ["cipher", "AES-256-GCM / PBKDF2-SHA256", "text-foreground/80"],
    ["modes.loaded", "lsb · multi-bit · random · edge", "text-foreground/80"],
    ["detectors", "entropy · χ² · LSB-randomness", "text-foreground/80"],
    ["scans.total", scanCount.toString().padStart(4, "0"), "text-[hsl(var(--encode-accent))]"],
    ["last.scan", lastScanMs != null ? `${lastScanMs.toFixed(2)} ms` : "—", "text-foreground/80"],
  ];

  return (
    <div className="card-glass rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/30 bg-background/40">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--encode-accent))] animate-pulse" />
          <Label className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest">
            // engine identity
          </Label>
        </div>
        <span className="text-[9px] font-mono text-muted-foreground/50">read-only</span>
      </div>
      <div className="px-4 py-2 font-mono text-[10px] grid grid-cols-[auto_1fr] gap-y-1 gap-x-3">
        {rows.map(([k, v, color]) => (
          <div key={k} className="contents">
            <span className="text-muted-foreground/60">{k}</span>
            <span className={`text-right truncate ${color}`}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}