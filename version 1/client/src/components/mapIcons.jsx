// Small line icons for the indoor map, drawn in a 24x24 box centred on 0,0.
// Rendered white on a coloured badge.

const P = { fill: "none", stroke: "white", strokeWidth: 2.2, strokeLinecap: "round", strokeLinejoin: "round" };

const ICONS = {
  stairs: <path {...P} d="M4 19h4.5v-4.5H13V10h4.5V5.5H21" />,
  lift: (
    <g {...P}>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M9 10.5l3-3 3 3M9 13.5l3 3 3-3" />
    </g>
  ),
  toilet: (
    <text x="12" y="16.5" textAnchor="middle" fontSize="11.5" fontWeight="700" fill="white" fontFamily="system-ui, sans-serif">
      WC
    </text>
  ),
  shop: (
    <g {...P}>
      <path d="M5.5 8h13l-1.2 12H6.7z" />
      <path d="M9 8V6.5a3 3 0 0 1 6 0V8" />
    </g>
  ),
  seating: (
    <g {...P}>
      <path d="M6 11V7.5A2.5 2.5 0 0 1 8.5 5h7A2.5 2.5 0 0 1 18 7.5V11" />
      <path d="M4 11h16v4.5H4zM6.5 15.5V19M17.5 15.5V19" />
    </g>
  ),
  entrance: (
    <g {...P}>
      <path d="M13 4h5v16h-5" />
      <path d="M3.5 12H13M9.5 8l4 4-4 4" />
    </g>
  ),
  exit: (
    <g {...P}>
      <path d="M11 4H6v16h5" />
      <path d="M20.5 12H10.5M16.5 8l4 4-4 4" />
    </g>
  ),
  room: (
    <g {...P}>
      <path d="M6 20.5V4.5a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v16M3.5 20.5h17" />
      <circle cx="14.5" cy="12.5" r="1" fill="white" stroke="none" />
    </g>
  ),
};

export function MapIcon({ name }) {
  const icon = ICONS[name];
  if (!icon) return null;
  return <g transform="translate(-12 -12)">{icon}</g>;
}

// The same icons as a small coloured circle, for use in regular HTML (search
// results, place card).
export function IconBadge({ name, color, size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="-16 -16 32 32" aria-hidden="true" className="shrink-0">
      <circle r="16" fill={color} />
      <g transform="scale(0.8)">
        <MapIcon name={name} />
      </g>
    </svg>
  );
}