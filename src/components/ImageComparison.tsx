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

    // Get original pixels
    const origCanvas = document.createElement("canvas");
    origCanvas.width = w;
    origCanvas.height = h;
    const origCtx = origCanvas.getContext("2d")!;
    origCtx.drawImage(originalImage, 0, 0);
    const origData = origCtx.getImageData(0, 0, w, h).data;

    // Get encoded pixels
    const encCtx = encodedCanvas.getContext("2d")!;
    const encData = encCtx.getImageData(0, 0, w, h).data;

    // Generate heatmap
    const heatData = hCtx.createImageData(w, h);
    let diffs = 0;

    for (let i = 0; i < origData.length; i += 4) {
      const dr = Math.abs(origData[i] - encData[i]);
      const dg = Math.abs(origData[i + 1] - encData[i + 1]);
      const db = Math.abs(origData[i + 2] - encData[i + 2]);
      const diff = dr + dg + db;

      if (diff > 0) {
        diffs++;
        // Cyan-to-magenta heatmap
        const intensity = Math.min(diff * 80, 255);
        heatData.data[i] = intensity > 128 ? 255 : 0;      // R
        heatData.data[i + 1] = intensity > 200 ? 0 : 255;   // G
        heatData.data[i + 2] = 255;                          // B
        heatData.data[i + 3] = Math.min(intensity + 100, 255);
      } else {
        heatData.data[i] = 10;
        heatData.data[i + 1] = 12;
        heatData.data[i + 2] = 20;
        heatData.data[i + 3] = 255;
      }
    }

    hCtx.putImageData(heatData, 0, 0);
    setDiffCount(diffs);
  }, [originalImage, encodedCanvas, showHeatmap]);

  if (!originalImage || !encodedCanvas) return null;

  return (
    <div className="card-glass rounded-xl p-6 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <Label className="text-sm text-muted-foreground">Image Comparison</Label>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowHeatmap(!showHeatmap)}
          className="btn-encode text-xs"
        >
          {showHeatmap ? "Hide Heatmap" : "Show Pixel Diff Heatmap"}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground text-center font-mono">ORIGINAL</p>
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

        <div className="space-y-2">
          <p className="text-xs text-muted-foreground text-center font-mono">ENCODED</p>
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
        <div className="space-y-2 animate-fade-in">
          <p className="text-xs text-muted-foreground text-center font-mono">
            PIXEL DIFFERENCE HEATMAP — <span className="text-[hsl(var(--encode-accent))]">{diffCount.toLocaleString()}</span> pixels modified
          </p>
          <div className="border border-[hsl(var(--encode-accent))]/30 rounded-lg overflow-hidden glow-encode">
            <canvas ref={heatmapRef} className="w-full" />
          </div>
          <p className="text-xs text-muted-foreground/60 text-center">
            Bright pixels = modified • Dark pixels = unchanged
          </p>
        </div>
      )}
    </div>
  );
}
