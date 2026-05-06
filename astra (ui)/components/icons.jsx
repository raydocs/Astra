;(function(){
// React loaded globally via UMD

/* ====================================================================
   Astra — shared icons (line, no emoji, restrained)
   ==================================================================== */

const Icon = ({ children, size = 16, stroke = 1.5, style }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={stroke}
    strokeLinecap="round"
    strokeLinejoin="round"
    style={style}
  >
    {children}
  </svg>
);

const IconStar = (p) => (
  <Icon {...p}>
    <path d="M12 3l1.7 5.4 5.6.2-4.5 3.4 1.6 5.4L12 14.2l-4.4 3.2 1.6-5.4-4.5-3.4 5.6-.2L12 3z" />
  </Icon>
);

const IconSparkle = (p) => (
  <Icon {...p}>
    <path d="M12 4v6M12 14v6M4 12h6M14 12h6" />
  </Icon>
);

const IconBook = (p) => (
  <Icon {...p}>
    <path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H19v15.5H6a2 2 0 0 0-2 2V4.5z" />
    <path d="M4 19.5A2 2 0 0 1 6 17.5h13" />
  </Icon>
);

const IconLanguages = (p) => (
  <Icon {...p}>
    <path d="M3 5h10M5 5v2a4 4 0 0 0 4 4M11 5v2a4 4 0 0 1-4 4" />
    <path d="M11 19l4-9 4 9M12.5 16h5" />
  </Icon>
);

const IconBookmark = (p) => (
  <Icon {...p}>
    <path d="M6 3h12v18l-6-4-6 4V3z" />
  </Icon>
);

const IconHighlighter = (p) => (
  <Icon {...p}>
    <path d="M12 19l-7 2 2-7 9-9 5 5-9 9z" />
    <path d="M14 6l4 4" />
  </Icon>
);

const IconClock = (p) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Icon>
);

const IconFlame = (p) => (
  <Icon {...p}>
    <path d="M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4-1 2 1 3 2 2 0-3-1-5 1-8z" />
  </Icon>
);

const IconArrowRight = (p) => (
  <Icon {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Icon>
);

const IconArrowUpRight = (p) => (
  <Icon {...p}>
    <path d="M7 17L17 7M9 7h8v8" />
  </Icon>
);

const IconCheck = (p) => (
  <Icon {...p}>
    <path d="M5 12.5l4.5 4.5L19 7" />
  </Icon>
);

const IconClose = (p) => (
  <Icon {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Icon>
);

const IconSettings = (p) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.3.9a7 7 0 0 0-1.7-1L14.5 3h-5l-.4 2.5a7 7 0 0 0-1.7 1L5 5.6l-2 3.4L5 10.5a7 7 0 0 0 0 3l-2 1.5 2 3.4 2.3-.9a7 7 0 0 0 1.7 1l.5 2.5h5l.4-2.5a7 7 0 0 0 1.7-1l2.3.9 2-3.4L19 13a7 7 0 0 0 .1-1z" />
  </Icon>
);

const IconGlobe = (p) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
  </Icon>
);

const IconList = (p) => (
  <Icon {...p}>
    <path d="M4 6h16M4 12h16M4 18h10" />
  </Icon>
);

const IconSearch = (p) => (
  <Icon {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M20 20l-4-4" />
  </Icon>
);

const IconPause = (p) => (
  <Icon {...p}>
    <rect x="6" y="5" width="4" height="14" rx="0.5" />
    <rect x="14" y="5" width="4" height="14" rx="0.5" />
  </Icon>
);

const IconPlay = (p) => (
  <Icon {...p}>
    <path d="M7 5l11 7-11 7V5z" />
  </Icon>
);

const IconChevronDown = (p) => (
  <Icon {...p}>
    <path d="M6 9l6 6 6-6" />
  </Icon>
);

const IconChevronRight = (p) => (
  <Icon {...p}>
    <path d="M9 6l6 6-6 6" />
  </Icon>
);

const IconDot = ({ size = 8, color = "currentColor" }) => (
  <span
    aria-hidden
    style={{
      display: "inline-block",
      width: size,
      height: size,
      borderRadius: "50%",
      background: color,
    }}
  />
);

/* Astra mark — a small constellation glyph (4-point star + 3 stars)  */
const AstraMark = ({ size = 22, stroke = 1.4, style }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={stroke}
    strokeLinecap="round"
    strokeLinejoin="round"
    style={style}
  >
    <path d="M12 4l1.4 4.6L18 10l-4.6 1.4L12 16l-1.4-4.6L6 10l4.6-1.4L12 4z" />
    <circle cx="19" cy="5" r="0.6" fill="currentColor" />
    <circle cx="5" cy="18" r="0.6" fill="currentColor" />
    <circle cx="20" cy="17" r="0.4" fill="currentColor" />
  </svg>
);

/* Wordmark — Astra in serif with a star sitting in for the 'a' counter */
const AstraWordmark = ({ size = 28, color = "currentColor" }) => (
  <span
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      color,
      fontFamily: "var(--font-serif)",
      fontSize: size,
      letterSpacing: "-0.02em",
      lineHeight: 1,
    }}
  >
    <AstraMark size={size * 0.78} stroke={1.3} />
    <span>Astra</span>
  </span>
);

Object.assign(window, {
  IconStar,
  IconSparkle,
  IconBook,
  IconLanguages,
  IconBookmark,
  IconHighlighter,
  IconClock,
  IconFlame,
  IconArrowRight,
  IconArrowUpRight,
  IconCheck,
  IconClose,
  IconSettings,
  IconGlobe,
  IconList,
  IconSearch,
  IconPause,
  IconPlay,
  IconChevronDown,
  IconChevronRight,
  IconDot,
  AstraMark,
  AstraWordmark,
});

})();