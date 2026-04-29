import { useState, useRef, useCallback, forwardRef, useImperativeHandle } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Eye, EyeOff, KeyRound, Copy } from "lucide-react";
import { readBitsFromImageData, bitsToUint8Array, decryptMessage, sha256Hex, EncodingMode, LsbDepth, DEFAULT_LSB_DEPTH } from "@/lib/steganography";
import TerminalOutput from "./TerminalOutput";
import InlineError from "@/components/InlineError";

export interface DecodeTabRef {
  clear: () => void;
}

interface DecodeTabProps {
  onHistoryAdd?: (entry: { type: "decode"; summary: string; detail?: string }) => void;
  onLog?: (level: "info" | "ok" | "warn" | "err" | "sys", source: string, message: string) => void;
}

const MODE_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  lsb: { label: "LSB (Standard)", icon: "⚡", color: "text-[hsl(var(--encode-accent))]" },
  'multi-bit': { label: "Multi-bit LSB", icon: "🔥", color: "text-orange-400" },
  'random-pixel': { label: "Random Pixel", icon: "🎲", color: "text-purple-400" },
  'edge-based': { label: "Edge-based", icon: "🔬", color: "text-cyan-400" },
};

function tryReadHeader(imgData: ImageData, mode: EncodingMode, key?: number, depth: LsbDepth = DEFAULT_LSB_DEPTH): { valid: boolean; length: number; payload: string } {
  try {
    const headerBits = readBitsFromImageData(imgData, 32, mode, key, depth);
    const headerBytes = bitsToUint8Array(headerBits);
    const length = (headerBytes[0] << 24) | (headerBytes[1] << 16) | (headerBytes[2] << 8) | headerBytes[3];
    if (length <= 0 || length > 500_000) return { valid: false, length: 0, payload: "" };

    const totalBits = (4 + length) * 8;
    const allBits = readBitsFromImageData(imgData, totalBits, mode, key, depth);
    const allBytes = bitsToUint8Array(allBits);
    const payload = new TextDecoder().decode(allBytes.slice(4));

    if (payload.startsWith("MODE:") || payload.startsWith("ENC:") || payload.startsWith("PLAIN:") || payload.startsWith("FILE:")) {
      return { valid: true, length, payload };
    }
    return { valid: false, length, payload };
  } catch {
    return { valid: false, length: 0, payload: "" };
  }
}

/** Strip and verify a SHA256:<hex>:<payload> envelope. Returns the inner payload. Throws on mismatch. */
async function verifyAndStripChecksum(payload: string): Promise<string> {
  if (!payload.startsWith("SHA256:")) return payload; // legacy: no checksum
  const sep = payload.indexOf(":", 7);
  if (sep < 0) throw new Error("Malformed SHA256 envelope");
  const expected = payload.slice(7, sep).toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(expected)) throw new Error("Malformed SHA256 envelope");
  const inner = payload.slice(sep + 1);
  const actual = (await sha256Hex(inner)).toLowerCase();
  if (actual !== expected) throw new Error("SHA-256 checksum mismatch");
  return inner;
}

