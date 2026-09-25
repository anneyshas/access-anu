// Dev tool (?calibrate=1 on the campus map): lines the building's floor plan
// up with the real building on the map, then prints the "georeference" +
// "metresPerPixel" to paste into prisma/data/<building>/building.json.
//
// Fitting the plan to the real footprint also fixes the scale, so indoor
// distances become real metres instead of an estimate.
import { useEffect, useState } from "react";
import { pixelToLngLat } from "../lib/geo";
import { metresPerPixel, shortName } from "../lib/campus";

const SRC = "cal-plan";

function planGeoJSON(building, georef, mpp) {
  const floor = building.floors[0];
  const toLL = (pts) => pts.map(([x, y]) => pixelToLngLat(georef, mpp, x, y));
  const ring = (pts) => [...toLL(pts), toLL([pts[0]])[0]];
  const features = [{ type: "Feature", properties: { kind: "outline" }, geometry: { type: "Polygon", coordinates: [ring(floor.layout.outline)] } }];
  for (const sp of floor.layout.spaces) {
    features.push({ type: "Feature", properties: { kind: sp.kind }, geometry: { type: "Polygon", coordinates: [ring(sp.polygon)] } });
  }
  for (const en of floor.layout.entrances ?? []) {
    features.push({ type: "Feature", properties: { kind: `entrance-${en.kind}` }, geometry: { type: "Point", coordinates: pixelToLngLat(georef, mpp, en.x, en.y) } });
  }
  return { type: "FeatureCollection", features };
}

function draw(map, data) {
  try {
    drawLayers(map, data);
  } catch {
    // style is switching; redrawn on style.load
  }
}

function drawLayers(map, data) {
  if (map.getSource(SRC)) {
    map.getSource(SRC).setData(data);
    return;
  }
  map.addSource(SRC, { type: "geojson", data });
  map.addLayer({ id: "cal-fill", type: "fill", source: SRC, slot: "top", filter: ["==", ["geometry-type"], "Polygon"],
    paint: { "fill-color": ["match", ["get", "kind"], "outline", "#1a73e8", "#ffffff"], "fill-opacity": ["match", ["get", "kind"], "outline", 0.15, 0.35] } });
  map.addLayer({ id: "cal-line", type: "line", source: SRC, slot: "top", filter: ["==", ["geometry-type"], "Polygon"],
    paint: { "line-color": ["match", ["get", "kind"], "outline", "#1a73e8", "#d93025"], "line-width": ["match", ["get", "kind"], "outline", 3, 1] } });
  map.addLayer({ id: "cal-pts", type: "circle", source: SRC, slot: "top", filter: ["==", ["geometry-type"], "Point"],
    paint: { "circle-radius": 6, "circle-color": ["match", ["get", "kind"], "entrance-main", "#188038", "#e37400"], "circle-stroke-color": "#fff", "circle-stroke-width": 2 } });
}

function Btn({ children, onClick, title }) {
  return (
    <button onClick={onClick} title={title} className="h-8 min-w-8 rounded-lg border border-map-line px-2 text-[13px] font-medium hover:bg-map-hover">
      {children}
    </button>
  );
}

