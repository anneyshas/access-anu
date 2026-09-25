// Small geometry helpers for outdoor navigation, plus the conversion between
// floor-plan pixels and real lat/lng (the building's "georeference").

const M_PER_DEG_LAT = 111320;
const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;

// ---- pixel <-> lat/lng --------------------------------------------------
// georef = { anchor: [x, y], lngLat: [lng, lat], rotation }  (rotation = the
// compass bearing, in degrees, that the plan's "up" points to).

export function pixelToLngLat(georef, mpp, x, y) {
  const [ax, ay] = georef.anchor;
  const [lng0, lat0] = georef.lngLat;
  const right = (x - ax) * mpp; // metres towards the plan's right
  const up = (ay - y) * mpp; // metres towards the plan's top
  const t = rad(georef.rotation ?? 0);
  const east = up * Math.sin(t) + right * Math.cos(t);
  const north = up * Math.cos(t) - right * Math.sin(t);
  return [lng0 + east / (M_PER_DEG_LAT * Math.cos(rad(lat0))), lat0 + north / M_PER_DEG_LAT];
}

export function lngLatToPixel(georef, mpp, [lng, lat]) {
  const [ax, ay] = georef.anchor;
  const [lng0, lat0] = georef.lngLat;
  const east = (lng - lng0) * M_PER_DEG_LAT * Math.cos(rad(lat0));
  const north = (lat - lat0) * M_PER_DEG_LAT;
  const t = rad(georef.rotation ?? 0);
  const up = east * Math.sin(t) + north * Math.cos(t);
  const right = east * Math.cos(t) - north * Math.sin(t);
  return [ax + right / mpp, ay - up / mpp];
}

// Compass name for a plan side ("W" on the plan -> real direction once rotated).
export function compassSide(georef, side) {
  const planBearing = { N: 0, E: 90, S: 180, W: 270 }[side];
  if (planBearing === undefined) return "";
  const b = (planBearing + (georef?.rotation ?? 0) + 360) % 360;
  return ["North", "North-east", "East", "South-east", "South", "South-west", "West", "North-west"][Math.round(b / 45) % 8];
}

// ---- distances on the ground ---------------------------------------------

// Metres between two [lng, lat] points (fine at campus scale).
export function distance(a, b) {
  const dy = (b[1] - a[1]) * M_PER_DEG_LAT;
  const dx = (b[0] - a[0]) * M_PER_DEG_LAT * Math.cos(rad((a[1] + b[1]) / 2));
  return Math.hypot(dx, dy);
}

export function bearing(a, b) {
  const dy = b[1] - a[1];
  const dx = (b[0] - a[0]) * Math.cos(rad((a[1] + b[1]) / 2));
  return (deg(Math.atan2(dx, dy)) + 360) % 360;
}

// Cumulative distance along a line, one entry per vertex.
export function cumulative(line) {
  const out = [0];
  for (let i = 1; i < line.length; i++) out.push(out[i - 1] + distance(line[i - 1], line[i]));
  return out;
}

// Closest point on a line to `p`: { point, along (m from start), offset (m away), segment }.
export function snapToLine(line, cum, p) {
  let best = { point: line[0], along: 0, offset: Infinity, segment: 0 };
  const k = Math.cos(rad(p[1])) * M_PER_DEG_LAT;
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i];
    const b = line[i + 1];
    // Work in local metres around `a`.
    const bx = (b[0] - a[0]) * k;
    const by = (b[1] - a[1]) * M_PER_DEG_LAT;
    const px = (p[0] - a[0]) * k;
    const py = (p[1] - a[1]) * M_PER_DEG_LAT;
    const len2 = bx * bx + by * by;
    const t = len2 ? Math.max(0, Math.min(1, (px * bx + py * by) / len2)) : 0;
    const offset = Math.hypot(px - t * bx, py - t * by);
    if (offset < best.offset) {
      best = {
        point: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t],
        along: cum[i] + Math.sqrt(len2) * t,
        offset,
        segment: i,
      };
    }
  }
  return best;
}

// The point `d` metres along a line (used by the demo walk simulation).
export function pointAlong(line, cum, d) {
  if (d <= 0) return line[0];
  for (let i = 1; i < line.length; i++) {
    if (cum[i] >= d) {
      const t = (d - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
      return [line[i - 1][0] + (line[i][0] - line[i - 1][0]) * t, line[i - 1][1] + (line[i][1] - line[i - 1][1]) * t];
    }
  }
  return line[line.length - 1];
}

export const formatDistance = (m) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.max(0, Math.round(m / 5) * 5)} m`);
export const formatMinutes = (s) => `${Math.max(1, Math.round(s / 60))} min`;