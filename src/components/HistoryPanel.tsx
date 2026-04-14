import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export interface HistoryEntry {
  id: string;
  type: "encode" | "decode" | "analyze" | "attack";
  summary: string;
  timestamp: number;
  detail?: string;
}

interface HistoryPanelProps {
  entries: HistoryEntry[];
  onClearHistory: () => void;
}

const TYPE_STYLES: Record<string, { icon: string; color: string }> = {
  encode: { icon: "🔒", color: "text-[hsl(var(--encode-accent))]" },
  decode: { icon: "🔓", color: "text-[hsl(var(--decode-accent))]" },
  analyze: { icon: "🔍", color: "text-yellow-400" },
  attack: { icon: "⚔", color: "text-destructive" },
};

export default function HistoryPanel({ entries, onClearHistory }: HistoryPanelProps) {
  if (entries.length === 0) return null;

  const copyDetail = (detail: string) => {
    navigator.clipboard.writeText(detail);
    toast.success("Copied to clipboard");
  };

  return (
    <div className="card-glass rounded-xl p-4 animate-fade-in">
      <div className="flex items-center justify-between mb-2">
        <Label className="text-xs text-muted-foreground font-mono uppercase tracking-wider">// History</Label>
        <Button variant="ghost" size="sm" onClick={onClearHistory} className="text-[10px] font-mono h-6 px-2 text-muted-foreground hover:text-foreground">
          Clear
        </Button>
      </div>
      <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
        {entries.map((e) => {
          const style = TYPE_STYLES[e.type] || TYPE_STYLES.encode;
          return (
            <div
              key={e.id}
              className="flex items-center gap-2 p-2 rounded-lg bg-background/40 border border-border/20 text-[11px] font-mono group cursor-pointer hover:border-border/50 transition-colors"
              onClick={() => e.detail && copyDetail(e.detail)}
              title={e.detail ? "Click to copy" : undefined}
            >
              <span>{style.icon}</span>
              <span className={`${style.color} truncate flex-1`}>{e.summary}</span>
              <span className="text-muted-foreground/40 text-[9px]">
                {new Date(e.timestamp).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
