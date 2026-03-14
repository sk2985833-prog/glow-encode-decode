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
      }, 15 + Math.random() * 20);
      return () => clearTimeout(timer);
    } else {
      const timer = setTimeout(() => {
        setCurrentLine(currentLine + 1);
        setCurrentChar(0);
        setVisibleLines((prev) => [...prev, ""]);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [currentLine, currentChar, lines, onComplete]);

  useEffect(() => {
    setVisibleLines([""]);
    setCurrentLine(0);
    setCurrentChar(0);
  }, [lines]);

  return (
    <div className="font-mono text-xs p-4 rounded-lg bg-background/80 border border-[hsl(var(--encode-accent))]/20 space-y-1 overflow-hidden">
      <div className="flex items-center gap-2 mb-2 pb-2 border-b border-border/30">
        <div className="w-2.5 h-2.5 rounded-full bg-destructive/80" />
        <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
        <div className="w-2.5 h-2.5 rounded-full bg-[hsl(var(--decode-accent))]/80" />
        <span className="text-muted-foreground/50 ml-2">stego-decoder</span>
      </div>
      {visibleLines.map((line, i) => (
        <div key={i} className="flex">
          <span className="text-[hsl(var(--decode-accent))] mr-2 select-none">{'>'}</span>
          <span className={i === currentLine && currentLine < lines.length ? "border-r border-[hsl(var(--encode-accent))] animate-pulse" : ""}>
            {line}
          </span>
        </div>
      ))}
    </div>
  );
}
