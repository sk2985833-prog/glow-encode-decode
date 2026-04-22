import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Eye, EyeOff, KeyRound, Shuffle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import InlineError from "@/components/InlineError";
import {
  stringToUint8Array,
  uint8ToBitArray,
  writeBitsToImageData,
  encryptMessage,
  generatePassword,
  calculateCapacity,
  EncodingMode,
} from "@/lib/steganography";

interface EncodeTabProps {
  image: HTMLImageElement | null;
  onImageLoad: (img: HTMLImageElement) => void;
  onEncoded?: (canvas: HTMLCanvasElement) => void;
  onHistoryAdd?: (entry: { type: "encode"; summary: string; detail?: string }) => void;
  onLog?: (level: "info" | "ok" | "warn" | "err" | "sys", source: string, message: string) => void;
}

type InputMode = "text" | "file";

const MODE_INFO: Record<EncodingMode, { label: string; icon: string; desc: string }> = {
  lsb: { label: "LSB (Fast)", icon: "⚡", desc: "Standard LSB — 1 bit in blue channel" },
  'multi-bit': { label: "Multi-bit LSB", icon: "🔥", desc: "6 bits/pixel across RGB — 6× capacity" },
  'random-pixel': { label: "Random Pixel", icon: "🎲", desc: "Key-shuffled pixel order — harder to detect" },
  'edge-based': { label: "Edge-based", icon: "🔬", desc: "Hides in edges — resists steganalysis" },
};

