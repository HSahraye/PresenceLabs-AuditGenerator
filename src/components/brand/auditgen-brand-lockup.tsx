import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";

type AuditGenBrandLockupProps = {
  className?: string;
  compact?: boolean;
  showBadge?: boolean;
};

function AuditGenBrandMark({ compact = false }: { compact?: boolean }) {
  const iconSize = compact ? "h-10 w-10 rounded-xl" : "h-14 w-14 rounded-2xl";
  const stroke = compact ? 2.5 : 2.8;

  return (
    <span className={cn("inline-flex items-center justify-center bg-emerald-50 ring-1 ring-emerald-200", iconSize)} aria-hidden="true">
      <svg viewBox="0 0 48 48" className={cn("text-[#0F172A]", compact ? "h-8 w-8" : "h-9 w-9")} fill="none">
        <circle cx="20" cy="20" r="12.5" stroke="currentColor" strokeWidth={stroke} />
        <path d="M10.8 30.2L4.9 36.1" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" />
        <path d="M16.5 23.5L22.3 17.7L27.2 21.9L34.2 14.9" stroke="#10B981" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" />
        <path d="M30.8 14.9H34.2V18.3" stroke="#10B981" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

export function AuditGenBrandLockup({ className, compact = false, showBadge = true }: AuditGenBrandLockupProps) {
  return (
    <div className={cn("flex min-w-0 flex-wrap items-center gap-4 sm:gap-5", className)}>
      <AuditGenBrandMark compact={compact} />
      <div className="min-w-0">
        <p className={cn("truncate font-black tracking-tight text-[#0F172A]", compact ? "text-2xl sm:text-[1.7rem]" : "text-3xl sm:text-[2.05rem]")}>
          {BRAND.productName.toUpperCase()}
        </p>
        <p
          className={cn(
            "max-w-full text-slate-600",
            compact
              ? "text-xs font-semibold uppercase tracking-[0.14em]"
              : "text-sm font-semibold uppercase tracking-[0.18em]",
          )}
        >
          {BRAND.tagline}
        </p>
      </div>
      {showBadge ? (
        <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-emerald-700">
          Agency Sales OS
        </span>
      ) : null}
    </div>
  );
}
