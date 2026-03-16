import { useState, useRef, useCallback, forwardRef, useImperativeHandle } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Eye, EyeOff, KeyRound } from "lucide-react";
import { readBitsFromImageData, bitsToUint8Array, decryptMessage, EncodingMode } from "@/lib/steganography";
import TerminalOutput from "./TerminalOutput";

export interface DecodeTabRef {
  clear: () => void;
}

const DecodeTab = forwardRef<DecodeTabRef>((props, ref) => {
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClear = useCallback(() => {
    setPassword("");
    setDecodedMessage("");
    setDecodedInfo("");
    setUploadedImage(null);
    setTerminalLines([]);
    setDecodedFile(null);
    setEmbedKey("");
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

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
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
    if (!file) { toast.error("Upload an image to decode"); return; }

    setIsDecoding(true);
    setDecodedMessage("");
    setDecodedFile(null);
    setTerminalLines([
      "$ stego-decoder --init",
      `Loading target: ${file.name}`,
      "Scanning pixel matrix...",
    ]);

    const reader = new FileReader();
    reader.onload = async (e) => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0);

        try {
          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          setTerminalLines((prev) => [...prev, "Reading LSB header [32 bits]..."]);

          // Try standard LSB first for header
          const headerBits = readBitsFromImageData(imgData, 32, 'lsb');
          const headerBytes = bitsToUint8Array(headerBits);
          const length = (headerBytes[0] << 24) | (headerBytes[1] << 16) | (headerBytes[2] << 8) | headerBytes[3];

          if (length <= 0 || length > 500_000) {
            setTerminalLines((prev) => [...prev, `[ERR] Invalid header: length=${length}`, "Status: NO HIDDEN DATA ✖"]);
            setIsDecoding(false);
            toast.error("No hidden data found");
            return;
          }

          setTerminalLines((prev) => [
            ...prev,
            `[OK] Hidden payload detected: ${length.toLocaleString()} bytes`,
            "Extracting embedded bits...",
          ]);

          const totalBits = (4 + length) * 8;
          const allBits = readBitsFromImageData(imgData, totalBits, 'lsb');
          const allBytes = bitsToUint8Array(allBits);
          let payload = new TextDecoder().decode(allBytes.slice(4));

          // Check for mode header
          let mode: EncodingMode = 'lsb';
          if (payload.startsWith("MODE:")) {
            const modeEnd = payload.indexOf(":", 5);
            const modeStr = payload.slice(5, modeEnd) as EncodingMode;
            if (['lsb', 'multi-bit', 'random-pixel', 'edge-based'].includes(modeStr)) {
              mode = modeStr;
              payload = payload.slice(modeEnd + 1);
              setTerminalLines((prev) => [...prev, `[OK] Algorithm: ${mode.toUpperCase()}`]);

              if (mode !== 'lsb') {
                // Re-read with correct mode
                const keyNum = embedKey ? parseInt(embedKey) || 483920 : undefined;
                const reHeaderBits = readBitsFromImageData(imgData, 32, mode, keyNum);
                const reHeaderBytes = bitsToUint8Array(reHeaderBits);
                const reLength = (reHeaderBytes[0] << 24) | (reHeaderBytes[1] << 16) | (reHeaderBytes[2] << 8) | reHeaderBytes[3];
                if (reLength > 0 && reLength <= 500_000) {
                  const reTotalBits = (4 + reLength) * 8;
                  const reAllBits = readBitsFromImageData(imgData, reTotalBits, mode, keyNum);
                  const reAllBytes = bitsToUint8Array(reAllBits);
                  let rePayload = new TextDecoder().decode(reAllBytes.slice(4));
                  if (rePayload.startsWith("MODE:")) {
                    const reModeEnd = rePayload.indexOf(":", 5);
                    rePayload = rePayload.slice(reModeEnd + 1);
                  }
                  payload = rePayload;
                }
              }
            }
          }

          if (payload.startsWith("ENC:")) {
            setTerminalLines((prev) => [...prev, "🔒 Encrypted payload detected", "Attempting AES-256-GCM decryption..."]);
            const b64 = payload.slice(4);
            const pw = password.trim();
            if (!pw) {
              setTerminalLines((prev) => [...prev, "[ERR] Decryption key required"]);
              setIsDecoding(false);
              toast.error("Password required for decryption");
              return;
            }
            try {
              const dec = await decryptMessage(pw, b64);
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
              toast.success("Decoded successfully!");
            } catch {
              setTerminalLines((prev) => [...prev, "[ERR] Decryption failed — invalid key"]);
              setIsDecoding(false);
              toast.error("Wrong password");
              return;
            }
          } else if (payload.startsWith("FILE:")) {
            const parts = payload.split(":");
            const fileName = parts[1];
            const fileType = parts[2];
            const b64Data = payload.slice(`FILE:${fileName}:${fileType}:`.length);
            const binary = atob(b64Data);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            setDecodedFile({ name: fileName, type: fileType, data: bytes });
            setDecodedInfo(`Hidden file: ${fileName}`);
            setTerminalLines((prev) => [...prev, `File recovered: ${fileName}`, "STATUS: COMPLETE ✔"]);
            toast.success("File decoded!");
          } else if (payload.startsWith("PLAIN:")) {
            setDecodedMessage(payload.slice(6));
            setDecodedInfo("Plaintext payload");
            setTerminalLines((prev) => [...prev, "Plaintext payload extracted", "STATUS: COMPLETE ✔"]);
            toast.success("Message decoded!");
          } else {
            setDecodedMessage(payload);
            setDecodedInfo("Raw payload (legacy format)");
            setTerminalLines((prev) => [...prev, "Raw data extracted", "STATUS: COMPLETE ✔"]);
            toast.success("Message decoded");
          }
        } catch (err) {
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

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="card-glass rounded-xl p-5">
        <Label className="text-xs text-muted-foreground mb-2 block font-mono uppercase tracking-wider">// Upload Encoded Image</Label>
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
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
          <Button variant="outline" className="btn-decode text-xs font-mono" onClick={(e) => e.stopPropagation()}>
            Browse Image
          </Button>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
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

      {decodedMessage && (
        <div className="card-glass rounded-xl p-5 space-y-3 animate-fade-in">
          <Label className="text-xs text-muted-foreground block font-mono uppercase tracking-wider">// Recovered Message</Label>
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
