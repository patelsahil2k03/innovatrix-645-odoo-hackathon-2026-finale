/** Inline SVG icons — no icon library dependency, no network fetch, themeable
 *  via currentColor. Add what you need; keep them 16x16 on a 24 viewBox. */

type IconProps = { size?: number; className?: string };

const base = (size: number) => ({
  width: size, height: size, viewBox: "0 0 24 24", fill: "none",
  stroke: "currentColor", strokeWidth: 2,
  strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
});

export const SearchIcon = ({ size = 16, className }: IconProps) => (
  <svg {...base(size)} className={className} aria-hidden="true">
    <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
  </svg>
);

export const CloseIcon = ({ size = 16, className }: IconProps) => (
  <svg {...base(size)} className={className} aria-hidden="true">
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

export const ChevronLeft = ({ size = 16, className }: IconProps) => (
  <svg {...base(size)} className={className} aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
);

export const ChevronRight = ({ size = 16, className }: IconProps) => (
  <svg {...base(size)} className={className} aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
);

export const HomeIcon = ({ size = 16, className }: IconProps) => (
  <svg {...base(size)} className={className} aria-hidden="true">
    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><path d="M9 22V12h6v10" />
  </svg>
);

export const ListIcon = ({ size = 16, className }: IconProps) => (
  <svg {...base(size)} className={className} aria-hidden="true">
    <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
  </svg>
);

export const ShieldIcon = ({ size = 16, className }: IconProps) => (
  <svg {...base(size)} className={className} aria-hidden="true">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

export const SunIcon = ({ size = 16, className }: IconProps) => (
  <svg {...base(size)} className={className} aria-hidden="true">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
);

export const MoonIcon = ({ size = 16, className }: IconProps) => (
  <svg {...base(size)} className={className} aria-hidden="true">
    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z" />
  </svg>
);

export const LogOutIcon = ({ size = 16, className }: IconProps) => (
  <svg {...base(size)} className={className} aria-hidden="true">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
  </svg>
);

export const PlusIcon = ({ size = 16, className }: IconProps) => (
  <svg {...base(size)} className={className} aria-hidden="true">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const TrashIcon = ({ size = 16, className }: IconProps) => (
  <svg {...base(size)} className={className} aria-hidden="true">
    <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6h14Z" />
  </svg>
);

export const ChevronDown = ({ size = 16, className }: IconProps) => (
  <svg {...base(size)} className={className} aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
);

export const GridIcon = ({ size = 16, className }: IconProps) => (
  <svg {...base(size)} className={className} aria-hidden="true">
    <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
  </svg>
);

export const ListViewIcon = ({ size = 16, className }: IconProps) => (
  <svg {...base(size)} className={className} aria-hidden="true">
    <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
  </svg>
);

export const PrinterIcon = ({ size = 16, className }: IconProps) => (
  <svg {...base(size)} className={className} aria-hidden="true">
    <path d="M6 9V3h12v6M6 18H4a1 1 0 0 1-1-1v-5a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-2M6 14h12v7H6z" />
  </svg>
);

export const DownloadIcon = ({ size = 16, className }: IconProps) => (
  <svg {...base(size)} className={className} aria-hidden="true">
    <path d="M12 3v12m0 0-4-4m4 4 4-4M4 19h16" />
  </svg>
);

export const MailIcon = ({ size = 16, className }: IconProps) => (
  <svg {...base(size)} className={className} aria-hidden="true">
    <rect x="3" y="5" width="18" height="14" rx="2" /><path d="m4 7 8 6 8-6" />
  </svg>
);

export const CheckCircleIcon = ({ size = 16, className }: IconProps) => (
  <svg {...base(size)} className={className} aria-hidden="true">
    <circle cx="12" cy="12" r="9" /><path d="m8.5 12.5 2.3 2.3L16 10" />
  </svg>
);

export const AlertTriangleIcon = ({ size = 16, className }: IconProps) => (
  <svg {...base(size)} className={className} aria-hidden="true">
    <path d="M12 3 2 21h20L12 3Z" /><path d="M12 10v4M12 17h.01" />
  </svg>
);
