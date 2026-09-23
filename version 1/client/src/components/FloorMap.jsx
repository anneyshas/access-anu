import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { MapIcon } from "./MapIcons";
import Icon from "./icons";
import { isClosed, isSelectable } from "../places";

// How each kind of space is drawn — neutral rooms with coloured icon badges,
// like indoor maps in Google Maps.
const SPACE_STYLES = {
  room:      { fill: "#f6f4ef", stroke: "#d6d2c8", badge: "#7e57c2" },
  shop:      { fill: "#fdf1e0", stroke: "#e9c48f", badge: "#e37400", icon: "shop" },
  toilet:    { fill: "#e8f0fe", stroke: "#b3c9f2", badge: "#1a73e8", icon: "toilet" },
  seating:   { fill: "#e6f4ea", stroke: "#a8d5b5", badge: "#188038", icon: "seating" },
  stairwell: { fill: "#eceef1", stroke: "#c3c8ce", badge: "#5f6368", icon: "stairs", pattern: "treads" },
  stairs:    { fill: "#eceef1", stroke: "#c3c8ce", badge: "#5f6368", icon: "stairs", pattern: "treads" },
  lift:      { fill: "#e3eaf6", stroke: "#a7bde3", badge: "#3367d6", icon: "lift" },
  service:   { fill: "#f1f3f4", stroke: "#dadce0" },
  void:      { fill: "#f8f9fa", stroke: "#dadce0", pattern: "hatch", muted: true },
};
// Rooms you can't get into: plain light grey, no name or icon.
const CLOSED_STYLE = { fill: "#eceef0", stroke: "#dcdfe2" };
const styleFor = (sp) => (isClosed(sp) ? CLOSED_STYLE : SPACE_STYLES[sp.kind] ?? SPACE_STYLES.room);

