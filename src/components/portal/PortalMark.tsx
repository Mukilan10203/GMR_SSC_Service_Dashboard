import { cx } from "@/lib/format";

/**
 * The GMR Group mark, inlined from GMR_Group_(logo).svg so it renders crisp
 * at any size with no network round-trip. Colours are the Group's own
 * (navy/red/amber) and are never themed — a wordmark keeps its brand colours
 * regardless of light/dark context.
 */
function GmrMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 358 132" fill="none" aria-hidden className={className}>
      <path
        fill="#003974"
        d="M74.27 0.00 L87.77 0.00 C98.79 0.66 109.91 1.98 120.35 5.78 C119.33 15.17 118.36 24.57 117.46 33.97 C104.38 26.48 88.63 24.06 73.81 26.43 C64.34 27.91 54.73 30.95 47.50 37.49 C40.81 43.45 36.60 52.10 35.97 61.03 C34.49 73.05 37.23 86.17 45.93 95.02 C52.44 101.97 61.71 105.71 71.00 107.08 C77.45 107.82 84.16 107.81 90.31 105.47 C84.63 114.26 79.10 123.14 73.44 131.95 C66.27 131.41 58.92 132.70 51.90 130.69 C38.95 127.48 26.24 121.76 16.88 112.03 C6.35 101.68 1.04 86.99 0.00 72.46 L 0.00 61.35 C 0.96 46.06 6.31 30.40 17.74 19.75 C 32.78 5.50 54.22 1.07 74.27 0.00 Z"
      />
      <path
        fill="#003974"
        d="M252.92 3.29 C271.93 3.24 290.95 3.27 309.97 3.27 C318.91 3.26 328.20 3.82 336.44 7.59 C354.42 16.22 361.93 40.55 352.99 58.15 C349.49 66.31 342.22 72.05 334.27 75.58 C336.57 80.06 338.51 84.71 340.31 89.41 C346.29 103.59 352.31 117.75 358.13 132.00 L 324.50 132.00 C317.94 115.12 311.52 98.19 304.80 81.37 C297.59 81.37 290.38 81.41 283.18 81.35 C283.19 98.23 283.16 115.12 283.20 132.00 L 282.68 132.00 C273.09 114.97 262.56 98.49 252.92 81.50 C252.86 55.43 252.88 29.36 252.92 3.29 M 283.18 28.78 C283.18 37.57 283.18 46.36 283.18 55.16 C295.21 55.24 307.24 55.06 319.26 55.25 C324.23 51.14 326.60 43.71 324.64 37.52 C323.24 34.07 321.39 30.45 317.90 28.71 C306.33 28.86 294.75 28.74 283.18 28.78 Z"
      />
      <path
        fill="#003974"
        d="M80.67 55.60 C94.46 55.27 108.26 55.53 122.06 55.47 C117.11 63.59 111.82 71.50 106.84 79.60 C98.12 79.50 89.38 79.80 80.67 79.44 C80.80 71.50 80.80 63.55 80.67 55.60 Z"
      />
      <path
        fill="#ed1c24"
        d="M122.06 55.47 C132.76 38.65 143.61 21.93 154.11 4.98 C162.56 18.91 170.92 32.89 179.12 46.96 C179.45 47.54 180.12 48.69 180.45 49.27 C174.35 59.25 168.03 69.09 161.95 79.09 C159.40 75.31 157.31 71.25 155.03 67.31 C140.82 88.95 126.32 110.40 112.06 132.00 L 74.30 132.00 L 73.44 131.95 C79.10 123.14 84.63 114.26 90.31 105.47 C95.78 96.82 101.21 88.14 106.84 79.60 C111.82 71.50 117.11 63.59 122.06 55.47 Z"
      />
      <path
        fill="#ed1c24"
        d="M195.85 87.94 C197.13 85.92 198.30 83.73 200.31 82.32 C210.21 98.87 220.17 115.37 229.92 132.00 L 191.96 132.00 L 193.00 131.76 C189.08 125.51 185.27 119.16 181.79 112.66 C181.65 112.25 181.37 111.43 181.23 111.03 C185.92 103.22 191.09 95.71 195.85 87.94 Z"
      />
      <path
        fill="#faab53"
        d="M207.40 5.85 C209.60 8.39 211.08 11.43 212.76 14.32 C226.23 36.66 239.43 59.17 252.92 81.50 C262.56 98.49 273.09 114.97 282.68 132.00 L 245.93 132.00 C234.82 113.15 223.80 94.24 212.66 75.40 C211.35 72.94 209.97 70.50 208.27 68.28 C206.43 71.42 204.57 74.55 202.47 77.52 C201.53 79.00 200.14 80.43 200.31 82.32 C198.30 83.73 197.13 85.92 195.85 87.94 C191.09 95.71 185.92 103.22 181.23 111.03 C181.37 111.43 181.65 112.25 181.79 112.66 C181.43 112.52 180.71 112.23 180.35 112.08 C176.14 118.73 171.85 125.31 167.72 132.00 L 128.96 132.00 C139.95 114.36 150.94 96.72 161.95 79.09 C168.03 69.09 174.35 59.25 180.45 49.27 C180.12 48.69 179.45 47.54 179.12 46.96 C179.61 47.38 180.60 48.23 181.09 48.65 C189.58 34.22 199.00 20.33 207.40 5.85 Z"
      />
    </svg>
  );
}

