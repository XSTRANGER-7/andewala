import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;
const base = (p: P) => ({ width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true, ...p });

export const IconMenu = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
);
export const IconClose = (p: P) => (
  <svg {...base(p)}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);
export const IconBasket = (p: P) => (
  <svg {...base(p)}>
    <path d="M3 10h18l-1.6 9a2 2 0 0 1-2 1.7H6.6a2 2 0 0 1-2-1.7L3 10Z" />
    <path d="M8 10l3-6M16 10l-3-6M9 14v3M15 14v3" />
  </svg>
);
export const IconUser = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </svg>
);
export const IconLeaf = (p: P) => (
  <svg {...base(p)}>
    <path d="M5 19c0-8 5-13 14-13-1 9-6 13-14 13Z" />
    <path d="M5 19c3-4 6-7 10-9" />
  </svg>
);
export const IconTag = (p: P) => (
  <svg {...base(p)}>
    <path d="M3 12V4h8l9 9-8 8-9-9Z" />
    <circle cx="7.5" cy="8.5" r="1.3" fill="currentColor" stroke="none" />
  </svg>
);
export const IconClock = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);
export const IconTruck = (p: P) => (
  <svg {...base(p)}>
    <path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z" />
    <circle cx="7" cy="18" r="1.8" />
    <circle cx="17" cy="18" r="1.8" />
  </svg>
);
export const IconShield = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3Z" />
    <path d="M9 12l2 2 4-4" />
  </svg>
);
export const IconCheck = (p: P) => (
  <svg {...base(p)}>
    <path d="M5 12l4 4L19 7" />
  </svg>
);
export const IconPhone = (p: P) => (
  <svg {...base(p)}>
    <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" />
  </svg>
);
export const IconMail = (p: P) => (
  <svg {...base(p)}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M3 7l9 6 9-6" />
  </svg>
);
export const IconPin = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 21s-6-5.3-6-11a6 6 0 0 1 12 0c0 5.7-6 11-6 11Z" />
    <circle cx="12" cy="10" r="2.2" />
  </svg>
);
export const IconQuote = (p: P) => (
  <svg {...base({ ...p, stroke: "none", fill: "currentColor" })}>
    <path d="M7.5 6C4.5 7.5 3 10 3 13.5V18h6v-6H6c0-2 .8-3.3 2.5-4L7.5 6Zm9 0C13.5 7.5 12 10 12 13.5V18h6v-6h-3c0-2 .8-3.3 2.5-4L16.5 6Z" />
  </svg>
);
export const IconArrow = (p: P) => (
  <svg {...base(p)}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);
export const IconInstagram = (p: P) => (
  <svg {...base(p)}>
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
  </svg>
);
export const IconFacebook = (p: P) => (
  <svg {...base(p)}>
    <path d="M14 8h3V4h-3a4 4 0 0 0-4 4v3H7v4h3v6h4v-6h3l1-4h-4V8Z" />
  </svg>
);
export const IconWhatsapp = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 20l1.3-3.8A8 8 0 1 1 8.3 19L4 20Z" />
    <path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1-1.5-2-1-1 1a4 4 0 0 1-2-2l1-1-1-2L9 9.5Z" />
  </svg>
);
export const IconEgg = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 3c-3.5 0-7 5.5-7 10a7 7 0 0 0 14 0c0-4.5-3.5-10-7-10Z" />
  </svg>
);
export const IconTray = (p: P) => (
  <svg {...base(p)}>
    <rect x="3" y="6" width="18" height="12" rx="2" />
    <circle cx="8" cy="12" r="1.8" />
    <circle cx="12" cy="12" r="1.8" />
    <circle cx="16" cy="12" r="1.8" />
  </svg>
);
export const IconCalendar = (p: P) => (
  <svg {...base(p)}>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M3 10h18M8 3v4M16 3v4" />
  </svg>
);
export const IconWallet = (p: P) => (
  <svg {...base(p)}>
    <rect x="3" y="7" width="18" height="12" rx="2" />
    <path d="M3 10h18M16 14h2" />
  </svg>
);
export const IconHome = (p: P) => (
  <svg {...base(p)}>
    <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1v-9Z" />
  </svg>
);
export const IconQuestion = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .8-1 1.5v.2" />
    <circle cx="12" cy="17" r=".6" fill="currentColor" />
  </svg>
);
export const IconSparkle = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2 2-5Z" />
  </svg>
);
export const IconLogout = (p: P) => (
  <svg {...base(p)}>
    <path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M15 8l5 4-5 4M9 12h11" />
  </svg>
);
