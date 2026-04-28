import { AlertCircle } from "lucide-react";

interface InlineWarningProps {
  code: string;
  title: string;
  reason: string;
  hint?: string;
}

/**
 * Soft pre-flight warning block. Surfaces before backend dispatch when
 * input is approaching limits or looks like an unsupported / mismatched
 * codec format. Yellow tone — does not block submission.
 */
export default function InlineWarning({ code, title, reason, hint }: InlineWarningProps) {
  return (
    <div
      role="status"
      className="border border-yellow-500/40 bg-yellow-500/5 rounded-lg p-3 font-mono text-xs animate-fade-in"
    >
      <div className="flex items-start gap-2">
        <AlertCircle className="h-4 w-4 text-yellow-400 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-yellow-400 font-bold">{title}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/15 text-yellow-300 border border-yellow-500/30">
              {code}
            </span>
          </div>
          <p className="text-muted-foreground/90 leading-relaxed">{reason}</p>
          {hint && <p className="text-muted-foreground/60 mt-1 italic">→ {hint}</p>}
        </div>
      </div>
    </div>
  );
}