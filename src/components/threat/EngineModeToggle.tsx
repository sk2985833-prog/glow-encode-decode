import type { EngineMode } from "@/lib/threatClient";
import { Cpu, Cloud } from "lucide-react";

interface Props { mode: EngineMode; onChange: (m: EngineMode) => void }

export default function EngineModeToggle({ mode, onChange }: Props) {
  return (
    <div className="inline-flex items-center rounded-md border border-border/40 bg-background/40 p-0.5 font-mono text-[10px]">
      <button
        onClick={() => onChange("local")}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-colors ${
          mode === "local"
            ? "bg-[hsl(var(--decode-accent))]/20 text-[hsl(var(--decode-accent))]"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <Cpu className="h-3 w-3" /> LOCAL
      </button>
      <button
        onClick={() => onChange("cloud")}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-colors ${
          mode === "cloud"
            ? "bg-[hsl(var(--encode-accent))]/20 text-[hsl(var(--encode-accent))]"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <Cloud className="h-3 w-3" /> CLOUD
      </button>
    </div>
  );
}