const C = {
  outside: "#eef0f3",
  floor: "#ffffff",
  wall: "#80868b",
  column: "#b6bbc1",
  label: "#3c4043",
  sublabel: "#70757a",
  blue: "#1a73e8",
  blueSoft: "#d2e3fc",
  red: "#ea4335",
  green: "#188038",
  blocked: "#d93025",
};

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
function contains(poly, [x, y]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
// Angle of the wall nearest a door point, so the door mark lines up with it.
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
const toPoints = (poly) => poly.map((p) => p.join(",")).join(" ");

function scaleBar(metresPerPixel, zoom) {
  if (!metresPerPixel) return null;
  for (const m of [1, 2, 5, 10, 20, 50, 100]) {
    const px = (m / metresPerPixel) * zoom;
    if (px >= 60) return { metres: m, px };
  }
  return null;
}

/**
 * The indoor map for one floor: a vector drawing of `layout` with drag-to-
 * pan, scroll/button zoom, clickable places, category highlighting and a pin
 * on the selected place. Everything is in the floor's pixel space — the same
 * one the pathfinding nodes use.
 *
 * Props:
 *   layout      floor.layout (may be null -> shows the plan image instead)
 *   image       { url, width, height } reference floor plan
 *   graph       { nodes, edges } debug overlay, or null
 *   showImage   draw the reference image underneath (debug)
 *   selectedId  id of the selected space (gets a pin + highlight)
 *   highlight   array of space kinds to highlight (category chips)
 *   focusKey    change this to zoom the map onto `selectedId`
 *   onSelect    (spaceId | null) => void, when a place is tapped
 */
export default function FloorMap({ layout, image, graph, showImage, selectedId, highlight = [], focusKey, onSelect }) {
  const svgRef = useRef(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [view, setView] = useState(null); // { s, tx, ty }
  const drag = useRef(null);
  const anim = useRef(null);

  const width = layout?.width ?? image?.width ?? 1000;
  const height = layout?.height ?? image?.height ?? 1000;

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
    // Leave room for the search card on the left on wide screens.
    const padL = w >= 900 ? 420 : 16;
    const padT = w >= 900 ? 24 : 120;
    const pad = 24;
    const aw = w - padL - pad;
    const ah = h - padT - pad;
    const fw = frame.x1 - frame.x0;
    const fh = frame.y1 - frame.y0;
    const s = Math.min(aw / fw, ah / fh);
    return { s, tx: padL + (aw - fw * s) / 2 - frame.x0 * s, ty: padT + (ah - fh * s) / 2 - frame.y0 * s };
  }, [size, frame]);

  const fitScale = fitView()?.s ?? 1;

  const viewRef = useRef(null);
  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  // Smoothly move the camera to `target` (ease-out, 350 ms).
  const animateTo = useCallback((target) => {
    cancelAnimationFrame(anim.current);
    const start = viewRef.current;
    if (!start) return setView(target);
    const t0 = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - t0) / 350);
      const e = 1 - Math.pow(1 - t, 3);
      setView({
        s: start.s + (target.s - start.s) * e,
        tx: start.tx + (target.tx - start.tx) * e,
        ty: start.ty + (target.ty - start.ty) * e,
      });
      if (t < 1) anim.current = requestAnimationFrame(step);
    };
    anim.current = requestAnimationFrame(step);
  }, []);

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

  // Zoom onto the selected place when asked (search result picked).
  useEffect(() => {
    if (!focusKey || !selectedId || !layout || !size.w) return;
    const sp = layout.spaces.find((x) => x.id === selectedId);
    if (!sp) return;
    const b = bounds(sp.polygon);
    const s = Math.min(Math.max(Math.min((size.w * 0.35) / (b.x1 - b.x0), (size.h * 0.35) / (b.y1 - b.y0)), fitScale * 1.4), fitScale * 3.5);
    const [cx, cy] = [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2];
    const sx = size.w >= 900 ? size.w * 0.6 : size.w / 2;
    const sy = size.w >= 640 ? size.h * 0.45 : size.h * 0.35;
    animateTo({ s, tx: sx - cx * s, ty: sy - cy * s });
  }, [focusKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const zoomAt = useCallback(
    (factor, mx, my) => {
      cancelAnimationFrame(anim.current);
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

  // Drag to pan; a tap (little movement) selects the place under the finger.
  const onPointerDown = (e) => {
    if (!view) return;
    cancelAnimationFrame(anim.current);
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty, moved: 0 };
  };
  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d) return;
    d.moved = Math.max(d.moved, Math.hypot(e.clientX - d.x, e.clientY - d.y));
    setView((v) => ({ ...v, tx: d.tx + e.clientX - d.x, ty: d.ty + e.clientY - d.y }));
  };
  const onPointerUp = (e) => {
    const d = drag.current;
    drag.current = null;
    if (!d || d.moved > 5 || !layout || !view || !onSelect) return;
    const r = svgRef.current.getBoundingClientRect();
    const p = [(e.clientX - r.left - view.tx) / view.s, (e.clientY - r.top - view.ty) / view.s];
    const hit = [...layout.spaces].reverse().find((sp) => isSelectable(sp) && contains(sp.polygon, p));
    onSelect(hit ? hit.id : null);
  };

  const s = view?.s ?? 1;
  const k = 1 / s; // multiply by k to draw at a fixed on-screen size
  const bar = scaleBar(layout?.metresPerPixel, s);
  const selected = layout?.spaces.find((x) => x.id === selectedId);

  return (
    <div className="absolute inset-0">
      <svg
        ref={svgRef}
        className="block size-full cursor-grab touch-none select-none active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => (drag.current = null)}
        onDoubleClick={(e) => {
          const r = svgRef.current.getBoundingClientRect();
          zoomAt(1.8, e.clientX - r.left, e.clientY - r.top);
        }}
      >
        <defs>
          <pattern id="treads" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(90)">
            <line x1="0" y1="0" x2="0" y2="14" stroke="#c9ced4" strokeWidth="3" />
          </pattern>
          <pattern id="hatch" width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="16" stroke="#e3e5e8" strokeWidth="5" />
          </pattern>
          <filter id="map-shadow" x="-5%" y="-5%" width="110%" height="110%">
            <feDropShadow dx="0" dy="4" stdDeviation="8" floodColor="#3c4043" floodOpacity="0.14" />
          </filter>
        </defs>

        <rect width="100%" height="100%" fill={C.outside} />

        {view && (
          <g transform={`translate(${view.tx} ${view.ty}) scale(${s})`}>
            {layout?.outline && (
              <polygon points={toPoints(layout.outline)} fill={C.floor} filter="url(#map-shadow)" />
            )}

            {image?.url && (showImage || !layout) && (
              <image href={image.url} width={image.width} height={image.height} opacity={layout ? 0.35 : 1} style={{ pointerEvents: "none" }} />
            )}

            {/* Spaces */}
            {layout?.spaces.map((sp) => {
              const st = styleFor(sp);
              const isSel = sp.id === selectedId;
              const isHi = !isClosed(sp) && highlight.includes(sp.kind);
              return (
                <g key={sp.id}>
                  <polygon
                    points={toPoints(sp.polygon)}
                    fill={isSel ? C.blueSoft : st.fill}
                    fillOpacity={showImage ? 0.6 : 1}
                    stroke={isSel || isHi ? C.blue : st.stroke}
                    strokeWidth={isSel ? 3 : isHi ? 2.5 : 1.5}
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                  />
                  {st.pattern && <polygon points={toPoints(sp.polygon)} fill={`url(#${st.pattern})`} opacity={isSel ? 0.35 : 0.6} />}
                </g>
              );
            })}

            {layout?.columns?.map(([x, y, w, h], i) => (
              <rect key={i} x={x} y={y} width={w} height={h} rx={2} fill={C.column} />
            ))}

            {layout?.outline && (
              <polygon points={toPoints(layout.outline)} fill="none" stroke={C.wall} strokeWidth={3} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            )}

            {/* Room doors: small pill on the wall where you walk in */}
            {layout?.spaces.map((sp) =>
              isClosed(sp)
                ? null
                : (sp.doors ?? []).map(([x, y], i) => (
                    <g key={`door-${sp.id}-${i}`} transform={`translate(${x} ${y}) rotate(${doorAngle(sp.polygon, [x, y])}) scale(${k})`} style={{ pointerEvents: "none" }}>
                      <rect x={-9} y={-3} width={18} height={6} rx={3} fill={styleFor(sp).badge ?? C.wall} stroke="white" strokeWidth={1.5} />
                    </g>
                  ))
            )}

            {/* Building entrances */}
            {layout?.entrances?.map((en, i) => {
              const main = en.kind === "main";
              const dir = en.side === "W" ? -1 : 1;
              return (
                <g key={i} transform={`translate(${en.x} ${en.y}) scale(${k})`} style={{ pointerEvents: "none" }}>
                  <rect x={-4} y={-14} width={8} height={28} fill={C.floor} />
                  <g transform={`translate(${dir * 20} 0)`}>
                    <circle r={main ? 14 : 10} fill={main ? C.green : "#9aa0a6"} stroke="white" strokeWidth={2} />
                    <g transform={`scale(${main ? 0.75 : 0.55})`}>
                      <MapIcon name={main ? "entrance" : "exit"} />
                    </g>
                    {main && s >= 0.45 && (
                      <text x={dir * 20} y={4} textAnchor={dir < 0 ? "end" : "start"} className="map-label" fontSize={12} fontWeight={500} fill={C.green}>
                        {en.label ?? "Entrance"}
                      </text>
                    )}
                  </g>
                </g>
              );
            })}

            {/* Labels + icons (fixed on-screen size; text appears as you zoom in) */}
            {layout?.spaces.map((sp) => {
              const st = styleFor(sp);
              if (isClosed(sp) || (!st.icon && !sp.label)) return null;
              const [cx, cy] = labelPoint(sp);
              const b = bounds(sp.polygon);
              const w = (b.x1 - b.x0) * s;
              const h = (b.y1 - b.y0) * s;
              const fits = (t) => w >= t.length * 7 + 8;
              let lines = [];
              if (sp.label) {
                const words = sp.label.split(" ");
                if (fits(sp.label)) lines = [sp.label];
                else if (words.length > 1 && words.every(fits)) lines = words;
              }
              const iconH = st.icon ? 30 : 0;
              if (h < iconH + 14 + lines.length * 15) lines = [];
              const hasText = lines.length > 0;
              if (!hasText && (!st.icon || w < 22)) return null;
              const textTop = st.icon ? 18 : 4 - ((lines.length - 1) * 15) / 2;
              const hi = highlight.includes(sp.kind);
              return (
                <g key={`label-${sp.id}`} transform={`translate(${cx} ${cy}) scale(${k})`} style={{ pointerEvents: "none" }}>
                  {st.icon && (
                    <g transform={`translate(0 ${hasText ? -12 : 0})`}>
                      {hi && <circle r={19} fill={C.blue} opacity={0.18} />}
                      <circle r={12.5} fill={st.badge} stroke="white" strokeWidth={2} />
                      <g transform="scale(0.68)">
                        <MapIcon name={st.icon} />
                      </g>
                    </g>
                  )}
                  {lines.map((t, i) => (
                    <text
                      key={i}
                      y={textTop + i * 15}
                      textAnchor="middle"
                      className="map-label"
                      fontSize={st.muted ? 11.5 : 13}
                      fontWeight={st.muted ? 400 : 500}
                      fontStyle={st.muted ? "italic" : "normal"}
                      fill={st.muted ? C.sublabel : C.label}
                    >
                      {t}
                    </text>
                  ))}
                  {hasText && sp.sublabel && h >= iconH + 36 + lines.length * 15 && (
                    <text y={textTop + (lines.length - 1) * 15 + 14} textAnchor="middle" className="map-label" fontSize={11} fill={C.sublabel}>
                      {sp.sublabel}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Debug overlay: nodes + edges (?graph=1) */}
            {graph && (
              <g style={{ pointerEvents: "none" }}>
                {graph.edges.map((e) => (
                  <line key={e.id} x1={e.from.x} y1={e.from.y} x2={e.to.x} y2={e.to.y} stroke={e.accessible ? C.green : C.blocked} strokeWidth={2.5} strokeDasharray={e.accessible ? undefined : "6 4"} vectorEffect="non-scaling-stroke" />
                ))}
                {graph.nodes.map((n) => (
                  <g key={n.id} transform={`translate(${n.x} ${n.y}) scale(${k})`}>
                    <circle r={6} fill={n.accessible ? C.green : C.blocked} stroke="white" strokeWidth={2} />
                    <text x={9} y={4} className="map-label" fontSize={11} fontWeight={500} fill={C.label}>
                      {n.name}
                    </text>
                  </g>
                ))}
              </g>
            )}

            {/* Pin on the selected place (Google-Maps-style red marker) */}
            {selected && (() => {
              const [px, py] = labelPoint(selected);
              return (
                // Pin tip sits just above the room's label so the name stays readable.
                <g transform={`translate(${px} ${py}) scale(${k}) translate(0 -12)`} style={{ pointerEvents: "none" }}>
                  <ellipse cx={0} cy={0} rx={6} ry={2.5} fill="#000" opacity={0.25} />
                  <path d="M0 0C-3-9-13-15-13-25a13 13 0 0 1 26 0c0 10-10 16-13 25z" fill={C.red} stroke="#b31412" strokeWidth={1} />
                  <circle cx={0} cy={-25} r={4.8} fill="#b31412" />
                </g>
              );
            })()}
          </g>
        )}
      </svg>

      {/* Zoom controls */}
      <div className="absolute right-3 bottom-6 z-20 flex flex-col overflow-hidden rounded-lg bg-white shadow-map sm:right-4">
        <button aria-label="Zoom in" onClick={() => zoomAt(1.4, size.w / 2, size.h / 2)} className="grid size-10 place-items-center text-map-muted hover:bg-map-hover">
          <Icon name="add" />
        </button>
        <button aria-label="Zoom out" onClick={() => zoomAt(1 / 1.4, size.w / 2, size.h / 2)} className="grid size-10 place-items-center border-t border-map-line text-map-muted hover:bg-map-hover">
          <Icon name="remove" />
        </button>
        <button aria-label="Fit to screen" title="Show whole floor" onClick={() => { const v = fitView(); if (v) animateTo(v); }} className="grid size-10 place-items-center border-t border-map-line text-map-muted hover:bg-map-hover">
          <Icon name="fit" className="size-[18px]" />
        </button>
      </div>

      {bar && (
        <div className="absolute right-16 bottom-6 z-20 flex items-center gap-2 rounded bg-white/85 px-2 py-1 text-[11px] text-map-ink-2 sm:right-[76px]">
          <span>{bar.metres} m</span>
          <div className="h-1.5 border-x-2 border-b-2 border-map-ink-2" style={{ width: bar.px }} />
        </div>
      )}
    </div>
  );
}