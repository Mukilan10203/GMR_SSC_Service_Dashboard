import { cx } from "@/lib/format";

/**
 * Wordmark for the portal. The glyph is three stacked service lanes
 * converging on a single point — the customer-to-SSC relationship the
 * product is built around.
 */
export function PortalMark({
  tone = "dark",
  compact = false,
}: {
  tone?: "light" | "dark";
  compact?: boolean;
}) {
  const primary = tone === "light" ? "#ffffff" : "var(--color-ink)";
  const secondary = tone === "light" ? "var(--color-rail-ink-dim)" : "var(--color-ink-3)";

  return (
    <div className="flex items-center gap-2.5">
      <svg width="30" height="30" viewBox="0 0 32 32" fill="none" aria-hidden className="shrink-0">
        <rect width="32" height="32" rx="8" fill={tone === "light" ? "rgba(255,255,255,0.12)" : "var(--color-rail)"} />
        <path d="M9 11h9.5a3.5 3.5 0 0 1 0 7H9" stroke={tone === "light" ? "#ffffff" : "#ffffff"} strokeWidth="2" strokeLinecap="round" />
        <path d="M9 18h6" stroke={tone === "light" ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.5)"} strokeWidth="2" strokeLinecap="round" />
        <path d="M9 22.5h13" stroke={tone === "light" ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.32)"} strokeWidth="2" strokeLinecap="round" />
        <circle cx="23" cy="22.5" r="1.6" fill="#4d9de8" />
      </svg>
      {!compact && (
        <div className="leading-none">
          <p className={cx("text-[14.5px] font-semibold tracking-[-0.01em]")} style={{ color: primary }}>
            SSC Customer Portal
          </p>
          <p className="mt-1 text-[11px]" style={{ color: secondary }}>
            Shared Service Centre
          </p>
        </div>
      )}
    </div>
  );
}
