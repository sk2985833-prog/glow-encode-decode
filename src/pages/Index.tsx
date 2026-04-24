import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import EncodeTab from "@/components/EncodeTab";
import DecodeTab, { DecodeTabRef } from "@/components/DecodeTab";
import ImagePreview from "@/components/ImagePreview";
import ImageComparison from "@/components/ImageComparison";
import LearnTab from "@/components/LearnTab";
import SteganalysisTab from "@/components/SteganalysisTab";
import PixelVisualizationTab from "@/components/PixelVisualizationTab";
import MetadataTab from "@/components/MetadataTab";
import AttackSimulatorTab from "@/components/AttackSimulatorTab";
import CyberGrid from "@/components/CyberGrid";
import StatusBar from "@/components/StatusBar";
import HistoryPanel, { HistoryEntry } from "@/components/HistoryPanel";
import OpsHeader from "@/components/OpsHeader";
import SystemLog, { LogEntry } from "@/components/SystemLog";
import AirgapIndicator from "@/components/AirgapIndicator";
import EnginePanel from "@/components/EnginePanel";
import { Button } from "@/components/ui/button";
import { Trash2, ShieldHalf, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import ThreatScanTab from "@/components/threat/ThreatScanTab";
import EncodeDecodeTab from "@/components/threat/EncodeDecodeTab";
import type { EngineMode } from "@/lib/threatClient";
import { SIGNATURES_LOADED } from "@/lib/threatEngineCore";

type TabValue = "encode" | "decode" | "analyze" | "visualize" | "metadata" | "attack" | "learn";
type ThreatTabValue = "codec" | "scan";
type Domain = "stego" | "threat";

const TAB_CODES: Record<TabValue, { code: string; label: string; icon: string }> = {
  encode:    { code: "OP-01", label: "EMBED",    icon: "🔒" },
  decode:    { code: "OP-02", label: "EXTRACT",  icon: "🔓" },
  analyze:   { code: "OP-03", label: "ANALYZE",  icon: "🔍" },
  visualize: { code: "OP-04", label: "PIXELS",   icon: "👁" },
  metadata:  { code: "OP-05", label: "EXIF",     icon: "📋" },
  attack:    { code: "OP-06", label: "RED-TEAM", icon: "⚔" },
  learn:     { code: "OP-07", label: "DOCS",     icon: "🎓" },
};

const THREAT_TAB_CODES: Record<ThreatTabValue, { code: string; label: string; icon: string }> = {
  codec: { code: "OP-08", label: "CODEC", icon: "↔" },
  scan:  { code: "OP-09", label: "THREAT-SCAN", icon: "🛡" },
};

const Index = () => {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [activeTab, setActiveTab] = useState<TabValue>("encode");
  const [encodedCanvas, setEncodedCanvas] = useState<HTMLCanvasElement | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [scanCount, setScanCount] = useState(0);
  const [lastScanMs, setLastScanMs] = useState<number | null>(null);
  const [domain, setDomain] = useState<Domain>("stego");
  const [threatTab, setThreatTab] = useState<ThreatTabValue>("scan");
  const [engineMode, setEngineMode] = useState<EngineMode>("local");
  const decodeTabRef = useRef<DecodeTabRef | null>(null);
  const lastOpStartRef = useRef<number | null>(null);

  const sessionId = useMemo(() => {
    const rand = Math.floor(Math.random() * 0xffffff).toString(16).toUpperCase().padStart(6, "0");
    return `SL-${new Date().getFullYear()}-${rand}`;
  }, []);

  const pushLog = useCallback((level: LogEntry["level"], source: string, message: string) => {
    if (level === "sys" && /initiated/i.test(message)) {
      lastOpStartRef.current = performance.now();
    }
    if (level === "ok" && /complete/i.test(message) && lastOpStartRef.current != null) {
      setLastScanMs(performance.now() - lastOpStartRef.current);
      lastOpStartRef.current = null;
    }
    setLogs((prev) => [
      ...prev,
      { id: crypto.randomUUID(), timestamp: Date.now(), level, source, message },
    ].slice(-80));
  }, []);

  // Boot sequence
  useEffect(() => {
    const cryptoOk = typeof window !== "undefined" && !!window.crypto?.subtle;
    const ua = typeof navigator !== "undefined" ? navigator.userAgent.split(") ").pop() || "unknown" : "unknown";
    const seq: Array<[LogEntry["level"], string, string]> = [
      ["sys",  "kernel",  `Lithick Threat Engine v2.3.1 · runtime=${ua}`],
      ["info", "kernel",  `cores=${navigator.hardwareConcurrency || "?"} · memory=${(navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? "?"}GB`],
      ["info", "crypto",  cryptoOk ? "window.crypto.subtle handshake → ok" : "WARN: subtlecrypto unavailable"],
      ["info", "crypto",  "registering AES-256-GCM · PBKDF2-SHA256(iter=250000)"],
      ["info", "engine",  "loading embed modes · lsb · multi-bit · random-pixel · edge-based"],
      ["info", "engine",  "loading detectors · entropy · χ² · LSB-randomness"],
      ["info", "airgap",  "patching window.fetch + XMLHttpRequest.open · audit attached"],
      ["ok",   "session", `session ${sessionId} established · channel=isolated · scope=client-only`],
      ["info", "monitor", "input watchers attached · ready for operator"],
    ];
    seq.forEach(([lvl, src, msg], i) => {
      setTimeout(() => pushLog(lvl, src, msg), 140 * (i + 1));
    });
  }, [pushLog, sessionId]);

  const addHistory = useCallback((entry: Omit<HistoryEntry, "id" | "timestamp">) => {
    setHistory((prev) => [
      { ...entry, id: crypto.randomUUID(), timestamp: Date.now() },
      ...prev,
    ].slice(0, 10));
    const levelMap: Record<string, LogEntry["level"]> = { encode: "ok", decode: "ok", analyze: "info", attack: "warn" };
    pushLog(levelMap[entry.type] || "info", entry.type, entry.summary);
    setScanCount((c) => c + 1);
  }, [pushLog]);

  // Log tab switches
  useEffect(() => {
    if (domain !== "stego") return;
    const t = TAB_CODES[activeTab];
    pushLog("info", "router", `→ ${t.code} / ${t.label}`);
  }, [activeTab, pushLog, domain]);

  useEffect(() => {
    if (domain !== "threat") return;
    const t = THREAT_TAB_CODES[threatTab];
    pushLog("info", "router", `→ ${t.code} / ${t.label}`);
  }, [threatTab, pushLog, domain]);

  useEffect(() => {
    pushLog("sys", "domain", `domain switched → ${domain.toUpperCase()} OPS`);
  }, [domain, pushLog]);

  const handleSampleLoad = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 800;
    canvas.height = 600;
    const ctx = canvas.getContext("2d")!;
    const gradient = ctx.createLinearGradient(0, 0, 800, 600);
    gradient.addColorStop(0, "#0a0f2b");
    gradient.addColorStop(1, "#022b3a");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 800, 600);
    ctx.fillStyle = "rgba(255,255,255,0.02)";
    for (let i = 0; i < 2000; i++) {
      ctx.fillRect(Math.random() * 800, Math.random() * 600, 1, 1);
    }
    const url = canvas.toDataURL();
    const img = new Image();
    img.onload = () => {
      setImage(img);
      pushLog("ok", "loader", `sample cover loaded · ${img.width}×${img.height}px`);
      toast.success("Sample image loaded");
    };
    img.src = url;
  };

  const handleClear = () => {
    setImage(null);
    setEncodedCanvas(null);
    if (activeTab === "decode" && decodeTabRef.current) decodeTabRef.current.clear();
    pushLog("warn", "memory", "workspace flushed · all buffers cleared");
    toast.success("Cleared");
  };

  const handleWipeWorkspace = () => {
    pushLog("sys", "wipe",  "OP-99 / WIPE-WORKSPACE initiated");
    pushLog("info", "wipe", "zeroing image buffer · canvas → null");
    setImage(null);
    pushLog("info", "wipe", "discarding encoded canvas · pixel data released");
    setEncodedCanvas(null);
    if (decodeTabRef.current) {
      pushLog("info", "wipe", "clearing decode tab · password & payload buffers wiped");
      decodeTabRef.current.clear();
    }
    pushLog("info", "wipe", `purging history · ${history.length} entries`);
    setHistory([]);
    pushLog("ok", "wipe", "workspace zeroed · GC eligible · op complete");
    toast.success("Workspace wiped — all buffers zeroed");
  };

  const tabClass = (tab: TabValue) => {
    const active = activeTab === tab;
    if (!active) return "text-xs font-mono";
    if (tab === "encode") return "text-xs font-mono tab-active-encode";
    if (tab === "decode") return "text-xs font-mono tab-active-decode";
    return "text-xs font-mono tab-active-encode";
  };

  const opCount = history.length;
  const activeOpCode = domain === "stego" ? TAB_CODES[activeTab].code : THREAT_TAB_CODES[threatTab].code;

  return (
    <div className="min-h-screen relative flex flex-col">
      <CyberGrid />
      <StatusBar opCount={opCount} activeOp={activeOpCode} />

      <div className="max-w-7xl mx-auto px-4 py-4 relative z-10 flex-1 w-full">
        <OpsHeader sessionId={sessionId} onNav={(t) => setActiveTab(t)} />

        {/* Domain switcher */}
        <div className="mb-4 flex items-center gap-2 p-1 rounded-xl border border-border/40 bg-card/40 backdrop-blur-md w-fit">
          <button
            onClick={() => setDomain("stego")}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg font-mono text-xs transition-colors ${
              domain === "stego"
                ? "bg-[hsl(var(--encode-accent))]/20 text-[hsl(var(--encode-accent))] border border-[hsl(var(--encode-accent))]/40"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <ImageIcon className="h-3.5 w-3.5" />
            STEGO OPS
            <span className="text-[9px] opacity-60">7 tools</span>
          </button>
          <button
            onClick={() => setDomain("threat")}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg font-mono text-xs transition-colors ${
              domain === "threat"
                ? "bg-[hsl(var(--decode-accent))]/20 text-[hsl(var(--decode-accent))] border border-[hsl(var(--decode-accent))]/40"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <ShieldHalf className="h-3.5 w-3.5" />
            THREAT OPS
            <span className="text-[9px] opacity-60">{SIGNATURES_LOADED} sigs</span>
          </button>
        </div>

        {/* Main Content */}
        <div className="grid lg:grid-cols-[1fr_360px] gap-4">
          <div>
            {domain === "stego" && (
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)}>
              <TabsList className="grid w-full grid-cols-7 mb-4 h-12 bg-card/60 backdrop-blur-sm border border-border/40 p-1">
                {(Object.keys(TAB_CODES) as TabValue[]).map((t) => {
                  const meta = TAB_CODES[t];
                  return (
                    <TabsTrigger
                      key={t}
                      value={t}
                      className={`${tabClass(t)} flex flex-col items-center justify-center gap-0 h-full leading-tight`}
                    >
                      <span className="text-[9px] tracking-widest opacity-70">{meta.code}</span>
                      <span className="text-[10px] font-bold tracking-wide">{meta.icon} {meta.label}</span>
                    </TabsTrigger>
                  );
                })}
              </TabsList>

              <TabsContent value="encode" className="mt-0">
                <EncodeTab
                  image={image}
                  onImageLoad={setImage}
                  onEncoded={setEncodedCanvas}
                  onHistoryAdd={(e) => addHistory(e)}
                  onLog={pushLog}
                />
              </TabsContent>
              <TabsContent value="decode" className="mt-0">
                <DecodeTab ref={decodeTabRef} onHistoryAdd={(e) => addHistory(e)} onLog={pushLog} />
              </TabsContent>
              <TabsContent value="analyze" className="mt-0">
                <SteganalysisTab />
              </TabsContent>
              <TabsContent value="visualize" className="mt-0">
                <PixelVisualizationTab />
              </TabsContent>
              <TabsContent value="metadata" className="mt-0">
                <MetadataTab />
              </TabsContent>
              <TabsContent value="attack" className="mt-0">
                <AttackSimulatorTab />
              </TabsContent>
              <TabsContent value="learn" className="mt-0">
                <LearnTab />
              </TabsContent>
            </Tabs>
            )}

            {domain === "threat" && (
              <Tabs value={threatTab} onValueChange={(v) => setThreatTab(v as ThreatTabValue)}>
                <TabsList className="grid w-full grid-cols-2 mb-4 h-12 bg-card/60 backdrop-blur-sm border border-border/40 p-1">
                  {(Object.keys(THREAT_TAB_CODES) as ThreatTabValue[]).map((t) => {
                    const meta = THREAT_TAB_CODES[t];
                    const active = threatTab === t;
                    return (
                      <TabsTrigger
                        key={t}
                        value={t}
                        className={`text-xs font-mono ${active ? "tab-active-decode" : ""} flex flex-col items-center justify-center gap-0 h-full leading-tight`}
                      >
                        <span className="text-[9px] tracking-widest opacity-70">{meta.code}</span>
                        <span className="text-[10px] font-bold tracking-wide">{meta.icon} {meta.label}</span>
                      </TabsTrigger>
                    );
                  })}
                </TabsList>
                <TabsContent value="codec" className="mt-0">
                  <EncodeDecodeTab
                    mode={engineMode}
                    onModeChange={setEngineMode}
                    onLog={pushLog}
                    onHistoryAdd={addHistory}
                  />
                </TabsContent>
                <TabsContent value="scan" className="mt-0">
                  <ThreatScanTab
                    mode={engineMode}
                    onModeChange={setEngineMode}
                    onLog={pushLog}
                    onHistoryAdd={addHistory}
                  />
                </TabsContent>
              </Tabs>
            )}
          </div>

          <aside className="lg:sticky lg:top-6 h-fit space-y-4">
            {domain === "stego" && (
            <ImagePreview
              image={image}
              onSampleLoad={handleSampleLoad}
              onClear={handleClear}
              activeTab={activeTab}
            />
            )}
            <AirgapIndicator />
            <EnginePanel scanCount={scanCount} lastScanMs={lastScanMs} />
            <Button
              onClick={handleWipeWorkspace}
              variant="outline"
              className="w-full font-mono text-[11px] gap-2 h-9 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="h-3 w-3" />
              OP-99 / WIPE WORKSPACE
            </Button>
            <SystemLog entries={logs} onClear={() => setLogs([])} />
            <HistoryPanel entries={history} onClearHistory={() => setHistory([])} />
          </aside>
        </div>

        {/* Image Comparison */}
        {encodedCanvas && image && activeTab === "encode" && (
          <div className="mt-4">
            <ImageComparison originalImage={image} encodedCanvas={encodedCanvas} />
          </div>
        )}

        {/* Footer */}
        <footer className="mt-8 border-t border-border/30 pt-4 grid sm:grid-cols-3 gap-2 text-[10px] font-mono text-muted-foreground/60">
          <div>
            <span className="text-muted-foreground/40">// build</span><br />
            steglab/2.1.0 · enterprise · {new Date().getFullYear()}.{(new Date().getMonth() + 1).toString().padStart(2, "0")}
          </div>
          <div className="sm:text-center">
            <span className="text-muted-foreground/40">// runtime</span><br />
            client-side · zero-egress · webcrypto.subtle
          </div>
          <div className="sm:text-right">
            <span className="text-muted-foreground/40">// engineered by</span><br />
            <span className="text-[hsl(var(--encode-accent))]">LITHICKKUMAR</span> · research &amp; education
          </div>
        </footer>
      </div>
    </div>
  );
};

export default Index;