export default function EncodeTab({ image, onImageLoad, onEncoded, onHistoryAdd, onLog }: EncodeTabProps) {
  const [encodeResult, setEncodeResult] = useState<{ mode: string; encrypted: boolean; size: number; capacity: number } | null>(null);
  const [message, setMessage] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [progress, setProgress] = useState(0);
  const [encoding, setEncoding] = useState(false);
  const [encodedCanvas, setEncodedCanvas] = useState<HTMLCanvasElement | null>(null);
  const [inputMode, setInputMode] = useState<InputMode>("text");
  const [secretFile, setSecretFile] = useState<File | null>(null);
  const [encodingMode, setEncodingMode] = useState<EncodingMode>("lsb");
  const [embedKey, setEmbedKey] = useState("");
  const [validationError, setValidationError] = useState<{ code: string; title: string; reason: string; hint?: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const secretFileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const capacity = image ? calculateCapacity(image.width, image.height, encodingMode) : 0;

  const loadImage = useCallback(
    (file: File) => {
      const MAX_FILE_SIZE = 50_000_000;
      const MAX_DIMENSION = 8192;
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`Image too large. Max: ${MAX_FILE_SIZE / 1_000_000}MB`);
        return;
      }
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        if (img.width > MAX_DIMENSION || img.height > MAX_DIMENSION) {
          toast.error(`Image dimensions too large. Max: ${MAX_DIMENSION}px per side`);
          URL.revokeObjectURL(url);
          return;
        }
        onImageLoad(img);
        URL.revokeObjectURL(url);
        toast.success(`Image loaded: ${img.width}×${img.height}`);
      };
      img.src = url;
    },
    [onImageLoad]
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) loadImage(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) loadImage(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleGenerate = () => {
    setPassword(generatePassword());
    setShowPassword(true);
    toast.success("Password generated");
  };

  const handleSecretFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1_000_000) {
        toast.error("Secret file too large. Max: 1MB");
        return;
      }
      setSecretFile(file);
      toast.success(`File selected: ${file.name} (${(file.size / 1024).toFixed(1)}KB)`);
    }
  };

  const handleEncode = async () => {
    setValidationError(null);
    if (!image) {
      const err = { code: "E-NO-COVER", title: "Cover image required", reason: "Embed pipeline aborted — no ImageData buffer is loaded for the cover.", hint: "Drop a PNG/JPEG into the upload zone above." };
      setValidationError(err);
      onLog?.("err", "validate", `${err.code} · ${err.reason}`);
      return;
    }
    if (inputMode === "text" && !message.trim()) {
      const err = { code: "E-EMPTY-PAYLOAD", title: "Empty payload rejected", reason: "Bitstream length = 0 after stringToUint8Array(). Refusing to write a no-op header.", hint: "Type a message or switch to Hide File mode." };
      setValidationError(err);
      onLog?.("err", "validate", `${err.code} · payload=0B`);
      return;
    }
    if (inputMode === "file" && !secretFile) {
      const err = { code: "E-NO-FILE", title: "Secret file required", reason: "FILE: payload requested but no File handle was selected.", hint: "Pick a file (≤1MB) to embed." };
      setValidationError(err);
      onLog?.("err", "validate", `${err.code} · file=null`);
      return;
    }

    setEncoding(true);
    setProgress(0);
    const t0 = performance.now();
    onLog?.("sys",  "embed",  `OP-01 / EMBED initiated · mode=${encodingMode}`);
    onLog?.("info", "embed",  `cover dims=${image.width}×${image.height} · capacity=${capacity}B`);

    try {
      let payloadStr: string;
      if (inputMode === "file" && secretFile) {
        onLog?.("info", "embed", `reading file handle · ${secretFile.name} · ${(secretFile.size / 1024).toFixed(1)}KB`);
        const buffer = await secretFile.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        onLog?.("info", "embed", `arrayBuffer → uint8(${bytes.length}) · base64 encoding`);
        const b64 = btoa(String.fromCharCode(...Array.from(bytes)));
        payloadStr = `FILE:${secretFile.name}:${secretFile.type}:${b64}`;
      } else {
        payloadStr = message;
      }

      const pw = password.trim();
      if (pw) {
        onLog?.("info", "crypto", "PBKDF2-SHA256 key derivation start · iter=250000");
        const tk = performance.now();
        payloadStr = await encryptMessage(pw, payloadStr);
        onLog?.("ok",   "crypto", `key derived & AES-256-GCM seal complete · ${(performance.now() - tk).toFixed(2)}ms`);
        payloadStr = "ENC:" + payloadStr;
      } else if (inputMode === "text") {
        payloadStr = "PLAIN:" + payloadStr;
        onLog?.("warn", "crypto", "no key supplied · payload tagged PLAIN: (cleartext)");
      }

      // Store encoding mode in payload header
      const modeHeader = `MODE:${encodingMode}:`;
      payloadStr = modeHeader + payloadStr;

      const payloadBytes = stringToUint8Array(payloadStr);
      const length = payloadBytes.length;

      if (length > capacity) {
        const err = {
          code: "E-CAPACITY",
          title: "Payload exceeds cover capacity",
          reason: `Bitstream needs ${length}B but cover (${image.width}×${image.height}, mode=${encodingMode}) only offers ${capacity}B.`,
          hint: "Shorten the message, switch to multi-bit mode, or use a larger cover image.",
        };
        setValidationError(err);
        onLog?.("err", "embed", `${err.code} · need=${length}B have=${capacity}B`);
        setEncoding(false);
        return;
      }

      const header = new Uint8Array(4);
      header[0] = (length >> 24) & 0xff;
      header[1] = (length >> 16) & 0xff;
      header[2] = (length >> 8) & 0xff;
      header[3] = length & 0xff;

      const combined = new Uint8Array(4 + payloadBytes.length);
      combined.set(header, 0);
      combined.set(payloadBytes, 4);

      const bits = uint8ToBitArray(combined);
      onLog?.("info", "embed", `header=4B · payload=${length}B · bitstream=${bits.length} bits`);
      onLog?.("info", "canvas", "allocating offscreen canvas · drawImage(cover, 0, 0)");
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(image, 0, 0);
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      onLog?.("info", "canvas", `getImageData → Uint8ClampedArray(${imgData.data.length})`);

      const keyNum = embedKey ? parseInt(embedKey) || 483920 : undefined;
      if (keyNum !== undefined) onLog?.("info", "embed", `keyed permutation seed=${keyNum}`);

      onLog?.("sys", "embed", `bit-write start · algo=${encodingMode}`);
      await new Promise<void>((resolve) => {
        setTimeout(() => {
          writeBitsToImageData(imgData, bits, (p) => setProgress(p), encodingMode, keyNum);
          ctx.putImageData(imgData, 0, 0);
          resolve();
        }, 60);
      });
      onLog?.("ok", "embed", `bit-write complete · putImageData → cover modulated`);

      setEncodedCanvas(canvas);
      onEncoded?.(canvas);
      const dt = performance.now() - t0;
      onLog?.("ok", "embed", `OP-01 complete · ${length}B injected · ${dt.toFixed(2)}ms total`);
      setEncodeResult({
        mode: encodingMode,
        encrypted: !!password.trim(),
        size: length,
        capacity,
      });
      onHistoryAdd?.({
        type: "encode",
        summary: `Encoded ${length} bytes (${encodingMode})`,
        detail: inputMode === "text" ? message : secretFile?.name,
      });
      toast.success("Encoding complete!");
    } catch (err) {
      const reason = (err as Error).message;
      setValidationError({ code: "E-EMBED-FAIL", title: "Embed pipeline failed", reason, hint: "Check console; the cover or payload may be malformed." });
      onLog?.("err", "embed", `pipeline exception · ${reason}`);
    } finally {
      setEncoding(false);
      setProgress(0);
    }
  };

  const handleDownload = () => {
    if (!encodedCanvas) return;
    encodedCanvas.toBlob((blob) => {
      if (blob) {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `stego-${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        toast.success("Image downloaded");
      }
    }, "image/png");
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Image upload */}
      <div className="card-glass rounded-xl p-5">
        <Label className="text-xs text-muted-foreground mb-2 block font-mono uppercase tracking-wider">// Upload Cover Image</Label>
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={() => setDragOver(false)}
          onClick={() => fileInputRef.current?.click()}
          className={`min-h-[140px] border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-3 cursor-pointer transition-all duration-300 ${
            dragOver
              ? "border-[hsl(var(--encode-accent))] bg-[hsl(var(--encode-accent))]/5 glow-encode"
              : "border-border/50 hover:border-[hsl(var(--encode-accent))]/50"
          }`}
        >
          <div className="text-muted-foreground text-sm font-mono">{'>'} Drag & drop image or click to browse</div>
          <Button variant="outline" className="btn-encode text-xs" onClick={(e) => e.stopPropagation()}>
            Browse Image
          </Button>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
          {image && (
            <div className="text-xs text-muted-foreground font-mono">
              {image.width}×{image.height} | {Math.round((image.width * image.height) / 1000)}k px | {capacity.toLocaleString()} byte capacity
            </div>
          )}
        </div>
      </div>

      {/* Encoding Algorithm Selection */}
      <div className="card-glass rounded-xl p-5 space-y-3">
        <Label className="text-xs text-muted-foreground font-mono uppercase tracking-wider">// Encoding Algorithm</Label>
        <Select value={encodingMode} onValueChange={(v) => setEncodingMode(v as EncodingMode)}>
          <SelectTrigger className="bg-background/50 font-mono text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(MODE_INFO).map(([key, info]) => (
              <SelectItem key={key} value={key} className="font-mono">
                <span className="mr-2">{info.icon}</span> {info.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground font-mono">
          {MODE_INFO[encodingMode].icon} {MODE_INFO[encodingMode].desc}
        </p>
        {encodingMode === 'random-pixel' && (
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block font-mono">Embedding Key</Label>
            <Input
              value={embedKey}
              onChange={(e) => setEmbedKey(e.target.value.replace(/\D/g, ''))}
              placeholder="483920 (default)"
              className="bg-background/50 font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground mt-1 font-mono">Key determines pixel order — share with recipient</p>
          </div>
        )}
      </div>

      {/* Input mode toggle + content */}
      <div className="card-glass rounded-xl p-5 space-y-3">
        <div className="flex gap-2">
          <Button
            variant={inputMode === "text" ? "default" : "outline"}
            size="sm"
            onClick={() => setInputMode("text")}
            className={`font-mono text-xs ${inputMode === "text" ? "btn-encode" : ""}`}
          >
            {'>'} Text Message
          </Button>
          <Button
            variant={inputMode === "file" ? "default" : "outline"}
            size="sm"
            onClick={() => setInputMode("file")}
            className={`font-mono text-xs ${inputMode === "file" ? "btn-encode" : ""}`}
          >
            {'>'} Hide File
          </Button>
        </div>

        {inputMode === "text" ? (
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block font-mono uppercase tracking-wider">// Secret Message</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="> Enter classified message..."
              className="min-h-[100px] bg-background/50 font-mono text-sm"
              maxLength={1_000_000}
            />
            <div className="flex justify-between items-center mt-1 text-xs text-muted-foreground font-mono">
              <span>{message.length.toLocaleString()} / {capacity.toLocaleString()} chars</span>
              <span>LSB blue channel</span>
            </div>
          </div>
        ) : (
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block font-mono uppercase tracking-wider">// Secret File</Label>
            <div
              onClick={() => secretFileRef.current?.click()}
              className="min-h-[80px] border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-2 cursor-pointer transition-all duration-300 border-border/50 hover:border-[hsl(var(--encode-accent))]/50"
            >
              {secretFile ? (
                <div className="text-center">
                  <p className="text-sm font-mono text-[hsl(var(--encode-accent))]">{secretFile.name}</p>
                  <p className="text-xs text-muted-foreground mt-1 font-mono">
                    {(secretFile.size / 1024).toFixed(1)} KB • {secretFile.type || "unknown type"}
                  </p>
                </div>
              ) : (
                <div className="text-muted-foreground text-xs font-mono">
                  {'>'} Select file (TXT, PDF, ZIP, images — max 1MB)
                </div>
              )}
            </div>
            <input ref={secretFileRef} type="file" accept=".txt,.pdf,.zip,.png,.jpg,.jpeg,.gif,.doc,.docx" onChange={handleSecretFile} className="hidden" />
          </div>
        )}

        {/* Password */}
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block font-mono uppercase tracking-wider">// AES-256 Encryption Key</Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type={showPassword ? "text" : "password"}
                placeholder="Enter encryption key..."
                className="flex-1 bg-background/50 pl-10 pr-10 font-mono text-sm"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <Button onClick={handleGenerate} variant="outline" className="btn-encode text-xs font-mono" size="sm">
              <Shuffle className="h-3 w-3 mr-1" /> Generate
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1 font-mono">
            {password ? "🔒 AES-256-GCM • PBKDF2 250k iterations" : "⚠ No key — payload stored as plaintext"}
          </p>
        </div>

        {progress > 0 && (
          <div className="space-y-1">
            <Progress value={progress} className="h-1.5" />
            <p className="text-xs text-muted-foreground font-mono text-center">Encoding: {progress}%</p>
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <Button onClick={handleEncode} disabled={encoding || !image} className="btn-encode font-mono text-xs">
            {encoding ? "[ ENCODING... ]" : "[ ENCODE ]"}
          </Button>
          {encodedCanvas && (
            <Button onClick={handleDownload} variant="outline" className="btn-encode font-mono text-xs">
              ⬇ Download
            </Button>
          )}
        </div>
        {validationError && (
          <InlineError {...validationError} />
        )}
      </div>

      {/* Structured encode result */}
      {encodedCanvas && encodeResult && (
        <div className="card-glass rounded-xl p-5 space-y-4 animate-fade-in">
          <Label className="text-xs text-muted-foreground mb-2 block font-mono uppercase tracking-wider">// Encoded Output</Label>
          
          {/* Status card */}
          <div className="p-4 rounded-lg bg-[hsl(var(--decode-accent))]/5 border border-[hsl(var(--decode-accent))]/30">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-[hsl(var(--decode-accent))] animate-pulse" />
              <span className="text-sm font-bold font-mono text-[hsl(var(--decode-accent))]">✔ ENCODING SUCCESSFUL</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="p-2 rounded bg-background/50">
                <span className="text-muted-foreground">Algorithm</span>
                <p className="text-[hsl(var(--encode-accent))] font-semibold">{MODE_INFO[encodeResult.mode as EncodingMode]?.label || encodeResult.mode}</p>
              </div>
              <div className="p-2 rounded bg-background/50">
                <span className="text-muted-foreground">Encryption</span>
                <p className={encodeResult.encrypted ? "text-yellow-400 font-semibold" : "text-muted-foreground"}>{encodeResult.encrypted ? "🔒 AES-256-GCM" : "🔓 None"}</p>
              </div>
              <div className="p-2 rounded bg-background/50">
                <span className="text-muted-foreground">Payload Size</span>
                <p className="text-foreground font-semibold">{encodeResult.size.toLocaleString()} bytes</p>
              </div>
              <div className="p-2 rounded bg-background/50">
                <span className="text-muted-foreground">Capacity Used</span>
                <p className="text-foreground font-semibold">{((encodeResult.size / encodeResult.capacity) * 100).toFixed(1)}%</p>
              </div>
            </div>
          </div>

          <canvas
            ref={(ref) => {
              if (ref && encodedCanvas) {
                ref.width = encodedCanvas.width;
                ref.height = encodedCanvas.height;
                const ctx = ref.getContext("2d");
                if (ctx) ctx.drawImage(encodedCanvas, 0, 0);
              }
            }}
            className="w-full rounded-lg border border-border/50"
          />
        </div>
      )}
    </div>
  );
}
