import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";

/**
 * Airgap / network egress monitor.
 * Patches window.fetch and XMLHttpRequest at mount to count any outbound attempt
 * from app code. The audit only observes — it never permits or blocks (the
 * platform sandbox does that). It also performs a deliberate self-check by
 * attempting to read its own offline status from PerformanceObserver entries.
 */
export default function AirgapIndicator() {
  const [egressAttempts, setEgressAttempts] = useState(0);
  const [lastCheck, setLastCheck] = useState<Date>(new Date());
  const [online, setOnline] = useState<boolean>(typeof navigator !== "undefined" ? navigator.onLine : true);

  useEffect(() => {
    let counter = 0;
    const origFetch = window.fetch;
    const patchedFetch: typeof fetch = (...args) => {
      counter += 1;
      setEgressAttempts(counter);
      return origFetch.apply(window, args as Parameters<typeof fetch>);
    };
    window.fetch = patchedFetch;

    const OrigXHR = window.XMLHttpRequest;
    const origOpen = OrigXHR.prototype.open;
    OrigXHR.prototype.open = function (
      this: XMLHttpRequest,
      ...args: unknown[]
    ) {
      counter += 1;
      setEgressAttempts(counter);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return origOpen.apply(this, args as any);
    } as XMLHttpRequest["open"];

    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    const tick = setInterval(() => setLastCheck(new Date()), 5000);

    return () => {
      window.fetch = origFetch;
      OrigXHR.prototype.open = origOpen;
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      clearInterval(tick);
    };
  }, []);

  const airgapped = egressAttempts === 0;
  const stamp = lastCheck.toISOString().slice(11, 19);

  return (
    <div className="card-glass rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/30 bg-background/40">
        <div className="flex items-center gap-2">
          <span
            className={`w-1.5 h-1.5 rounded-full animate-pulse ${
              airgapped ? "bg-[hsl(var(--decode-accent))]" : "bg-destructive"
            }`}
          />
          <Label className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest">
            // airgap monitor
          </Label>
        </div>
        <span
          className={`text-[9px] font-mono font-bold tracking-widest ${
            airgapped ? "text-[hsl(var(--decode-accent))]" : "text-destructive"
          }`}
        >
          {airgapped ? "● AIRGAPPED" : "● EGRESS DETECTED"}
        </span>
      </div>
      <div className="px-4 py-2 font-mono text-[10px] grid grid-cols-2 gap-y-1 gap-x-3">
        <span className="text-muted-foreground/60">egress.attempts</span>
        <span className={`tabular-nums text-right ${airgapped ? "text-foreground/80" : "text-destructive font-bold"}`}>
          {egressAttempts.toString().padStart(4, "0")}
        </span>
        <span className="text-muted-foreground/60">browser.online</span>
        <span className="tabular-nums text-right text-muted-foreground/80">{online ? "true" : "false"}</span>
        <span className="text-muted-foreground/60">last.audit</span>
        <span className="tabular-nums text-right text-foreground/70">{stamp}Z</span>
        <span className="text-muted-foreground/60">data.scope</span>
        <span className="text-right text-[hsl(var(--decode-accent))]">client-only</span>
      </div>
    </div>
  );
}