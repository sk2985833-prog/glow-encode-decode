import { useMemo } from "react";
import { formatForensicsReport } from "@/lib/forensics";

interface InputForensicsProps {
  input: string;
}

const BAR_COLORS: Record<string, string> = {
  base64: "bg-purple-500",
  hex: "bg-orange-500",
  url: "bg-cyan-500",
  plaintext: "bg-[hsl(var(--decode-accent))]",
  binary: "bg-destructive",
};

export default function InputForensics({ input }: InputForensicsProps) {
  const report = useMemo(() => {
    if (!input || input.length < 2) return null;
    return formatForensicsReport(input);
  }, [input]);

  if (!report) return null;

  const { entropy, distribution, encoding, topEncoding } = report;
  const distEntries = [
    ["A-Z", distribution.uppercase],
    ["a-z", distribution.lowercase],
    ["0-9", distribution.digits],
    ["space", distribution.whitespace],
    ["punct", distribution.punctuation],
    ["ctrl", distribution.control],
    ["ext", distribution.extended],
  ].filter(([, v]) => (v as number) > 0) as [string, number][];

  return (
    <div className="p-3 rounded-lg bg-background/40 border border-border/30 font-mono text-[10px] space-y-2 animate-fade-in">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground/60 uppercase tracking-widest text-[9px]">// input forensics</span>
        <span className="text-muted-foreground/40">{input.length} chars</span>
      </div>

      {/* Entropy */}
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground/60 w-16">Entropy</span>
        <div className="flex-1 h-1.5 rounded bg-border/40 overflow-hidden">
          <div
            className="h-full bg-[hsl(var(--encode-accent))] transition-all duration-300"
            style={{ width: `${Math.min(100, (entropy / 8) * 100)}%` }}
          />
        </div>
        <span className="tabular-nums text-foreground/80 w-14 text-right">{entropy.toFixed(3)}</span>
        <span className="text-muted-foreground/40">/ 8</span>
      </div>

      {/* Encoding likelihood */}
      <div className="space-y-1">
        <span className="text-muted-foreground/60">Encoding Likelihood</span>
        <div className="grid grid-cols-5 gap-1">
          {(Object.entries(encoding) as [string, number][]).map(([k, v]) => (
            <div key={k} className="text-center">
              <div className="h-8 relative rounded overflow-hidden bg-border/20">
                <div
                  className={`absolute bottom-0 w-full ${BAR_COLORS[k]} transition-all duration-300`}
                  style={{ height: `${v * 100}%` }}
                />
              </div>
              <span className={`text-[8px] ${k === topEncoding ? "text-foreground font-bold" : "text-muted-foreground/50"}`}>
                {k === "plaintext" ? "text" : k}
              </span>
            </div>
          ))}
        </div>
        <div className="text-muted-foreground/50">
          Likely: <span className="text-foreground/80 font-semibold">{topEncoding.toUpperCase()}</span>
        </div>
      </div>

      {/* Character distribution */}
      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
        {distEntries.map(([label, count]) => (
          <span key={label} className="text-muted-foreground/60">
            {label}: <span className="text-foreground/70">{count}</span>
          </span>
        ))}
      </div>
    </div>
  );
}