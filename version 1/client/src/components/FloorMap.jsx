import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { MapIcon } from "./mapIcons";

// How each kind of space is drawn. `badge` is the icon badge colour.
const SPACE_STYLES = {
  shop:      { fill: "#fdf1e0", stroke: "#e9c48f", badge: "#e37400", icon: "shop" },
  toilet:    { fill: "#e8f0fe", stroke: "#a9c3f3", badge: "#1a73e8", icon: "toilet" },
  seating:   { fill: "#e6f4ea", stroke: "#a5d3b1", badge: "#188038", icon: "seating" },
  stairwell: { fill: "#eef0f2", stroke: "#b9c0c7", badge: "#5f6368", icon: "stairs", pattern: "treads" },
  stairs:    { fill: "#eef0f2", stroke: "#b9c0c7", badge: "#5f6368", icon: "stairs", pattern: "treads" },
  lift:      { fill: "#dfe9fb", stroke: "#8fb0ea", badge: "#3367d6", icon: "lift" },
  service:   { fill: "#f1f3f4", stroke: "#d3d7db" },
  room:      { fill: "#f3eefc", stroke: "#c9b8ef", badge: "#7e57c2" },
};

const COLORS = {
  outside: "#e8ecef",
  floor: "#ffffff",
  wall: "#5f6368",
  column: "#9aa0a6",
  label: "#202124",
  sublabel: "#5f6368",
  accessible: "#1e8e3e",
  blocked: "#d93025",
};

// Rooms you can't get into (node accessible: false, e.g. the outdoor-only
// shops) are drawn plain light grey with no name or icon, so nobody tries to
// go there. Stairs are "not accessible" for wheelchairs but are still real
// places, so they keep their normal look.
const CLOSED_STYLE = { fill: "#eceef0", stroke: "#d9dcdf" };
const isClosed = (sp) => sp.accessible === false && !["stairwell", "stairs"].includes(sp.kind);
const styleFor = (sp) => (isClosed(sp) ? CLOSED_STYLE : SPACE_STYLES[sp.kind] ?? SPACE_STYLES.room);

// Angle (degrees) of the polygon wall nearest to a door point, so the door
// mark lines up with the wall it sits on.
function doorAngle(polygon, [x, y]) {
  let best = { d: Infinity, angle: 0 };
  for (let i = 0; i < polygon.length; i++) {
    const [ax, ay] = polygon[i];
    const [bx, by] = polygon[(i + 1) % polygon.length];
    const dx = bx - ax;
    const dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
    const d = Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
    if (d < best.d) best = { d, angle: (Math.atan2(dy, dx) * 180) / Math.PI };
  }
  return best.angle;
}

const MIN_ZOOM = 0.5; // relative to "fit to screen"
const MAX_ZOOM = 8;