/**
 * Wordmark for the portal: the GMR Group mark plus the product name. The
 * mark keeps its own brand colours always, so on a navy surface it sits in
 * a small white chip rather than being recoloured.
 */
/**
 * `md` is the in-app size, sitting in a 68px header or a rail. `lg` is for
 * places where the mark is the thing being looked at rather than a corner
 * label — the sign-in panel, chiefly.
 */
const SIZES = {
  md: {
    row: "gap-2.5",
    stackGap: "gap-2",
    chip: "h-9 w-11 rounded-lg px-1.5",
    chipMark: "h-4",
    darkMark: "h-7 w-11",
    divider: "pl-3",
    name: "text-[14px]",
    sub: "mt-0.5 text-[8px] tracking-[0.12em]",
  },
  lg: {
    row: "gap-5",
    stackGap: "gap-4",
    chip: "h-[74px] w-[104px] rounded-2xl px-4",
    chipMark: "h-9",
    darkMark: "h-14 w-[88px]",
    divider: "pl-5",
    name: "text-[26px]",
    sub: "mt-1.5 text-[11px] tracking-[0.16em]",
  },
} as const;

export function PortalMark({
  tone = "dark",
  compact = false,
  size = "md",
  layout = "row",
  name = "SSC Customer Portal",
  sub = "Shared Service Centre",
}: {
  tone?: "light" | "dark";
  compact?: boolean;
  size?: "md" | "lg";
  /**
   * `row` puts the name beside the mark behind a rule — the corner-label
   * lockup. `stacked` puts it underneath and centred, for when the mark is
   * the focus of the page rather than a label on it.
   */
  layout?: "row" | "stacked";
  /** Product name — the delivery console overrides both lines. */
  name?: string;
  sub?: string;
}) {
  const primary = tone === "light" ? "#ffffff" : "var(--color-navy)";
  const secondary = tone === "light" ? "var(--color-rail-ink-dim)" : "var(--color-ink-3)";
  const s = SIZES[size];
  const stacked = layout === "stacked";

  return (
    <div
      className={cx(
        "flex",
        stacked ? "flex-col items-center text-center" : "items-center",
        stacked ? s.stackGap : s.row,
      )}
    >
      {tone === "light" ? (
        <span
          className={cx(
            "flex shrink-0 items-center justify-center bg-white shadow-[0_1px_2px_rgba(0,0,0,0.12)]",
            s.chip,
          )}
        >
          <GmrMark className={cx("w-full", s.chipMark)} />
        </span>
      ) : (
        <GmrMark className={cx("shrink-0", s.darkMark)} />
      )}
      {!compact && (
        // Stacked drops the vertical rule — a divider under a centred mark
        // reads as a strikethrough rather than as part of the lockup.
        <div className={cx("leading-none", stacked ? "" : cx("border-l border-line", s.divider))}>
          <p
            className={cx("leading-[1.15] font-extrabold tracking-[-0.01em]", s.name)}
            style={{ color: primary }}
          >
            {name}
          </p>
          <p
            className={cx("font-bold uppercase", s.sub)}
            style={{ color: secondary }}
          >
            {sub}
          </p>
        </div>
      )}
    </div>
  );
}
