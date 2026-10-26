// Inline SVG icon set (stroke icons on a 24px grid) so the app has no runtime
// icon-font / CDN dependency.

const Svg = ({ size = 18, children, ...rest }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...rest}
  >
    {children}
  </svg>
);

export const IconGrid = (p) => (
  <Svg {...p}>
    <rect x="3" y="3" width="7" height="7" rx="1.5" fill="currentColor" stroke="none" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" fill="currentColor" stroke="none" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" fill="currentColor" stroke="none" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" fill="currentColor" stroke="none" />
  </Svg>
);
export const IconMap = (p) => (
  <Svg {...p}>
    <path d="M3 6.5 9 4l6 2.5L21 4v13.5L15 20l-6-2.5L3 20z" />
    <path d="M9 4v13.5M15 6.5V20" />
  </Svg>
);
export const IconPin = (p) => (
  <Svg {...p}>
    <path d="M19 10c0 5.5-7 11-7 11s-7-5.5-7-11a7 7 0 0 1 14 0Z" />
    <circle cx="12" cy="10" r="2.5" />
  </Svg>
);
export const IconZones = (p) => (
  <Svg {...p}>
    <path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16" />
    <rect x="8" y="8" width="8" height="8" rx="1" />
  </Svg>
);
export const IconTarget = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
  </Svg>
);
export const IconTrend = (p) => (
  <Svg {...p}>
    <path d="m3 17 6-6 4 4 8-8" />
    <path d="M15 7h6v6" />
  </Svg>
);
export const IconUser = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21v-.5A6.5 6.5 0 0 1 10.5 14h3a6.5 6.5 0 0 1 6.5 6.5v.5" />
  </Svg>
);
export const IconPause = (p) => (
  <Svg {...p}>
    <path d="M9 6v12M15 6v12" strokeWidth="2.6" />
  </Svg>
);
export const IconPlay = (p) => (
  <Svg {...p}>
    <path d="M8 5.5v13l10.5-6.5z" fill="currentColor" />
  </Svg>
);
export const IconArrowRight = (p) => (
  <Svg {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" strokeWidth="2.4" />
  </Svg>
);
export const IconPlus = (p) => (
  <Svg {...p}>
    <path d="M12 6v12M6 12h12" strokeWidth="2.6" />
  </Svg>
);
export const IconMinus = (p) => (
  <Svg {...p}>
    <path d="M6 12h12" strokeWidth="2.6" />
  </Svg>
);
export const IconSwap = (p) => (
  <Svg {...p}>
    <path d="M7 4 3 8l4 4M3 8h13M17 20l4-4-4-4M21 16H8" />
  </Svg>
);
export const IconClose = (p) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
);
export const IconUpload = (p) => (
  <Svg {...p}>
    <path d="M12 15V4M7 9l5-5 5 5M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15" />
  </Svg>
);
export const IconChevron = ({ dir = 'up', ...p }) => {
  const rot = { up: 0, right: 90, down: 180, left: 270 }[dir];
  return (
    <Svg {...p} style={{ transform: `rotate(${rot}deg)` }}>
      <path d="m6 15 6-6 6 6" strokeWidth="2.6" />
    </Svg>
  );
};

export function IconBattery({ level = 100, size = 22 }) {
  const w = Math.max(0, Math.min(1, level / 100)) * 14;
  const color = level > 50 ? 'var(--green)' : level > 20 ? 'var(--yellow)' : 'var(--red)';
  return (
    <svg width={size} height={size * 0.55} viewBox="0 0 22 12" aria-hidden="true">
      <rect x="0.75" y="0.75" width="18" height="10.5" rx="2.2" fill="none" stroke="currentColor" strokeOpacity="0.55" strokeWidth="1.5" />
      <rect x="19.5" y="3.8" width="2" height="4.4" rx="0.8" fill="currentColor" fillOpacity="0.55" />
      <rect x="2.75" y="2.75" width={w} height="6.5" rx="1.2" fill={color} />
    </svg>
  );
}

export function IconSignal({ bars = 4, size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <rect
          key={i}
          x={1 + i * 3.8}
          y={12 - i * 3.3}
          width="2.6"
          height={3 + i * 3.3}
          rx="0.8"
          fill={i < bars ? 'var(--green)' : 'currentColor'}
          fillOpacity={i < bars ? 1 : 0.25}
        />
      ))}
    </svg>
  );
}
