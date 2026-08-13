/** Line icons at a consistent 1.6px weight on a 20px grid. */

type IconProps = { className?: string; size?: number };

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: "0 0 20 20",
  fill: "none" as const,
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
});

export const IconOverview = ({ size = 18, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <rect x="2.5" y="2.5" width="6" height="7" rx="1.4" />
    <rect x="11.5" y="2.5" width="6" height="4.5" rx="1.4" />
    <rect x="2.5" y="12" width="6" height="5.5" rx="1.4" />
    <rect x="11.5" y="9.5" width="6" height="8" rx="1.4" />
  </svg>
);

export const IconServices = ({ size = 18, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M10 2.5 17 6v8l-7 3.5L3 14V6l7-3.5Z" />
    <path d="M3 6l7 3.5L17 6M10 9.5v8" />
  </svg>
);

export const IconBilling = ({ size = 18, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M4 2.5h12v15l-2.4-1.6L11.2 17.5 8.8 15.9 6.4 17.5 4 15.9V2.5Z" />
    <path d="M7 6.5h6M7 10h6" />
  </svg>
);

export const IconPerformance = ({ size = 18, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M2.5 15.5a7.5 7.5 0 1 1 15 0" />
    <path d="M10 15.5 13.5 8" />
    <circle cx="10" cy="15.5" r="1.3" fill="currentColor" stroke="none" />
  </svg>
);

export const IconIssues = ({ size = 18, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M10 2.6 18 16.5H2L10 2.6Z" />
    <path d="M10 7.8v4M10 14.2v.1" />
  </svg>
);

export const IconAutomation = ({ size = 18, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <rect x="3.5" y="6.5" width="13" height="10" rx="2.4" />
    <path d="M10 2.5v4M7 11h.01M13 11h.01M7.5 13.8h5" />
  </svg>
);

export const IconAnalytics = ({ size = 18, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M3 17h14" />
    <path d="M5.5 17V9M10 17V4M14.5 17v-5.5" />
  </svg>
);

export const IconPortfolio = ({ size = 18, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <rect x="2.5" y="6" width="15" height="11.5" rx="2" />
    <path d="M7 6V4.2A1.7 1.7 0 0 1 8.7 2.5h2.6A1.7 1.7 0 0 1 13 4.2V6M2.5 10.5h15" />
  </svg>
);

export const IconBell = ({ size = 18, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M10 2.5a5 5 0 0 0-5 5c0 4-1.5 5.5-1.5 5.5h13S15 11.5 15 7.5a5 5 0 0 0-5-5Z" />
    <path d="M8.4 16a1.8 1.8 0 0 0 3.2 0" />
  </svg>
);

export const IconSearch = ({ size = 18, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <circle cx="8.8" cy="8.8" r="5.3" />
    <path d="m12.8 12.8 3.7 3.7" />
  </svg>
);

export const IconDownload = ({ size = 18, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M10 2.8v9.4M6.4 8.9 10 12.4l3.6-3.5M3.5 15.5h13" />
  </svg>
);

export const IconChevron = ({ size = 16, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="m7.5 4.5 5 5.5-5 5.5" />
  </svg>
);

export const IconChevronDown = ({ size = 16, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="m5 7.5 5 5 5-5" />
  </svg>
);

export const IconClose = ({ size = 18, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="m5 5 10 10M15 5 5 15" />
  </svg>
);

export const IconArrowLeft = ({ size = 16, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M16 10H4M8.5 5.5 4 10l4.5 4.5" />
  </svg>
);

export const IconExternal = ({ size = 14, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M8 4H4.5v11.5H16V12M11.5 3.5H17v5.5M17 3.5 9.5 11" />
  </svg>
);

export const IconLogout = ({ size = 16, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M8 3.5H4.2A1.7 1.7 0 0 0 2.5 5.2v9.6A1.7 1.7 0 0 0 4.2 16.5H8M12.5 6.5 16 10l-3.5 3.5M16 10H7" />
  </svg>
);

export const IconMenu = ({ size = 20, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M3 5.5h14M3 10h14M3 14.5h14" />
  </svg>
);

export const IconSidebar = ({ size = 18, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <rect x="2.5" y="3.5" width="15" height="13" rx="2" />
    <path d="M8 3.5v13" />
  </svg>
);

export const IconLock = ({ size = 16, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <rect x="4.5" y="9" width="11" height="8" rx="1.6" />
    <path d="M6.5 9V6.2a3.5 3.5 0 0 1 7 0V9" />
  </svg>
);
