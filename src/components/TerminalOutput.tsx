import { useState, useEffect } from "react";

interface TerminalOutputProps {
  lines: string[];
  onComplete?: () => void;
}

export default function TerminalOutput({ lines, onComplete }: TerminalOutputProps) {
  const [visibleLines, setVisibleLines] = useState<string[]>([]);
  const [currentLine, setCurrentLine] = useState(0);
  const [currentChar, setCurrentChar] = useState(0);

  useEffect(() => {
    if (currentLine >= lines.length) {
      onComplete?.();
      return;
    }

    const line = lines[currentLine];
    if (currentChar < line.length) {
      const timer = setTimeout(() => {
        setVisibleLines((prev) => {
          const updated = [...prev];
          updated[currentLine] = line.slice(0, currentChar + 1);
          return updated;
        });
        setCurrentChar(currentChar + 1);
      }, 8 + Math.random() * 15);
      return () => clearTimeout(timer);
    } else {
      const timer = setTimeout(() => {
        setCurrentLine(currentLine + 1);
        setCurrentChar(0);
        setVisibleLines((prev) => [...prev, ""]);
      }, 120);
      return () => clearTimeout(timer);
    }
  }, [currentLine, currentChar, lines, onComplete]);

  useEffect(() => {
    setVisibleLines([""]);
    setCurrentLine(0);
    setCurrentChar(0);
  }, [lines]);

  return (
    <div className="font-mono text-xs p-4 rounded-lg bg-[hsl(222,25%,3%)]/90 border border-[hsl(var(--encode-accent))]/20 space-y-0.5 overflow-hidden backdrop-blur-sm">
      <div className="flex items-center gap-2 mb-2 pb-2 border-b border-border/30">
        <div className="w-2 h-2 rounded-full bg-destructive/80" />
        <div className="w-2 h-2 rounded-full bg-yellow-500/80" />
        <div className="w-2 h-2 rounded-full bg-[hsl(var(--decode-accent))]/80" />
        <span className="text-muted-foreground/40 ml-2 text-[10px]">root@steglab:~</span>
        <span className="ml-auto text-muted-foreground/30 text-[10px] animate-pulse">●</span>
      </div>
      {visibleLines.map((line, i) => (
        <div key={i} className="flex leading-5">
          <span className="text-[hsl(var(--decode-accent))] mr-2 select-none opacity-60">$</span>
          <span className={`${
            line.includes("ERR") ? "text-destructive" : 
            line.includes("✔") || line.includes("OK") ? "text-[hsl(var(--decode-accent))]" :
            line.includes("===") ? "text-yellow-500" :
            "text-muted-foreground"
          } ${i === currentLine && currentLine < lines.length ? "border-r border-[hsl(var(--encode-accent))] animate-pulse" : ""}`}>
            {line}
          </span>
        </div>
      ))}
    </div>
  );
}
