import { cn } from "@/lib/utils";

type AuditGenLogoProps = {
  variant?: "horizontal" | "stacked" | "icon";
  monochrome?: boolean;
  className?: string;
};

const DEEP_SPACE_BLUE = "#0F172A";
const ELECTRIC_EMERALD = "#10B981";

function markColors(monochrome: boolean) {
  return {
    deep: monochrome ? "currentColor" : DEEP_SPACE_BLUE,
    emerald: monochrome ? "currentColor" : ELECTRIC_EMERALD,
  };
}

function AuditGenMark({ monochrome = false }: { monochrome?: boolean }) {
  const colors = markColors(monochrome);
  return (
    <svg viewBox="0 0 56 56" aria-hidden="true" className="h-full w-auto">
      <circle cx="28" cy="28" r="24" fill="none" stroke={colors.deep} strokeWidth="5" />
      <path d="M8 44L20 32" stroke={colors.deep} strokeWidth="7" strokeLinecap="round" />
      <path d="M23 35L37 21" stroke={colors.emerald} strokeWidth="6" strokeLinecap="round" />
      <path d="M33 21H43V31" stroke={colors.emerald} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="20" y="21" width="4" height="14" rx="1" fill={colors.deep} />
      <rect x="26" y="17" width="4" height="18" rx="1" fill={colors.deep} />
      <rect x="32" y="24" width="4" height="11" rx="1" fill={colors.deep} />
      <path d="M18 37H38" stroke={colors.deep} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export function AuditGenLogo({ variant = "horizontal", monochrome = false, className }: AuditGenLogoProps) {
  const colors = markColors(monochrome);
  if (variant === "icon") {
    return (
      <span className={cn("inline-flex items-center text-[#0F172A]", className)} aria-label="AuditGen">
        <AuditGenMark monochrome={monochrome} />
      </span>
    );
  }

  if (variant === "stacked") {
    return (
      <span className={cn("inline-flex flex-col items-center gap-2", className)} aria-label="AuditGen">
        <span className="inline-flex h-[2.8em] w-auto items-center text-[#0F172A]">
          <AuditGenMark monochrome={monochrome} />
        </span>
        <span className="text-center leading-tight">
          <span className="block text-[0.9em] font-black tracking-[0.08em]" style={{ color: colors.deep }}>
            AUDITGEN
          </span>
          <span className="block text-[0.35em] font-semibold uppercase tracking-[0.2em]" style={{ color: monochrome ? "currentColor" : "#64748B" }}>
            Automated Reporting &amp; Security Analysis
          </span>
        </span>
      </span>
    );
  }

  return (
    <span className={cn("inline-flex items-center gap-2", className)} aria-label="AuditGen">
      <span className="inline-flex h-[1.6em] w-auto items-center text-[#0F172A]">
        <AuditGenMark monochrome={monochrome} />
      </span>
      <span className="leading-tight">
        <span className="block text-[0.86em] font-black tracking-[0.08em]" style={{ color: colors.deep }}>
          AUDITGEN
        </span>
        <span className="block text-[0.35em] font-semibold uppercase tracking-[0.18em]" style={{ color: monochrome ? "currentColor" : "#64748B" }}>
          Automated Reporting &amp; Security Analysis
        </span>
      </span>
    </span>
  );
}
