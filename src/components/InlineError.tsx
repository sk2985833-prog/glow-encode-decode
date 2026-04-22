import { AlertTriangle } from "lucide-react";

interface InlineErrorProps {
  code: string;
  title: string;
  reason: string;
  hint?: string;
}

/**
 * Hard-validation error block. Used inline next to inputs so failures
 * surface with an exact reason — not a generic toast.
 */
export default function InlineError({ code, title, reason, hint }: InlineErrorProps) {
  return (
    <div
      role="alert"
      className="border border-destructive/40 bg-destructive/5 rounded-lg p-3 font-mono text-xs animate-fade-in"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-destructive font-bold">{title}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-destructive/15 text-destructive border border-destructive/30">
              {code}
            </span>
          </div>
          <p className="text-muted-foreground/90 leading-relaxed">{reason}</p>
          {hint && (
            <p className="text-muted-foreground/60 mt-1 italic">→ {hint}</p>
          )}
        </div>
      </div>
    </div>
  );
}