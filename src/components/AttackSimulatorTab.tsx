import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import {
  readBitsFromImageData,
  bitsToUint8Array,
  simulateJPEGCompression,
  simulateResize,
  simulateNoise,
} from "@/lib/steganography";
import TerminalOutput from "./TerminalOutput";

interface AttackResult {
  name: string;
  survived: boolean;
  details: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  confidence: number;
  recommendation: string;
}

export default function AttackSimulatorTab() {
  const [image, setImage] = useState<File | null>(null);
  const [results, setResults] = useState<AttackResult[]>([]);
  const [terminalLines, setTerminalLines] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [jpegQuality, setJpegQuality] = useState([0.75]);
  const [resizeScale, setResizeScale] = useState([0.5]);
  const [noiseIntensity, setNoiseIntensity] = useState([10]);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadImage = useCallback((file: File) => {
    setImage(file);
    setResults([]);
    setTerminalLines([]);
    toast.success("Image loaded");
  }, []);

  const checkDataSurvival = (canvas: HTMLCanvasElement): { survived: boolean; length: number } => {
    const ctx = canvas.getContext("2d")!;
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const headerBits = readBitsFromImageData(imgData, 32);
    const headerBytes = bitsToUint8Array(headerBits);
    const length = (headerBytes[0] << 24) | (headerBytes[1] << 16) | (headerBytes[2] << 8) | headerBytes[3];
    
    if (length <= 0 || length > 500_000) return { survived: false, length: 0 };
    
    try {
      const totalBits = (4 + Math.min(length, 100)) * 8;
      const allBits = readBitsFromImageData(imgData, totalBits);
      const allBytes = bitsToUint8Array(allBits);
      const payload = new TextDecoder().decode(allBytes.slice(4, 4 + Math.min(length, 100)));
      // Check if payload has valid markers
      const hasMarker = payload.startsWith("MODE:") || payload.startsWith("ENC:") || payload.startsWith("PLAIN:") || payload.startsWith("FILE:");
      return { survived: hasMarker, length };
    } catch {
      return { survived: false, length: 0 };
    }
  };

  const runAttacks = async () => {
    if (!image) return;
    setRunning(true);
    setResults([]);
    setTerminalLines([
      "$ attack-simulator --full-suite",
      `Target: ${image.name}`,
      "Loading source image...",
    ]);

    const reader = new FileReader();
    reader.onload = async (e) => {
      const img = new Image();
      img.onload = async () => {
        const srcCanvas = document.createElement("canvas");
        srcCanvas.width = img.width;
        srcCanvas.height = img.height;
        const ctx = srcCanvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0);

        const original = checkDataSurvival(srcCanvas);
        setTerminalLines((prev) => [
          ...prev,
          original.survived ? `[OK] Original data intact (${original.length} bytes)` : "[WARN] No valid stego data in source",
          "",
          "=== ATTACK 1: JPEG Compression ===",
          `Quality: ${(jpegQuality[0] * 100).toFixed(0)}%`,
        ]);

        const attackResults: AttackResult[] = [];

        // Attack 1: JPEG Compression
        const jpegCanvas = await simulateJPEGCompression(srcCanvas, jpegQuality[0]);
        const jpegResult = checkDataSurvival(jpegCanvas);
        attackResults.push({
          name: `JPEG Compression (${(jpegQuality[0] * 100).toFixed(0)}%)`,
          survived: jpegResult.survived,
          details: jpegResult.survived ? `Data survived — ${jpegResult.length} bytes` : "Data DESTROYED — LSB bits corrupted by lossy compression",
          severity: jpegResult.survived ? "LOW" : "CRITICAL",
          confidence: jpegQuality[0] < 0.5 ? 98 : 85,
          recommendation: jpegResult.survived ? "Increase compression ratio" : "Use DCT-domain embedding for JPEG resilience",
        });
        setTerminalLines((prev) => [
          ...prev,
          jpegResult.survived ? "Result: SURVIVED ✔" : "Result: DESTROYED ✖",
          "",
          "=== ATTACK 2: Image Resize ===",
          `Scale: ${(resizeScale[0] * 100).toFixed(0)}% → 100%`,
        ]);

        // Attack 2: Resize
        const resizedCanvas = simulateResize(srcCanvas, resizeScale[0]);
        const resizeResult = checkDataSurvival(resizedCanvas);
        attackResults.push({
          name: `Resize (${(resizeScale[0] * 100).toFixed(0)}% → 100%)`,
          survived: resizeResult.survived,
          details: resizeResult.survived ? `Data survived — ${resizeResult.length} bytes` : "Data DESTROYED — pixel interpolation corrupted LSBs",
          severity: resizeResult.survived ? "LOW" : "HIGH",
          confidence: 92,
          recommendation: resizeResult.survived ? "Apply more aggressive scaling" : "Use frequency-domain embedding to resist resampling",
        });
        setTerminalLines((prev) => [
          ...prev,
          resizeResult.survived ? "Result: SURVIVED ✔" : "Result: DESTROYED ✖",
          "",
          "=== ATTACK 3: Noise Injection ===",
          `Intensity: ${noiseIntensity[0]}`,
        ]);

        // Attack 3: Noise
        const noisyCanvas = simulateNoise(srcCanvas, noiseIntensity[0]);
        const noiseResult = checkDataSurvival(noisyCanvas);
        attackResults.push({
          name: `Noise Injection (intensity: ${noiseIntensity[0]})`,
          survived: noiseResult.survived,
          details: noiseResult.survived ? `Data survived — ${noiseResult.length} bytes` : "Data DESTROYED — random noise flipped LSBs",
          severity: noiseResult.survived ? "LOW" : "HIGH",
          confidence: noiseIntensity[0] > 20 ? 96 : 78,
          recommendation: noiseResult.survived ? "Increase noise intensity" : "Use error-correcting codes (ECC) for noise resilience",
        });

        // Attack 4: Color modification (brightness shift)
        const brightCanvas = document.createElement("canvas");
        brightCanvas.width = srcCanvas.width;
        brightCanvas.height = srcCanvas.height;
        const brightCtx = brightCanvas.getContext("2d")!;
        brightCtx.drawImage(srcCanvas, 0, 0);
        const brightData = brightCtx.getImageData(0, 0, brightCanvas.width, brightCanvas.height);
        for (let i = 0; i < brightData.data.length; i += 4) {
          brightData.data[i] = Math.min(255, brightData.data[i] + 5);
          brightData.data[i + 1] = Math.min(255, brightData.data[i + 1] + 5);
          brightData.data[i + 2] = Math.min(255, brightData.data[i + 2] + 5);
        }
        brightCtx.putImageData(brightData, 0, 0);
        const brightResult = checkDataSurvival(brightCanvas);
        attackResults.push({
          name: "Brightness Shift (+5)",
          survived: brightResult.survived,
          details: brightResult.survived ? `Data survived — ${brightResult.length} bytes` : "Data DESTROYED — color values shifted",
          severity: brightResult.survived ? "LOW" : "MEDIUM",
          confidence: 88,
          recommendation: brightResult.survived ? "Apply larger brightness delta" : "Use relative embedding that adapts to luminance changes",
        });

        setTerminalLines((prev) => [
          ...prev,
          noiseResult.survived ? "Result: SURVIVED ✔" : "Result: DESTROYED ✖",
          "",
          "=== ATTACK 4: Brightness Shift ===",
          brightResult.survived ? "Result: SURVIVED ✔" : "Result: DESTROYED ✖",
          "",
          `Summary: ${attackResults.filter((r) => r.survived).length}/${attackResults.length} attacks survived`,
          "SIMULATION COMPLETE ✔",
        ]);

        setResults(attackResults);
        setRunning(false);
        toast.success("Attack simulation complete");
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(image);
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="card-glass rounded-xl p-5">
        <Label className="text-xs text-muted-foreground mb-2 block font-mono uppercase tracking-wider">// Attack Simulator</Label>
        <div
          onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) loadImage(f); }}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onClick={() => fileRef.current?.click()}
          className={`min-h-[100px] border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-3 cursor-pointer transition-all duration-300 mb-3 ${
            dragOver ? "border-red-500 bg-red-500/5" : "border-border/50 hover:border-red-500/50"
          }`}
        >
          <div className="text-muted-foreground text-sm font-mono">
            {image ? `> ${image.name}` : "> Drop stego image to test durability"}
          </div>
          <Button variant="outline" className="text-xs font-mono border-red-500/50 hover:bg-red-500/10" onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}>
            Browse Image
          </Button>
          <input ref={fileRef} type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) loadImage(f); }} className="hidden" />
        </div>

        {/* Attack parameters */}
        <div className="space-y-3 mb-3">
          <div>
            <div className="flex justify-between text-xs font-mono text-muted-foreground mb-1">
              <span>JPEG Quality</span>
              <span>{(jpegQuality[0] * 100).toFixed(0)}%</span>
            </div>
            <Slider value={jpegQuality} onValueChange={setJpegQuality} min={0.1} max={1} step={0.05} className="w-full" />
          </div>
          <div>
            <div className="flex justify-between text-xs font-mono text-muted-foreground mb-1">
              <span>Resize Scale</span>
              <span>{(resizeScale[0] * 100).toFixed(0)}%</span>
            </div>
            <Slider value={resizeScale} onValueChange={setResizeScale} min={0.1} max={0.9} step={0.05} className="w-full" />
          </div>
          <div>
            <div className="flex justify-between text-xs font-mono text-muted-foreground mb-1">
              <span>Noise Intensity</span>
              <span>{noiseIntensity[0]}</span>
            </div>
            <Slider value={noiseIntensity} onValueChange={setNoiseIntensity} min={1} max={50} step={1} className="w-full" />
          </div>
        </div>

        <Button onClick={runAttacks} disabled={!image || running} className="w-full font-mono text-xs bg-gradient-to-r from-red-600 to-pink-800 hover:opacity-90">
          {running ? "[ SIMULATING ATTACKS... ]" : "[ RUN ATTACK SIMULATION ]"}
        </Button>
      </div>

      {terminalLines.length > 0 && <TerminalOutput lines={terminalLines} />}

      {results.length > 0 && (
        <div className="card-glass rounded-xl p-5 space-y-3 animate-fade-in">
          <Label className="text-xs text-muted-foreground font-mono uppercase tracking-wider">// Threat Assessment Report</Label>
          <div className="space-y-3">
            {results.map((r, i) => {
              const sevColor = {
                LOW: "text-[hsl(var(--decode-accent))] border-[hsl(var(--decode-accent))]/30 bg-[hsl(var(--decode-accent))]/5",
                MEDIUM: "text-yellow-400 border-yellow-400/30 bg-yellow-400/5",
                HIGH: "text-orange-400 border-orange-400/30 bg-orange-400/5",
                CRITICAL: "text-destructive border-destructive/30 bg-destructive/5",
              }[r.severity];

              return (
                <div key={i} className={`p-4 rounded-lg border font-mono text-xs ${sevColor} transition-all`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{r.survived ? "✔" : "✖"}</span>
                      <span className="font-bold text-sm">{r.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${sevColor}`}>
                        {r.severity}
                      </span>
                      <span className="text-muted-foreground">
                        Confidence: {r.confidence}%
                      </span>
                    </div>
                  </div>
                  <p className="text-muted-foreground mb-1">{r.details}</p>
                  <p className="text-muted-foreground/70 italic">💡 {r.recommendation}</p>
                </div>
              );
            })}
          </div>
          <div className="p-3 rounded-lg bg-background/50 border border-border/30">
            <p className="text-xs font-mono text-muted-foreground">
              {results.filter((r) => !r.survived).length === results.length
                ? "⚠ All attacks destroyed the hidden data — LSB steganography is fragile against image processing"
                : results.filter((r) => r.survived).length === results.length
                ? "✔ Data survived all attacks — unusual for LSB; verify encoding was present"
                : "Mixed results — LSB is fragile against lossy operations but survives lossless ones"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