const DecodeTab = forwardRef<DecodeTabRef, DecodeTabProps>(({ onHistoryAdd, onLog }, ref) => {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [decodedMessage, setDecodedMessage] = useState("");
  const [decodedInfo, setDecodedInfo] = useState("");
  const [uploadedImage, setUploadedImage] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [terminalLines, setTerminalLines] = useState<string[]>([]);
  const [isDecoding, setIsDecoding] = useState(false);
  const [decodedFile, setDecodedFile] = useState<{ name: string; type: string; data: Uint8Array } | null>(null);
  const [embedKey, setEmbedKey] = useState("");
  const [detectedMode, setDetectedMode] = useState<EncodingMode | null>(null);
  const [detectedDepth, setDetectedDepth] = useState<LsbDepth | null>(null);
  const [detectedEncrypted, setDetectedEncrypted] = useState(false);
  const [validationError, setValidationError] = useState<{ code: string; title: string; reason: string; hint?: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClear = useCallback(() => {
    setPassword("");
    setDecodedMessage("");
    setDecodedInfo("");
    setUploadedImage(null);
    setTerminalLines([]);
    setDecodedFile(null);
    setEmbedKey("");
    setDetectedMode(null);
    setDetectedDepth(null);
    setDetectedEncrypted(false);
    setValidationError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  useImperativeHandle(ref, () => ({ clear: handleClear }));

  const loadImage = useCallback((file: File) => {
    setUploadedImage(file);
    toast.success("Image loaded for decoding");
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) loadImage(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) loadImage(file);
  };

  const handleDownloadFile = () => {
    if (!decodedFile) return;
    const blob = new Blob([decodedFile.data.buffer as ArrayBuffer], { type: decodedFile.type || "application/octet-stream" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = decodedFile.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast.success(`File downloaded: ${decodedFile.name}`);
  };

  const handleDecode = async () => {
    const file = uploadedImage || fileInputRef.current?.files?.[0];
    setValidationError(null);
    if (!file) {
      const err = { code: "D-NO-INPUT", title: "No carrier supplied", reason: "Extract pipeline aborted — no encoded image is loaded.", hint: "Drop a stego-PNG into the upload zone." };
      setValidationError(err);
      onLog?.("err", "validate", `${err.code} · ${err.reason}`);
      return;
    }
    if (!file.type.startsWith("image/")) {
      const err = { code: "D-BAD-MIME", title: "Unsupported file type", reason: `MIME=${file.type || "unknown"} — extract requires image/png or image/jpeg.`, hint: "PNG strongly recommended (JPEG is lossy)." };
      setValidationError(err);
      onLog?.("err", "validate", `${err.code} · mime=${file.type}`);
      return;
    }
    if (file.type !== "image/png" && !/\.png$/i.test(file.name)) {
      const err = { code: "D-NOT-PNG", title: "PNG required", reason: `MIME=${file.type || "unknown"} — only lossless PNG carriers are accepted (JPEG destroys LSB data).`, hint: "Re-encode the carrier as PNG." };
      setValidationError(err);
      onLog?.("err", "validate", `${err.code} · mime=${file.type}`);
      return;
    }

    setIsDecoding(true);
    setDecodedMessage("");
    setDecodedFile(null);
    setDetectedMode(null);
    setDetectedEncrypted(false);
    const t0 = performance.now();
    onLog?.("sys",  "extract", `OP-02 / EXTRACT initiated · target=${file.name}`);
    onLog?.("info", "extract", `file size=${(file.size / 1024).toFixed(1)}KB · mime=${file.type}`);
    setTerminalLines([
      "$ stego-decoder --init",
      `Loading target: ${file.name}`,
      "Scanning pixel matrix...",
    ]);

    const reader = new FileReader();
    reader.onload = async (e) => {
      const img = new Image();
      img.onload = async () => {
        onLog?.("info", "canvas", `image decoded · ${img.width}×${img.height} · alloc canvas`);
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0);

        try {
          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          onLog?.("info", "canvas", `getImageData → Uint8ClampedArray(${imgData.data.length})`);
          setTerminalLines((prev) => [...prev, "Auto-detecting encoding algorithm..."]);

          const keyNum = embedKey ? parseInt(embedKey) || 483920 : undefined;
          const modes: EncodingMode[] = ['lsb', 'multi-bit', 'random-pixel', 'edge-based'];
          let found = false;
          let detMode: EncodingMode = 'lsb';
          let detDepth: LsbDepth = DEFAULT_LSB_DEPTH;
          let payload = "";

          // Try each mode × depth (1..4 for LSB-style modes) to find valid data
          outer: for (const mode of modes) {
            const key = mode === 'random-pixel' ? keyNum : undefined;
            const depths: LsbDepth[] = mode === 'multi-bit' ? [1] : [1, 2, 3, 4];
            for (const d of depths) {
              onLog?.("info", "extract", `probing mode=${mode}${mode === 'multi-bit' ? "" : ` · depth=${d}`}${key ? ` · key=${key}` : ""}`);
              const result = tryReadHeader(imgData, mode, key, d);
              if (result.valid) {
                found = true;
                detMode = mode;
                detDepth = d;
                payload = result.payload;
                onLog?.("ok", "extract", `signature matched · algo=${mode}${mode === 'multi-bit' ? "" : ` · depth=${d}`} · payload=${result.length}B`);
                setTerminalLines((prev) => [...prev, `[OK] Detected algorithm: ${mode.toUpperCase()}${mode === 'multi-bit' ? "" : ` (depth=${d})`}`]);
                break outer;
              }
            }
          }

          if (!found) {
            onLog?.("err", "extract", "no valid stego signature in any of 4 modes");
            setTerminalLines((prev) => [...prev, "[ERR] No valid stego data found in any mode", "STATUS: NO HIDDEN DATA ✖"]);
            setValidationError({
              code: "D-NO-SIGNATURE",
              title: "No stego signature detected",
              reason: "Probed lsb, multi-bit, random-pixel, edge-based — none yielded a valid MODE:/ENC:/PLAIN:/FILE: header.",
              hint: "Confirm this image was produced by StegLab. JPEG re-saves destroy LSB data.",
            });
            setIsDecoding(false);
            toast.error("No hidden data found");
            return;
          }

          setDetectedMode(detMode);
          if (detMode !== 'multi-bit') setDetectedDepth(detDepth);

          // Strip MODE: header if present (supports MODE:<algo>: and MODE:<algo>:depth=<n>:)
          if (payload.startsWith("MODE:")) {
            // consume tokens until the next non-meta token (ENC|PLAIN|FILE|SHA256)
            let rest = payload.slice(5);
            while (rest.length && !/^(ENC:|PLAIN:|FILE:|SHA256:)/.test(rest)) {
              const i = rest.indexOf(":");
              if (i < 0) break;
              rest = rest.slice(i + 1);
            }
            payload = rest;
          }

          if (payload.startsWith("ENC:")) {
            setDetectedEncrypted(true);
            onLog?.("info", "crypto", "ENC: prefix detected · entering AES-256-GCM unseal");
            setTerminalLines((prev) => [...prev, "🔒 Encrypted payload detected", "Attempting AES-256-GCM decryption..."]);
            const b64 = payload.slice(4);
            const pw = password.trim();
            if (!pw) {
              onLog?.("err", "crypto", "key absent · cannot derive PBKDF2 → halt");
              setValidationError({
                code: "D-NO-KEY",
                title: "Decryption key required",
                reason: "Carrier contains an AES-256-GCM sealed payload but no key was supplied.",
                hint: "Enter the same passphrase used during embed and re-run extract.",
              });
              setTerminalLines((prev) => [...prev, "[ERR] Decode failed"]);
              setIsDecoding(false);
              toast.error("Unable to decode message");
              return;
            }
            try {
              onLog?.("info", "crypto", "PBKDF2-SHA256 derive · iter=250000");
              const tk = performance.now();
              let dec = await decryptMessage(pw, b64);
              onLog?.("ok", "crypto", `unseal complete · ${(performance.now() - tk).toFixed(2)}ms`);
              try {
                const before = dec;
                dec = await verifyAndStripChecksum(dec);
                if (before !== dec) onLog?.("ok", "integrity", `SHA-256 verified`);
              } catch (vErr) {
                onLog?.("err", "integrity", (vErr as Error).message);
                setValidationError({
                  code: "D-CHECKSUM",
                  title: "Integrity check failed",
                  reason: "SHA-256 of recovered payload does not match the embedded checksum.",
                  hint: "Carrier was modified post-embed (compression, resize, or tamper).",
                });
                setIsDecoding(false);
                toast.error("Checksum mismatch");
                return;
              }
              if (dec.startsWith("FILE:")) {
                const parts = dec.split(":");
                const fileName = parts[1];
                const fileType = parts[2];
                const b64Data = dec.slice(`FILE:${fileName}:${fileType}:`.length);
                const binary = atob(b64Data);
                const bytes = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
                setDecodedFile({ name: fileName, type: fileType, data: bytes });
                setDecodedInfo(`Decrypted file: ${fileName}`);
                setTerminalLines((prev) => [...prev, `[OK] Decrypted file: ${fileName}`, "STATUS: COMPLETE ✔"]);
              } else {
                setDecodedMessage(dec);
                setDecodedInfo("Decrypted with AES-256-GCM");
                setTerminalLines((prev) => [...prev, "[OK] Decryption successful", "Message recovered ✔"]);
              }
              onHistoryAdd?.({ type: "decode", summary: dec.startsWith("FILE:") ? `Decrypted file` : `Decrypted message (${detMode})`, detail: dec.startsWith("FILE:") ? undefined : dec });
              onLog?.("ok", "extract", `OP-02 complete · ${(performance.now() - t0).toFixed(2)}ms total`);
              toast.success("Decoded successfully!");
            } catch {
              onLog?.("err", "crypto", "GCM auth tag mismatch · wrong key or corrupted payload");
              setValidationError({
                code: "D-AUTH-FAIL",
                title: "Decryption failed",
                reason: "AES-256-GCM authentication tag did not verify. Either the key is wrong or the carrier was modified after embed.",
                hint: "Re-check the passphrase. Even one byte change in the cover invalidates the GCM tag.",
              });
              setTerminalLines((prev) => [...prev, "[ERR] Decode failed"]);
              setIsDecoding(false);
              toast.error("Unable to decode message");
              return;
            }
          } else if (payload.startsWith("FILE:")) {
            let cleared = payload;
            try { cleared = await verifyAndStripChecksum(cleared); } catch (vErr) {
              onLog?.("err", "integrity", (vErr as Error).message);
              setValidationError({ code: "D-CHECKSUM", title: "Integrity check failed", reason: (vErr as Error).message });
              setIsDecoding(false); toast.error("Checksum mismatch"); return;
            }
            const parts = cleared.split(":");
            const fileName = parts[1];
            const fileType = parts[2];
            const b64Data = cleared.slice(`FILE:${fileName}:${fileType}:`.length);
            const binary = atob(b64Data);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            setDecodedFile({ name: fileName, type: fileType, data: bytes });
            setDecodedInfo(`Hidden file: ${fileName}`);
            setTerminalLines((prev) => [...prev, `File recovered: ${fileName}`, "STATUS: COMPLETE ✔"]);
            onHistoryAdd?.({ type: "decode", summary: `File recovered: ${fileName}` });
            onLog?.("ok", "extract", `OP-02 complete · file=${fileName} · ${bytes.length}B`);
            toast.success("File decoded!");
          } else if (payload.startsWith("PLAIN:")) {
            let inner = payload.slice(6);
            try { inner = await verifyAndStripChecksum(inner); onLog?.("ok", "integrity", `SHA-256 verified`); }
            catch (vErr) {
              onLog?.("err", "integrity", (vErr as Error).message);
              setValidationError({ code: "D-CHECKSUM", title: "Integrity check failed", reason: (vErr as Error).message });
              setIsDecoding(false); toast.error("Checksum mismatch"); return;
            }
            setDecodedMessage(inner);
            setDecodedInfo("Plaintext payload · SHA-256 verified");
            setTerminalLines((prev) => [...prev, "Plaintext payload extracted", "STATUS: COMPLETE ✔"]);
            onHistoryAdd?.({ type: "decode", summary: `Decoded plaintext (${detMode})`, detail: inner });
            onLog?.("ok", "extract", `OP-02 complete · plaintext · ${inner.length}B`);
            toast.success("Message decoded!");
          } else {
            setDecodedMessage(payload);
            setDecodedInfo("Raw payload (legacy format)");
            setTerminalLines((prev) => [...prev, "Raw data extracted", "STATUS: COMPLETE ✔"]);
            toast.success("Message decoded");
          }
        } catch (err) {
          const reason = (err as Error).message;
          onLog?.("err", "extract", `pipeline exception · ${reason}`);
          setValidationError({ code: "D-EXTRACT-FAIL", title: "Extract pipeline failed", reason, hint: "The carrier may be truncated or in an unsupported format." });
          setTerminalLines((prev) => [...prev, `[ERR] ${(err as Error).message}`]);
          toast.error("Decoding failed");
        } finally {
          setIsDecoding(false);
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const modeInfo = detectedMode ? MODE_LABELS[detectedMode] : null;

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="card-glass rounded-xl p-5">
        <Label className="text-xs text-muted-foreground mb-2 block font-mono uppercase tracking-wider">// Upload Encoded Image</Label>
        <div
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onClick={() => fileInputRef.current?.click()}
          className={`min-h-[140px] border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-3 cursor-pointer transition-all duration-300 mb-3 ${
            dragOver
              ? "border-[hsl(var(--decode-accent))] bg-[hsl(var(--decode-accent))]/5 glow-decode"
              : "border-border/50 hover:border-[hsl(var(--decode-accent))]/50"
          }`}
        >
          <div className="text-muted-foreground text-sm font-mono">
            {uploadedImage ? `> ${uploadedImage.name}` : "> Drop encoded image here"}
          </div>
          <Button variant="outline" className="btn-decode text-xs font-mono" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
            Browse Image
          </Button>
          <input ref={fileInputRef} type="file" accept="image/png,.png" onChange={handleFileSelect} className="hidden" />
        </div>

        <div className="space-y-2">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type={showPassword ? "text" : "password"}
                placeholder="Decryption key (if encrypted)"
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
            <Button
              type="button"
              onClick={() => {
                if (!password) { toast.error("No key to copy"); return; }
                navigator.clipboard.writeText(password);
                toast.success("Key copied");
              }}
              variant="outline"
              size="sm"
              className="btn-decode font-mono text-xs"
              title="Copy decryption key"
            >
              <Copy className="h-3 w-3" />
            </Button>
            <Button onClick={handleDecode} className="btn-decode font-mono text-xs" disabled={!uploadedImage || isDecoding}>
              {isDecoding ? "[ DECODING... ]" : "[ DECODE ]"}
            </Button>
          </div>
          <Input
            value={embedKey}
            onChange={(e) => setEmbedKey(e.target.value.replace(/\D/g, ''))}
            placeholder="Embedding key (for random-pixel mode)"
            className="bg-background/50 font-mono text-sm"
          />
        </div>
      </div>

      {terminalLines.length > 0 && (
        <div className="animate-fade-in">
          <TerminalOutput lines={terminalLines} />
        </div>
      )}

      {validationError && <InlineError {...validationError} />}

      {/* Algorithm Detection Indicator */}
      {detectedMode && modeInfo && (
        <div className="card-glass rounded-xl p-4 animate-fade-in">
          <Label className="text-xs text-muted-foreground block font-mono uppercase tracking-wider mb-3">// Detection Report</Label>
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-lg bg-background/50 border border-border/30">
              <p className="text-xs text-muted-foreground font-mono mb-1">Algorithm</p>
              <p className={`text-sm font-bold font-mono ${modeInfo.color}`}>
                {modeInfo.icon} {modeInfo.label}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-background/50 border border-border/30">
              <p className="text-xs text-muted-foreground font-mono mb-1">LSB Depth</p>
              <p className="text-sm font-bold font-mono text-foreground">
                {detectedDepth ? `${detectedDepth}-bit` : "n/a"}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-background/50 border border-border/30">
              <p className="text-xs text-muted-foreground font-mono mb-1">Encryption</p>
              <p className={`text-sm font-bold font-mono ${detectedEncrypted ? "text-yellow-400" : "text-muted-foreground"}`}>
                {detectedEncrypted ? "🔒 AES-256-GCM" : "🔓 None (Plaintext)"}
              </p>
            </div>
          </div>
        </div>
      )}

      {decodedMessage && (
        <div className="card-glass rounded-xl p-5 space-y-3 animate-fade-in">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground block font-mono uppercase tracking-wider">// Recovered Message</Label>
            <Button
              variant="outline"
              size="sm"
              className="btn-decode font-mono text-xs gap-1"
              onClick={() => {
                navigator.clipboard.writeText(decodedMessage);
                toast.success("Copied to clipboard");
              }}
            >
              📋 Copy
            </Button>
          </div>
          <Textarea value={decodedMessage} readOnly className="min-h-[160px] bg-background/50 font-mono text-sm" />
          <div className="text-xs text-muted-foreground font-mono">{decodedInfo}</div>
        </div>
      )}

      {decodedFile && (
        <div className="card-glass rounded-xl p-5 space-y-3 animate-fade-in">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block font-mono uppercase tracking-wider">// Recovered File</Label>
              <p className="font-mono text-[hsl(var(--decode-accent))]">{decodedFile.name}</p>
              <p className="text-xs text-muted-foreground mt-1 font-mono">
                {(decodedFile.data.length / 1024).toFixed(1)} KB • {decodedFile.type || "unknown"}
              </p>
            </div>
            <Button onClick={handleDownloadFile} className="btn-decode font-mono text-xs">
              ⬇ Download
            </Button>
          </div>
          <div className="text-xs text-muted-foreground font-mono">{decodedInfo}</div>
        </div>
      )}
    </div>
  );
});

DecodeTab.displayName = "DecodeTab";
export default DecodeTab;