export default function CalibratePanel({ map, building, georef, onChange }) {
  const [satellite, setSatellite] = useState(false);
  const [copied, setCopied] = useState(false);
  const mpp = georef.metresPerPixel ?? metresPerPixel(building);

  useEffect(() => {
    if (!map) return;
    const data = planGeoJSON(building, georef, mpp);
    draw(map, data);
    const redraw = () => draw(map, planGeoJSON(building, georef, mpp));
    map.on("style.load", redraw);
    return () => map.off("style.load", redraw);
  }, [map, building, georef, mpp]);

  // Zoom in on the building once, flat, so the plan is easy to line up.
  useEffect(() => {
    if (!map) return;
    map.flyTo({ center: georef.lngLat, zoom: 19.3, pitch: 0, bearing: 0, duration: 800 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, building.name]);

  useEffect(() => () => {
    if (!map?.getStyle()) return;
    for (const id of ["cal-fill", "cal-line", "cal-pts"]) if (map.getLayer(id)) map.removeLayer(id);
    if (map.getSource(SRC)) map.removeSource(SRC);
  }, [map]);

  const nudge = (east, north) => {
    const [lng, lat] = georef.lngLat;
    onChange({ ...georef, lngLat: [lng + east / (111320 * Math.cos((lat * Math.PI) / 180)), lat + north / 111320] });
  };
  const rotate = (d) => onChange({ ...georef, rotation: Math.round(((georef.rotation ?? 0) + d + 360) % 360 * 10) / 10 });
  const scale = (f) => onChange({ ...georef, metresPerPixel: Math.round(mpp * f * 100000) / 100000 });

  const snippet = JSON.stringify(
    { metresPerPixel: mpp, georeference: { anchor: georef.anchor, lngLat: georef.lngLat.map((v) => Math.round(v * 1e7) / 1e7), rotation: georef.rotation ?? 0 } },
    null,
    1
  );
  const size = building.floors[0].layout;
  const widthM = Math.round((size.outline[1][0] - size.outline[0][0]) * mpp);
  const heightM = Math.round((size.outline[2][1] - size.outline[1][1]) * mpp);

  return (
    <div className="absolute top-3 right-3 z-30 w-[300px] rounded-2xl bg-white p-3 text-[13px] shadow-map">
      <div className="font-medium">Calibrate · {shortName(building.name)}</div>
      <p className="mt-1 text-map-muted">Move, turn and resize the Level 1 plan until it sits exactly on the real building. Green dots are the main entrances.</p>
      <div className="mt-2 grid grid-cols-[auto_1fr] items-center gap-x-2 gap-y-1.5">
        <span>Move 1 m</span>
        <div className="flex gap-1">
          <Btn onClick={() => nudge(0, 1)} title="North">↑</Btn>
          <Btn onClick={() => nudge(0, -1)} title="South">↓</Btn>
          <Btn onClick={() => nudge(-1, 0)} title="West">←</Btn>
          <Btn onClick={() => nudge(1, 0)} title="East">→</Btn>
        </div>
        <span>Turn</span>
        <div className="flex gap-1">
          <Btn onClick={() => rotate(-5)}>−5°</Btn>
          <Btn onClick={() => rotate(-0.5)}>−½°</Btn>
          <Btn onClick={() => rotate(0.5)}>+½°</Btn>
          <Btn onClick={() => rotate(5)}>+5°</Btn>
          <Btn onClick={() => rotate(90)}>90°</Btn>
        </div>
        <span>Size</span>
        <div className="flex items-center gap-1">
          <Btn onClick={() => scale(0.98)}>−2%</Btn>
          <Btn onClick={() => scale(1.02)}>+2%</Btn>
          <span className="text-map-muted">
            {widthM} × {heightM} m
          </span>
        </div>
      </div>
      <label className="mt-2 flex items-center gap-2">
        <input
          type="checkbox"
          checked={satellite}
          onChange={(e) => {
            setSatellite(e.target.checked);
            map.setStyle(e.target.checked ? "mapbox://styles/mapbox/standard-satellite" : "mapbox://styles/mapbox/standard");
          }}
        />
        Satellite view
      </label>
      <pre className="mt-2 max-h-32 overflow-auto rounded-lg bg-map-hover p-2 text-[11px] leading-snug">{snippet}</pre>
      <button
        onClick={() => navigator.clipboard?.writeText(snippet.slice(2, -2)).then(() => setCopied(true))}
        className="mt-2 h-8 rounded-full bg-map-blue px-3 text-[13px] font-medium text-white"
      >
        {copied ? "Copied" : "Copy for building.json"}
      </button>
    </div>
  );
}