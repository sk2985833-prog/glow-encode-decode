import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  calculateEntropy,
  calculateLSBRandomness,
  getHistogram,
  detectChiSquare,
} from "@/lib/steganography";
import TerminalOutput from "./TerminalOutput";

interface AnalysisResult {
  entropy: { r: number; g: number; b: number };
  lsbRandomness: { r: number; g: number; b: number };
  chiSquare: { r: number; g: number; b: number };
  probability: number;
  verdict: string;
}

export default function SteganalysisTab() {
  const [image, setImage] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [terminalLines, setTerminalLines] = useState<string[]>([]);
  const [histogramData, setHistogramData] = useState<number[] | null>(null);
  const histRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const loadImage = useCallback((file: File) => {
    setImage(file);
    setResult(null);
    setTerminalLines([]);
    setHistogramData(null);
    toast.success("Image loaded for analysis");
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) loadImage(file);
  };

  const analyze = async () => {
    if (!image) return;
    setAnalyzing(true);
    setTerminalLines([
      "$ steganalysis --deep-scan",
      `Target: ${image.name}`,
      "Loading pixel matrix...",
    ]);

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;

        setTerminalLines((prev) => [...prev, `Resolution: ${img.width}×${img.height}`, "Computing entropy..."]);

        const entropyR = calculateEntropy(data, 0);
        const entropyG = calculateEntropy(data, 1);
        const entropyB = calculateEntropy(data, 2);

        setTerminalLines((prev) => [...prev, `Entropy R:${entropyR.toFixed(4)} G:${entropyG.toFixed(4)} B:${entropyB.toFixed(4)}`, "Analyzing LSB randomness..."]);

        const lsbR = calculateLSBRandomness(data, 0);
        const lsbG = calculateLSBRandomness(data, 1);
        const lsbB = calculateLSBRandomness(data, 2);

        setTerminalLines((prev) => [...prev, `LSB flip rate R:${lsbR.toFixed(4)} G:${lsbG.toFixed(4)} B:${lsbB.toFixed(4)}`, "Running Chi-Square test..."]);

        const chiR = detectChiSquare(data, 0);
        const chiG = detectChiSquare(data, 1);
        const chiB = detectChiSquare(data, 2);

        setTerminalLines((prev) => [...prev, `Chi² R:${chiR.toFixed(4)} G:${chiG.toFixed(4)} B:${chiB.toFixed(4)}`, "Computing histogram..."]);

        const hist = getHistogram(data, 2); // Blue channel
        setHistogramData(hist);

        // Calculate probability
        let score = 0;
        // High entropy in blue channel indicates possible stego
        if (entropyB > 7.5) score += 25;
        else if (entropyB > 7.0) score += 15;
        // LSB randomness close to 0.5 indicates uniform distribution (stego)
        const lsbDev = Math.abs(lsbB - 0.5);
        if (lsbDev < 0.02) score += 30;
        else if (lsbDev < 0.05) score += 15;
        // Chi-square close to 1.0 indicates PoV pairs are equalized (stego)
        if (chiB < 1.5) score += 25;
        else if (chiB < 3.0) score += 10;
        // Check if adjacent histogram values are suspiciously equal
        let equalPairs = 0;
        for (let i = 0; i < 256; i += 2) {
          if (Math.abs(hist[i] - hist[i + 1]) <= 1) equalPairs++;
        }
        if (equalPairs > 50) score += 20;
        else if (equalPairs > 20) score += 10;

        const probability = Math.min(score, 100);
        let verdict: string;
        if (probability >= 70) verdict = "HIGH — Hidden data likely present";
        else if (probability >= 40) verdict = "MEDIUM — Possible hidden data";
        else verdict = "LOW — Image appears clean";

        setResult({
          entropy: { r: entropyR, g: entropyG, b: entropyB },
          lsbRandomness: { r: lsbR, g: lsbG, b: lsbB },
          chiSquare: { r: chiR, g: chiG, b: chiB },
          probability,
          verdict,
        });

        setTerminalLines((prev) => [
          ...prev,
          `Hidden data probability: ${probability}%`,
          `Verdict: ${verdict}`,
          "ANALYSIS COMPLETE ✔",
        ]);

        setAnalyzing(false);
        toast.success("Analysis complete");
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(image);
  };

  // Draw histogram
  const drawHistogram = useCallback((canvas: HTMLCanvasElement | null) => {
    if (!canvas || !histogramData) return;
    const ctx = canvas.getContext("2d")!;
    canvas.width = 512;
    canvas.height = 150;
    ctx.fillStyle = "hsl(222, 25%, 5%)";
    ctx.fillRect(0, 0, 512, 150);

    const max = Math.max(...histogramData);
    for (let i = 0; i < 256; i++) {
      const h = (histogramData[i] / max) * 140;
      const isEven = i % 2 === 0;
      ctx.fillStyle = isEven ? "hsla(190, 100%, 50%, 0.6)" : "hsla(142, 71%, 45%, 0.6)";
      ctx.fillRect(i * 2, 150 - h, 2, h);
    }
  }, [histogramData]);

  const probabilityColor = result
    ? result.probability >= 70 ? "text-destructive" : result.probability >= 40 ? "text-yellow-500" : "text-[hsl(var(--decode-accent))]"
    : "";

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="card-glass rounded-xl p-5">
        <Label className="text-xs text-muted-foreground mb-2 block font-mono uppercase tracking-wider">// Steganalysis Scanner</Label>
        <div
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onClick={() => fileRef.current?.click()}
          className={`min-h-[120px] border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-3 cursor-pointer transition-all duration-300 mb-3 ${
            dragOver ? "border-yellow-500 bg-yellow-500/5" : "border-border/50 hover:border-yellow-500/50"
          }`}
        >
          <div className="text-muted-foreground text-sm font-mono">
            {image ? `> ${image.name}` : "> Drop suspicious image here"}
          </div>
          <Button variant="outline" className="text-xs font-mono border-yellow-500/50 hover:bg-yellow-500/10" onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}>
            Browse Image
          </Button>
          <input ref={fileRef} type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) loadImage(f); }} className="hidden" />
        </div>

        <Button onClick={analyze} disabled={!image || analyzing} className="w-full font-mono text-xs bg-gradient-to-r from-yellow-600 to-orange-800 hover:opacity-90">
          {analyzing ? "[ ANALYZING... ]" : "[ RUN STEGANALYSIS ]"}
        </Button>
      </div>

      {terminalLines.length > 0 && <TerminalOutput lines={terminalLines} />}

      {result && (
        <div className="card-glass rounded-xl p-5 space-y-4 animate-fade-in">
          <Label className="text-xs text-muted-foreground font-mono uppercase tracking-wider">// Analysis Results</Label>

          {/* Probability meter */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs font-mono text-muted-foreground">Hidden Data Probability</span>
              <span className={`text-lg font-bold font-mono ${probabilityColor}`}>{result.probability}%</span>
            </div>
            <Progress value={result.probability} className="h-2" />
            <p className={`text-xs font-mono font-bold ${probabilityColor}`}>{result.verdict}</p>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-2 text-xs font-mono">
            <div className="p-3 rounded-lg bg-background/50 border border-border/30 text-center">
              <p className="text-muted-foreground mb-1">Entropy (B)</p>
              <p className="text-[hsl(var(--encode-accent))] text-sm font-bold">{result.entropy.b.toFixed(3)}</p>
              <p className="text-muted-foreground/60">/ 8.000</p>
            </div>
            <div className="p-3 rounded-lg bg-background/50 border border-border/30 text-center">
              <p className="text-muted-foreground mb-1">LSB Flip Rate</p>
              <p className="text-[hsl(var(--encode-accent))] text-sm font-bold">{result.lsbRandomness.b.toFixed(4)}</p>
              <p className="text-muted-foreground/60">~0.5 = stego</p>
            </div>
            <div className="p-3 rounded-lg bg-background/50 border border-border/30 text-center">
              <p className="text-muted-foreground mb-1">Chi² Score</p>
              <p className="text-[hsl(var(--encode-accent))] text-sm font-bold">{result.chiSquare.b.toFixed(4)}</p>
              <p className="text-muted-foreground/60">{'<'}1.5 = stego</p>
            </div>
          </div>

          {/* Full channel breakdown */}
          <div className="p-3 rounded-lg bg-background/50 border border-border/30">
            <p className="text-xs font-mono text-muted-foreground mb-2">Channel Breakdown</p>
            <div className="grid grid-cols-4 gap-1 text-xs font-mono">
              <div></div>
              <div className="text-red-400 text-center">R</div>
              <div className="text-green-400 text-center">G</div>
              <div className="text-blue-400 text-center">B</div>
              <div className="text-muted-foreground">Entropy</div>
              <div className="text-center">{result.entropy.r.toFixed(2)}</div>
              <div className="text-center">{result.entropy.g.toFixed(2)}</div>
              <div className="text-center">{result.entropy.b.toFixed(2)}</div>
              <div className="text-muted-foreground">LSB</div>
              <div className="text-center">{result.lsbRandomness.r.toFixed(3)}</div>
              <div className="text-center">{result.lsbRandomness.g.toFixed(3)}</div>
              <div className="text-center">{result.lsbRandomness.b.toFixed(3)}</div>
              <div className="text-muted-foreground">Chi²</div>
              <div className="text-center">{result.chiSquare.r.toFixed(2)}</div>
              <div className="text-center">{result.chiSquare.g.toFixed(2)}</div>
              <div className="text-center">{result.chiSquare.b.toFixed(2)}</div>
            </div>
          </div>

          {/* Histogram */}
          {histogramData && (
            <div>
              <p className="text-xs font-mono text-muted-foreground mb-2">Blue Channel Histogram (even/odd pairs)</p>
              <canvas
                ref={(c) => { drawHistogram(c); }}
                className="w-full rounded-lg border border-border/30"
              />
              <p className="text-xs font-mono text-muted-foreground/60 mt-1">
                <span className="text-[hsl(var(--encode-accent))]">■</span> Even values{" "}
                <span className="text-[hsl(var(--decode-accent))]">■</span> Odd values — Similar heights suggest LSB embedding
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
