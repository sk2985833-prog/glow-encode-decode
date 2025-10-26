import { useEffect, useRef } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { calculateCapacity } from "@/lib/steganography";
import { toast } from "sonner";

interface ImagePreviewProps {
  image: HTMLImageElement | null;
  onSampleLoad: () => void;
  onClear: () => void;
  activeTab: "encode" | "decode";
}

export default function ImagePreview({ image, onSampleLoad, onClear, activeTab }: ImagePreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (image && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      
      const maxW = 400;
      const scale = image.width > maxW ? maxW / image.width : 1;
      
      canvas.width = image.width * scale;
      canvas.height = image.height * scale;
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    } else if (!image && canvasRef.current) {
      // Clear canvas when no image
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  }, [image]);

  const capacity = image ? calculateCapacity(image.width, image.height) : 0;

  return (
    <div className="space-y-4">
      <div className="card-glass rounded-xl p-6">
        <Label className="text-sm text-muted-foreground mb-3 block">Image Preview</Label>
        <div className="w-full aspect-[4/3] rounded-lg border border-border/50 bg-background/50 flex items-center justify-center overflow-hidden">
          <canvas
            ref={canvasRef}
            className="max-w-full max-h-full object-contain"
            width={400}
            height={300}
          />
        </div>
        <div className="flex justify-between items-center mt-4 text-xs text-muted-foreground">
          <span>{image ? `${image.width}×${image.height}` : "--"}</span>
          <span>{capacity > 0 ? `${capacity} bytes capacity` : "-- capacity"}</span>
        </div>
        <div className="mt-4 p-3 rounded-lg bg-background/50 border border-border/50">
          <p className="text-xs text-muted-foreground">
            Use larger images (1024×768+) for longer messages. All encoding happens locally in your browser.
          </p>
        </div>
      </div>

      <div className="card-glass rounded-xl p-6 space-y-3">
        <Label className="text-sm text-muted-foreground block">Quick Actions</Label>
        <div className="flex flex-col gap-2">
          <Button
            onClick={onClear}
            variant="outline"
            className={activeTab === "encode" ? "btn-encode" : "btn-decode"}
          >
            Clear All
          </Button>
          <Button
            onClick={onSampleLoad}
            variant="outline"
            className={activeTab === "encode" ? "btn-encode" : "btn-decode"}
          >
            Load Sample Image
          </Button>
        </div>
      </div>
    </div>
  );
}
