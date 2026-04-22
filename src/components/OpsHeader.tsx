import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Lock, Search, Zap } from "lucide-react";

interface OpsHeaderProps {
  sessionId: string;
  onNav: (tab: "encode" | "decode" | "attack") => void;
}

export default function OpsHeader({ sessionId, onNav }: OpsHeaderProps) {
  const [boot, setBoot] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setBoot((b) => (b >= 100 ? 100 : b + 7)), 60);
    return () => clearInterval(t);
  }, []);

  return (
    <header className="mb-6 border border-border/40 rounded-xl bg-card/40 backdrop-blur-md overflow-hidden">
      {/* Top bar — agency-style identification */}
      <div className="flex items-stretch border-b border-border/40">
        <div className="px-4 py-3 border-r border-border/40 bg-[hsl(var(--encode-accent))]/5 flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-md border-2 border-[hsl(var(--encode-accent))]/60 flex items-center justify-center bg-background/60">
              <span className="font-mono text-[hsl(var(--encode-accent))] font-bold text-sm tracking-tighter">SL</span>
            </div>
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[hsl(var(--decode-accent))] animate-pulse ring-2 ring-background" />
          </div>
          <div className="font-mono leading-tight">
            <div className="flex items-center gap-2">
              <span className="text-base font-bold tracking-tight text-foreground">STEGLAB</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-[hsl(var(--encode-accent))]/15 text-[hsl(var(--encode-accent))] border border-[hsl(var(--encode-accent))]/30">
                v2.1.0
              </span>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-[hsl(var(--decode-accent))]/15 text-[hsl(var(--decode-accent))] border border-[hsl(var(--decode-accent))]/30">
                ENTERPRISE
              </span>
            </div>
            <div className="text-[10px] text-muted-foreground/70 mt-0.5 tracking-wider uppercase">
              Cryptographic Steganography &amp; Threat Analysis Suite
            </div>
          </div>
        </div>

        {/* Session metadata grid */}
        <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 divide-x divide-border/30 font-mono text-[10px]">
          <Cell label="SESSION" value={sessionId} accent="text-[hsl(var(--encode-accent))]" />
          <Cell label="OPERATOR" value="ANON-LOCAL" accent="text-foreground/80" />
          <Cell label="MODE" value="STANDALONE" accent="text-[hsl(var(--decode-accent))]" />
          <Cell label="CHANNEL" value="ISOLATED" accent="text-yellow-400" />
        </div>
      </div>

      {/* Boot/init line */}
      <div className="px-4 py-2 border-b border-border/30 font-mono text-[10px] text-muted-foreground/70 flex items-center gap-3">
        <span className="text-[hsl(var(--decode-accent))]">$</span>
        <span className="truncate">
          steglab.init --crypto=subtlecrypto --kdf=pbkdf2-sha256 --iter=250000 --modes=lsb,multibit,random,edge
        </span>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-muted-foreground/50">init</span>
          <div className="w-32 h-1 rounded-full bg-border/40 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[hsl(var(--encode-accent))] to-[hsl(var(--decode-accent))] transition-all duration-100"
              style={{ width: `${boot}%` }}
            />
          </div>
          <span className="tabular-nums text-foreground/70 w-8 text-right">{boot}%</span>
          {boot >= 100 && <span className="text-[hsl(var(--decode-accent))]">READY</span>}
        </div>
      </div>

      {/* Quick op launcher */}
      <div className="px-4 py-3 flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-widest mr-2">
          // Launch Operation:
        </span>
        <Button
          onClick={() => onNav("encode")}
          size="sm"
          className="btn-encode font-mono text-[11px] gap-2 h-8"
        >
          <Lock className="h-3 w-3" />
          OP-01 / EMBED
        </Button>
        <Button
          onClick={() => onNav("decode")}
          size="sm"
          className="btn-decode font-mono text-[11px] gap-2 h-8"
        >
          <Search className="h-3 w-3" />
          OP-02 / EXTRACT
        </Button>
        <Button
          onClick={() => onNav("attack")}
          size="sm"
          variant="outline"
          className="font-mono text-[11px] gap-2 h-8 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <Zap className="h-3 w-3" />
          OP-06 / RED-TEAM
        </Button>
      </div>
    </header>
  );
}

function Cell({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="px-3 py-2 flex flex-col justify-center">
      <span className="text-muted-foreground/50 uppercase tracking-widest text-[9px]">{label}</span>
      <span className={`tabular-nums truncate ${accent}`}>{value}</span>
    </div>
  );
}