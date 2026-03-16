import { useEffect, useRef, useState } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface ImageComparisonProps {
  originalImage: HTMLImageElement | null;
  encodedCanvas: HTMLCanvasElement | null;
}

export default function ImageComparison({ originalImage, encodedCanvas }: ImageComparisonProps) {
  const heatmapRef = useRef<HTMLCanvasElement>(null);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [diffCount, setDiffCount] = useState(0);

  useEffect(() => {
    if (!originalImage || !encodedCanvas || !heatmapRef.current) return;

    const w = originalImage.width;
    const h = originalImage.height;
    const heatmap = heatmapRef.current;
    heatmap.width = w;
    heatmap.height = h;
    const hCtx = heatmap.getContext("2d")!;

    const origCanvas = document.createElement("canvas");
    origCanvas.width = w;
    origCanvas.height = h;
    const origCtx = origCanvas.getContext("2d")!;
    origCtx.drawImage(originalImage, 0, 0);
    const origData = origCtx.getImageData(0, 0, w, h).data;

    const encCtx = encodedCanvas.getContext("2d")!;
    const encData = encCtx.getImageData(0, 0, w, h).data;

    const heatData = hCtx.createImageData(w, h);
    let diffs = 0;

    for (let i = 0; i < origData.length; i += 4) {
      const dr = Math.abs(origData[i] - encData[i]);
      const dg = Math.abs(origData[i + 1] - encData[i + 1]);
      const db = Math.abs(origData[i + 2] - encData[i + 2]);
      const diff = dr + dg + db;

      if (diff > 0) {
        diffs++;
        const intensity = Math.min(diff * 80, 255);
        heatData.data[i] = intensity > 128 ? 255 : 0;
        heatData.data[i + 1] = intensity > 200 ? 0 : 255;
        heatData.data[i + 2] = 255;
        heatData.data[i + 3] = Math.min(intensity + 100, 255);
      } else {
        heatData.data[i] = 5;
        heatData.data[i + 1] = 8;
        heatData.data[i + 2] = 15;
        heatData.data[i + 3] = 255;
      }
    }

    hCtx.putImageData(heatData, 0, 0);
    setDiffCount(diffs);
  }, [originalImage, encodedCanvas, showHeatmap]);

  if (!originalImage || !encodedCanvas) return null;

  return (
    <div className="card-glass rounded-xl p-5 space-y-3 animate-fade-in">
      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground font-mono uppercase tracking-wider">// Image Comparison</Label>
        <Button variant="outline" size="sm" onClick={() => setShowHeatmap(!showHeatmap)} className="btn-encode text-xs font-mono">
          {showHeatmap ? "Hide Heatmap" : "Show Heatmap"}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <p className="text-[10px] text-muted-foreground text-center font-mono">ORIGINAL</p>
          <div className="border border-border/50 rounded-lg overflow-hidden">
            <canvas
              ref={(ref) => {
                if (ref && originalImage) {
                  ref.width = originalImage.width;
                  ref.height = originalImage.height;
                  const ctx = ref.getContext("2d");
                  if (ctx) ctx.drawImage(originalImage, 0, 0);
                }
              }}
              className="w-full"
            />
          </div>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] text-muted-foreground text-center font-mono">ENCODED</p>
          <div className="border border-border/50 rounded-lg overflow-hidden">
            <canvas
              ref={(ref) => {
                if (ref && encodedCanvas) {
                  ref.width = encodedCanvas.width;
                  ref.height = encodedCanvas.height;
                  const ctx = ref.getContext("2d");
                  if (ctx) ctx.drawImage(encodedCanvas, 0, 0);
                }
              }}
              className="w-full"
            />
          </div>
        </div>
      </div>

      {showHeatmap && (
        <div className="space-y-1 animate-fade-in">
          <p className="text-[10px] text-muted-foreground text-center font-mono">
            PIXEL DIFF — <span className="text-[hsl(var(--encode-accent))]">{diffCount.toLocaleString()}</span> modified
          </p>
          <div className="border border-[hsl(var(--encode-accent))]/20 rounded-lg overflow-hidden glow-encode">
            <canvas ref={heatmapRef} className="w-full" />
          </div>
        </div>
      )}
    </div>
  );
}
