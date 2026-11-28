// Icons of the PC shell, from the approved design (reference/src/v4/apple-chat.html). Single colour, so
// they follow currentColor; multi-colour Dock icons are files in assets/.
import type { ReactNode, SVGProps } from 'react';

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

export const EnterIcon = (p: P) => (
  <svg
    width="11"
    height="11"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...p}
  >
    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
    <path d="M10 17l5-5-5-5" />
    <path d="M15 12H3" />
  </svg>
);

export const SparkFillIcon = (p: P) => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...p}>
    <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z" />
  </svg>
);

export const MailIcon = (p: P) => (
  <svg
    width="17"
    height="17"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.9"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...p}
  >
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M3 7l9 6 9-6" />
  </svg>
);

export const LockIcon = (p: P) => (
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
    <rect x="4" y="11" width="16" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 018 0v4" />
  </svg>
);

export const EyeIcon = (p: P) => (
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
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

export const ShieldCheckIcon = (p: P) => (
  <svg
    width="17"
    height="17"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.9"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...p}
  >
    <path d="M12 3l7 3v6c0 5-3.5 8-7 9-3.5-1-7-4-7-9V6l7-3z" />
    <path d="M9.5 12l1.8 1.8 3.2-3.6" />
  </svg>
);

export const UserIcon = (p: P) => (
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
    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

export const LayersIcon = (p: P) => (
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
    <path d="M12 2l10 5-10 5L2 7z" />
    <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
  </svg>
);

export const PlugIcon = (p: P) => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...p}
  >
    <path d="M12 22v-5" />
    <path d="M9 8V2" />
    <path d="M15 8V2" />
    <path d="M18 8v5a6 6 0 0 1-12 0V8z" />
  </svg>
);

// Line icons of the first-run wizard (reference/src/v5/onboard-pc-*.html): 24-unit strokes in currentColor.
const line = (size: number, width: number, body: ReactNode) => (p: P) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={width}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...p}
  >
    {body}
  </svg>
);

export const KeyIcon = line(
  13,
  1.8,
  <>
    <circle cx="7.5" cy="15.5" r="4.5" />
    <path d="M10.7 12.3L21 2M16 7l3 3M18 5l2 2" />
  </>,
);
export const ShieldIcon = line(13, 1.8, <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />);
export const FolderIcon = line(
  17,
  2,
  <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />,
);
export const ForkIcon = line(
  13,
  1.8,
  <>
    <circle cx="6" cy="5" r="2.2" />
    <circle cx="6" cy="19" r="2.2" />
    <circle cx="18" cy="7" r="2.2" />
    <path d="M6 7.2v9.6M18 9.2c0 5-6 4-12 7.6" />
  </>,
);
export const BoxIcon = line(
  10,
  2.4,
  <>
    <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
    <path d="M3.3 7L12 12l8.7-5M12 22V12" />
  </>,
);
export const InboxIcon = line(
  13,
  1.8,
  <>
    <path d="M22 12h-6l-2 3h-4l-2-3H2" />
    <path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z" />
  </>,
);
export const GlobeIcon = line(
  15,
  1.8,
  <>
    <circle cx="12" cy="12" r="10" />
    <path d="M2 12h20M12 2a15 15 0 010 20 15 15 0 010-20z" />
  </>,
);
export const BoltIcon = line(14, 1.8, <path d="M13 2L3 14h9l-1 8 10-12h-9z" />);
export const PencilIcon = line(
  12,
  1.8,
  <>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" />
  </>,
);
export const ChevronRightIcon = line(16, 2.4, <path d="M9 18l6-6-6-6" />);
export const ChevronLeftIcon = line(16, 2.4, <path d="M15 18l-6-6 6-6" />);
export const ChevronDownIcon = line(13, 1.8, <path d="M6 9l6 6 6-6" />);
export const CloseIcon = line(16, 2.2, <path d="M18 6L6 18M6 6l12 12" />);
export const FileIcon = line(
  14,
  1.8,
  <>
    <path d="M14.5 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V7.5z" />
    <path d="M14 2v6h6" />
  </>,
);
export const MergeIcon = line(
  15,
  1.8,
  <>
    <circle cx="18" cy="18" r="3" />
    <circle cx="6" cy="6" r="3" />
    <path d="M6 21V9a9 9 0 009 9" />
  </>,
);
export const HelpChatIcon = line(
  15,
  1.8,
  <>
    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    <path d="M12 13h.01M10.3 7.8a1.8 1.8 0 113.2 1.2c-.6.5-1.5.9-1.5 1.8" />
  </>,
);
export const AlertIcon = line(12, 3, <path d="M12 7v6M12 17h.01" />);
export const MinusIcon = line(12, 3, <path d="M6 12h12" />);
