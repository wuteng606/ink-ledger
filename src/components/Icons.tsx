interface IconProps {
  size?: number;
}

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
});

export const IconOverview = ({ size = 17 }: IconProps) => (
  <svg {...base(size)}>
    <rect x="3.5" y="3.5" width="7" height="7" rx="1.6" />
    <rect x="13.5" y="3.5" width="7" height="7" rx="1.6" />
    <rect x="3.5" y="13.5" width="7" height="7" rx="1.6" />
    <rect x="13.5" y="13.5" width="7" height="7" rx="1.6" />
  </svg>
);

export const IconFlow = ({ size = 17 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M4 6h16M4 12h16M4 18h10" />
    <circle cx="19" cy="18" r="2.1" />
  </svg>
);

export const IconStats = ({ size = 17 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M4 20V10M10 20V4M16 20v-7M1.5 20h21" />
  </svg>
);

export const IconBudget = ({ size = 17 }: IconProps) => (
  <svg {...base(size)}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7v5l3 2" />
  </svg>
);

export const IconAccounts = ({ size = 17 }: IconProps) => (
  <svg {...base(size)}>
    <rect x="2.8" y="6" width="18.4" height="12.4" rx="2.4" />
    <path d="M2.8 10.2h18.4" />
  </svg>
);

export const IconFood = ({ size = 17 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M6 3v8a2 2 0 0 0 4 0V3M8 11v10M16 3c-1.4 1.4-2 3-2 5s.6 3 2 4v9" />
  </svg>
);

export const IconTraffic = ({ size = 17 }: IconProps) => (
  <svg {...base(size)}>
    <rect x="5" y="4" width="14" height="13" rx="3" />
    <path d="M5 11h14M8 20l1.5-3M16 20l-1.5-3" />
  </svg>
);

export const IconShop = ({ size = 17 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M5 8h14l-1 12H6L5 8z" />
    <path d="M9 8V6a3 3 0 0 1 6 0v2" />
  </svg>
);

export const IconSearch = ({ size = 15 }: IconProps) => (
  <svg {...base(size)}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M20 20l-3.6-3.6" />
  </svg>
);

export const IconClose = ({ size = 15 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

export const IconSun = ({ size = 15 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4" />
    <circle cx="12" cy="12" r="4" />
  </svg>
);

export const IconGear = ({ size = 15 }: IconProps) => (
  <svg {...base(size)}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-2.87 1.22V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 7.2 19.4l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 3.1 13.7H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.22-2.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 10 3.1V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.87 1.22l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </svg>
);

export const IconChevronRight = ({ size = 15 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M9 5l7 7-7 7" />
  </svg>
);

export const IconDownload = ({ size = 17 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M12 3v12M8 11l4 4 4-4" />
    <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
  </svg>
);

export const IconTrash = ({ size = 14 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" />
  </svg>
);
