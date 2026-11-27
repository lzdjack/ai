// Icons of the PC shell, from the approved design (reference/src/v4/apple-chat.html). Single colour, so
// they follow currentColor; multi-colour Dock icons are files in assets/.
import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement>;

export const LogoIcon = (p: P) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.3"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...p}
  >
    <path d="M8 7.2L3.6 12 8 16.8" />
    <path d="M16 7.2l4.4 4.8-4.4 4.8" opacity=".6" />
    <path d="M9.6 12.3l1.8 1.8 3.2-4" />
  </svg>
);

export const SparkleIcon = (p: P) => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...p}>
    <path d="M12 1l2.6 8.4L23 12l-8.4 2.6L12 23l-2.6-8.4L1 12l8.4-2.6z" />
  </svg>
);

export const SearchIcon = (p: P) => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...p}
  >
    <circle cx="11" cy="11" r="8" />
    <path d="M21 21l-4.3-4.3" />
  </svg>
);

export const BotIcon = (p: P) => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...p}
  >
    <rect x="3" y="11" width="18" height="10" rx="2" />
    <circle cx="12" cy="5" r="2" />
    <path d="M12 7v4" />
    <path d="M8 16h.01M16 16h.01" />
  </svg>
);

export const PlusIcon = (p: P) => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...p}
  >
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const CheckIcon = (p: P) => (
  <svg
    width="10"
    height="10"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="3"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...p}
  >
    <path d="M20 6L9 17l-5-5" />
  </svg>
);

export const PlayIcon = (p: P) => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...p}>
    <path d="M6 3l14 9-14 9z" />
  </svg>
);

export const BranchIcon = (p: P) => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...p}
  >
    <circle cx="18" cy="18" r="3" />
    <circle cx="6" cy="6" r="3" />
    <path d="M6 21V9a9 9 0 009 9" />
  </svg>
);

export const UndoIcon = (p: P) => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...p}
  >
    <path d="M3 7v6h6" />
    <path d="M21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13" />
  </svg>
);

export const CheckBoldIcon = (p: P) => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...p}
  >
    <path d="M20 6L9 17l-5-5" />
  </svg>
);

export const SparkleOutlineIcon = (p: P) => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...p}
  >
    <path d="M12 3l1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2z" />
  </svg>
);

export const PaperclipIcon = (p: P) => (
  <svg
    width="17"
    height="17"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...p}
  >
    <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
  </svg>
);

export const ArrowUpIcon = (p: P) => (
  <svg
    width="17"
    height="17"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.4"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...p}
  >
    <path d="M12 19V5M5 12l7-7 7 7" />
  </svg>
);

export const ExternalIcon = (p: P) => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...p}
  >
    <path d="M15 3h6v6M10 14L21 3M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
  </svg>
);

export const DockAiIcon = (p: P) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...p}>
    <path d="M10 3l1.9 5.6 5.6 1.9-5.6 1.9L10 18l-1.9-5.6L2.5 10.5l5.6-1.9z" />
    <path d="M18 13.5l.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9z" opacity=".8" />
  </svg>
);

export const DockRollbackIcon = (p: P) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.3"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...p}
  >
    <path d="M3.8 4.8v4.4h4.4" />
    <path d="M4.2 9.2A8.3 8.3 0 1 1 3.9 13.6" />
    <path d="M12 8v4.2l2.7 1.7" />
  </svg>
);

export const DockSkillsIcon = (p: P) => (
  <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" {...p}>
    <path d="M12 13.2l8.6-4.4L12 4.4 3.4 8.8z" fill="currentColor" />
    <path
      d="M3.4 12.6L12 17l8.6-4.4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity=".75"
    />
    <path
      d="M3.4 16.2L12 20.6l8.6-4.4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity=".5"
    />
  </svg>
);

export const DockMarketIcon = (p: P) => (
  <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" {...p}>
    <rect x="3.5" y="3.5" width="7.2" height="7.2" rx="2.2" fill="currentColor" />
    <rect x="13.3" y="3.5" width="7.2" height="7.2" rx="2.2" fill="currentColor" opacity=".82" />
    <rect x="3.5" y="13.3" width="7.2" height="7.2" rx="2.2" fill="currentColor" opacity=".82" />
    <path
      d="M16.9 13.2l1.1 2.7 2.7 1.1-2.7 1.1-1.1 2.7-1.1-2.7-2.7-1.1 2.7-1.1z"
      fill="currentColor"
    />
  </svg>
);
