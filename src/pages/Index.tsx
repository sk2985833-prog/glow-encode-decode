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
import { toast } from "sonner";

type TabValue = "encode" | "decode" | "analyze" | "visualize" | "metadata" | "attack" | "learn";

const TAB_CODES: Record<TabValue, { code: string; label: string; icon: string }> = {
  encode:    { code: "OP-01", label: "EMBED",    icon: "🔒" },
  decode:    { code: "OP-02", label: "EXTRACT",  icon: "🔓" },
  analyze:   { code: "OP-03", label: "ANALYZE",  icon: "🔍" },
  visualize: { code: "OP-04", label: "PIXELS",   icon: "👁" },
  metadata:  { code: "OP-05", label: "EXIF",     icon: "📋" },
  attack:    { code: "OP-06", label: "RED-TEAM", icon: "⚔" },
  learn:     { code: "OP-07", label: "DOCS",     icon: "🎓" },
};

const Index = () => {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [activeTab, setActiveTab] = useState<TabValue>("encode");
  const [encodedCanvas, setEncodedCanvas] = useState<HTMLCanvasElement | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const decodeTabRef = useRef<DecodeTabRef | null>(null);

  const sessionId = useMemo(() => {
    const rand = Math.floor(Math.random() * 0xffffff).toString(16).toUpperCase().padStart(6, "0");
    return `SL-${new Date().getFullYear()}-${rand}`;
  }, []);

  const pushLog = useCallback((level: LogEntry["level"], source: string, message: string) => {
    setLogs((prev) => [
      ...prev,
      { id: crypto.randomUUID(), timestamp: Date.now(), level, source, message },
    ].slice(-80));
  }, []);

  // Boot sequence
  useEffect(() => {
    const seq: Array<[LogEntry["level"], string, string]> = [
      ["sys",  "kernel",  "steglab kernel boot ─ build 2.1.0"],
      ["info", "crypto",  "subtlecrypto.handshake → AES-256-GCM ready"],
      ["info", "crypto",  "kdf=PBKDF2-SHA256 iterations=250000"],
      ["info", "engine",  "loaded modes: lsb · multi-bit · random-pixel · edge-based"],
      ["ok",   "session", `session ${sessionId} established · channel=isolated`],
      ["info", "monitor", "input watchers attached · awaiting operator"],
    ];
    seq.forEach(([lvl, src, msg], i) => {
      setTimeout(() => pushLog(lvl, src, msg), 180 * (i + 1));
    });
  }, [pushLog, sessionId]);

  const addHistory = useCallback((entry: Omit<HistoryEntry, "id" | "timestamp">) => {
    setHistory((prev) => [
      { ...entry, id: crypto.randomUUID(), timestamp: Date.now() },
      ...prev,
    ].slice(0, 10));
    const levelMap: Record<string, LogEntry["level"]> = { encode: "ok", decode: "ok", analyze: "info", attack: "warn" };
    pushLog(levelMap[entry.type] || "info", entry.type, entry.summary);
  }, [pushLog]);

  // Log tab switches
  useEffect(() => {
    const t = TAB_CODES[activeTab];
    pushLog("info", "router", `→ ${t.code} / ${t.label}`);
  }, [activeTab, pushLog]);

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

  const tabClass = (tab: TabValue) => {
    const active = activeTab === tab;
    if (!active) return "text-xs font-mono";
    if (tab === "encode") return "text-xs font-mono tab-active-encode";
    if (tab === "decode") return "text-xs font-mono tab-active-decode";
    return "text-xs font-mono tab-active-encode";
  };

  const opCount = history.length;
  const activeOpCode = TAB_CODES[activeTab].code;

  return (
    <div className="min-h-screen relative flex flex-col">
      <CyberGrid />
      <StatusBar opCount={opCount} activeOp={activeOpCode} />

      <div className="max-w-7xl mx-auto px-4 py-4 relative z-10 flex-1 w-full">
        <OpsHeader sessionId={sessionId} onNav={(t) => setActiveTab(t)} />

        {/* Main Content */}
        <div className="grid lg:grid-cols-[1fr_360px] gap-4">
          <div>
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
                />
              </TabsContent>
              <TabsContent value="decode" className="mt-0">
                <DecodeTab ref={decodeTabRef} onHistoryAdd={(e) => addHistory(e)} />
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
          </div>

          <aside className="lg:sticky lg:top-6 h-fit space-y-4">
            <ImagePreview
              image={image}
              onSampleLoad={handleSampleLoad}
              onClear={handleClear}
              activeTab={activeTab}
            />
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