function bounds(points) {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

function labelPoint(space) {
  if (space.labelAt) return space.labelAt;
  const b = bounds(space.polygon);
  return [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2];
}

const toPoints = (poly) => poly.map((p) => p.join(",")).join(" ");

// Pick a round scale-bar length that renders at a comfortable width.
function scaleBar(metresPerPixel, zoom) {
  if (!metresPerPixel) return null;
  for (const m of [1, 2, 5, 10, 20, 50, 100]) {
    const px = (m / metresPerPixel) * zoom;
    if (px >= 60) return { metres: m, px };
  }
  return null;
}

/**
 * The indoor map for one floor: a vector drawing of `layout` (rooms, walls,
 * columns, entrances) with drag-to-pan and scroll/button zoom. Everything is
 * in the floor's pixel space, the same one the nodes use.
 *
 * Props:
 *   layout    - floor.layout from /api/buildings (may be null)
 *   image     - { url, width, height } reference floor plan
 *   graph     - { nodes, edges } to overlay (debug), or null
 *   showImage - draw the reference image underneath (debug / no layout yet)
 */
export default function FloorMap({ layout, image, graph, showImage }) {
  const svgRef = useRef(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [view, setView] = useState(null); // { s, tx, ty }
  const drag = useRef(null);

  const width = layout?.width ?? image?.width ?? 1000;
  const height = layout?.height ?? image?.height ?? 1000;

  // What "fit to screen" should frame: the building outline (+ margin for
  // entrance markers), or the whole image if there's no layout yet.
  const frame = useMemo(() => {
    if (layout?.outline) {
      const b = bounds(layout.outline);
      const m = 70;
      return { x0: b.x0 - m, y0: b.y0 - m, x1: b.x1 + m, y1: b.y1 + m };
    }
    return { x0: 0, y0: 0, x1: width, y1: height };
  }, [layout, width, height]);

  const fitView = useCallback(() => {
    const { w, h } = size;
    if (!w || !h) return null;
    const pad = 24;
    const fw = frame.x1 - frame.x0;
    const fh = frame.y1 - frame.y0;
    const s = Math.min((w - pad * 2) / fw, (h - pad * 2) / fh);
    return { s, tx: (w - fw * s) / 2 - frame.x0 * s, ty: (h - fh * s) / 2 - frame.y0 * s };
  }, [size, frame]);

  const fitScale = fitView()?.s ?? 1;

  // Track the container size.
  useLayoutEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width: w, height: h } = entry.contentRect;
      setSize({ w, h });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Re-fit when the floor changes or the container is first measured.
  useEffect(() => {
    const v = fitView();
    if (v) setView(v);
  }, [layout, image?.url, size.w > 0, size.h > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  const zoomAt = useCallback(
    (factor, mx, my) => {
      setView((v) => {
        if (!v) return v;
        const s = Math.min(Math.max(v.s * factor, fitScale * MIN_ZOOM), fitScale * MAX_ZOOM);
        const wx = (mx - v.tx) / v.s;
        const wy = (my - v.ty) / v.s;
        return { s, tx: mx - wx * s, ty: my - wy * s };
      });
    },
    [fitScale]
  );

  // Wheel zoom (non-passive so the page doesn't scroll).
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  const onPointerDown = (e) => {
    if (!view) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty };
  };
  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d) return;
    setView((v) => ({ ...v, tx: d.tx + e.clientX - d.x, ty: d.ty + e.clientY - d.y }));
  };
  const onPointerUp = () => {
    drag.current = null;
  };

  const s = view?.s ?? 1;
  const k = 1 / s; // multiply by k to draw something at a fixed on-screen size
  const bar = scaleBar(layout?.metresPerPixel, s);

  return (
    <div className="floor-map">
      <svg
        ref={svgRef}
        className="floor-map-svg"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={(e) => {
          const r = svgRef.current.getBoundingClientRect();
          zoomAt(1.8, e.clientX - r.left, e.clientY - r.top);
        }}
      >
        <defs>
          <pattern id="treads" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(90)">
            <line x1="0" y1="0" x2="0" y2="14" stroke="#c3c9cf" strokeWidth="3" />
          </pattern>
          <filter id="map-shadow" x="-5%" y="-5%" width="110%" height="110%">
            <feDropShadow dx="0" dy="6" stdDeviation="10" floodColor="#000" floodOpacity="0.12" />
          </filter>
        </defs>

        <rect width="100%" height="100%" fill={COLORS.outside} />

        {view && (
          <g transform={`translate(${view.tx} ${view.ty}) scale(${s})`}>
            {layout?.outline && (
              <polygon points={toPoints(layout.outline)} fill={COLORS.floor} filter="url(#map-shadow)" />
            )}

            {image?.url && (showImage || !layout) && (
              <image
                href={image.url}
                width={image.width}
                height={image.height}
                opacity={layout ? 0.35 : 1}
                style={{ pointerEvents: "none" }}
              />
            )}

            {layout?.spaces.map((sp) => {
              const st = styleFor(sp);
              return (
                <g key={sp.id}>
                  <polygon
                    points={toPoints(sp.polygon)}
                    fill={st.fill}
                    fillOpacity={showImage ? 0.6 : 1}
                    stroke={st.stroke}
                    strokeWidth={2}
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                  />
                  {st.pattern && (
                    <polygon points={toPoints(sp.polygon)} fill={`url(#${st.pattern})`} opacity={0.55} />
                  )}
                </g>
              );
            })}

            {layout?.columns?.map(([x, y, w, h], i) => (
              <rect key={i} x={x} y={y} width={w} height={h} rx={2} fill={COLORS.column} />
            ))}

            {layout?.outline && (
              <polygon
                points={toPoints(layout.outline)}
                fill="none"
                stroke={COLORS.wall}
                strokeWidth={3.5}
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            )}

            {/* Room doors: a small pill on the wall where you walk in, in the
                room's colour. Routes will end here. Fixed on-screen size. */}
            {layout?.spaces.map((sp) =>
              isClosed(sp)
                ? null
                : (sp.doors ?? []).map(([x, y], i) => (
                    <g
                      key={`door-${sp.id}-${i}`}
                      transform={`translate(${x} ${y}) rotate(${doorAngle(sp.polygon, [x, y])}) scale(${k})`}
                      style={{ pointerEvents: "none" }}
                    >
                      <rect x={-10} y={-3.5} width={20} height={7} rx={3.5} fill={styleFor(sp).badge ?? COLORS.wall} stroke="white" strokeWidth={2} />
                    </g>
                  ))
            )}

            {/* Entrances: drawn on the outer wall, fixed on-screen size */}
            {layout?.entrances?.map((en, i) => {
              const main = en.kind === "main";
              const dir = en.side === "W" ? -1 : 1;
              return (
                <g key={i} transform={`translate(${en.x} ${en.y}) scale(${k})`}>
                  <rect x={-5} y={-16} width={10} height={32} fill={COLORS.floor} />
                  <g transform={`translate(${dir * 22} 0)`}>
                    <circle r={main ? 15 : 11} fill={main ? COLORS.accessible : "#9aa0a6"} stroke="white" strokeWidth={2} />
                    <g transform={`scale(${main ? 0.8 : 0.6})`}>
                      <MapIcon name={main ? "entrance" : "exit"} />
                    </g>
                    {main && s >= 0.45 && (
                      <text
                        x={dir * 21}
                        y={4}
                        textAnchor={dir < 0 ? "end" : "start"}
                        className="map-label"
                        fontSize={12}
                        fontWeight={600}
                        fill={COLORS.accessible}
                      >
                        {en.label ?? "Entrance"}
                      </text>
                    )}
                  </g>
                </g>
              );
            })}

            {/* Space labels + icons, fixed on-screen size */}
            {layout?.spaces.map((sp) => {
              const st = styleFor(sp);
              if (isClosed(sp) || (!st.icon && !sp.label)) return null;
              const [cx, cy] = labelPoint(sp);
              // Only show text once the space is big enough on screen for it
              // (zoom in to reveal more), like labels on a map app.
              const b = bounds(sp.polygon);
              const onScreenW = (b.x1 - b.x0) * s;
              const onScreenH = (b.y1 - b.y0) * s;
              // Label text on one line if it fits, else one word per line
              // ("Common" / "Space"), else hidden until you zoom in.
              const fits = (t) => onScreenW >= t.length * 7.2 + 8;
              let lines = [];
              if (sp.label) {
                const words = sp.label.split(" ");
                if (fits(sp.label)) lines = [sp.label];
                else if (words.length > 1 && words.every(fits)) lines = words;
              }
              if (onScreenH < 44 + lines.length * 15) lines = [];
              const hasText = lines.length > 0;
              const textTop = st.icon ? 18 : 4;
              if (!hasText && (!st.icon || onScreenW < 22)) return null;
              return (
                <g key={`label-${sp.id}`} transform={`translate(${cx} ${cy}) scale(${k})`} style={{ pointerEvents: "none" }}>
                  {st.icon && (
                    <g transform={`translate(0 ${hasText ? -12 : 0})`}>
                      <circle r={13} fill={st.badge} stroke="white" strokeWidth={2} />
                      <g transform="scale(0.72)">
                        <MapIcon name={st.icon} />
                      </g>
                    </g>
                  )}
                  {lines.map((t, i) => (
                    <text key={i} y={textTop + i * 15} textAnchor="middle" className="map-label" fontSize={13} fontWeight={600} fill={COLORS.label}>
                      {t}
                    </text>
                  ))}
                  {hasText && sp.sublabel && onScreenH >= 66 + lines.length * 15 && (
                    <text y={textTop + (lines.length - 1) * 15 + 14} textAnchor="middle" className="map-label" fontSize={11} fill={COLORS.sublabel}>
                      {sp.sublabel}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Debug overlay: nodes + edges */}
            {graph && (
              <g style={{ pointerEvents: "none" }}>
                {graph.edges.map((e) => (
                  <line
                    key={e.id}
                    x1={e.from.x}
                    y1={e.from.y}
                    x2={e.to.x}
                    y2={e.to.y}
                    stroke={e.accessible ? COLORS.accessible : COLORS.blocked}
                    strokeWidth={2.5}
                    strokeDasharray={e.accessible ? undefined : "6 4"}
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
                {graph.nodes.map((n) => (
                  <g key={n.id} transform={`translate(${n.x} ${n.y}) scale(${k})`}>
                    <circle r={6} fill={n.accessible ? COLORS.accessible : COLORS.blocked} stroke="white" strokeWidth={2} />
                    <text x={9} y={4} className="map-label" fontSize={11} fontWeight={600} fill={COLORS.label}>
                      {n.name}
                    </text>
                  </g>
                ))}
              </g>
            )}
          </g>
        )}
      </svg>

      <div className="map-zoom-controls">
        <button aria-label="Zoom in" onClick={() => zoomAt(1.4, size.w / 2, size.h / 2)}>+</button>
        <button aria-label="Zoom out" onClick={() => zoomAt(1 / 1.4, size.w / 2, size.h / 2)}>−</button>
        <button aria-label="Fit to screen" onClick={() => setView(fitView())} className="map-fit">⤢</button>
      </div>

      {bar && (
        <div className="map-scale">
          <div className="map-scale-bar" style={{ width: bar.px }} />
          <span>{bar.metres} m</span>
        </div>
      )}
    </div>
  );
}