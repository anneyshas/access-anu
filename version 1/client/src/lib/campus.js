// Campus-level helpers: search every room in every building from the outdoor
// map, and find a building's entrances in real-world coordinates.
import { buildPlaces } from "../places";
import { compassSide, pixelToLngLat } from "./geo";

export const shortName = (name) => name.match(/\((.*)\)/)?.[1] ?? name;
export const buildingCode = (name) => name.replace(/\s*\(.*\)$/, "");

export const metresPerPixel = (b) => b.floors.find((f) => f.layout?.metresPerPixel)?.layout.metresPerPixel;

// Main entrances of a building with their lat/lng.
// An entrance can have an exact position (building.json "entranceCoordinates",
// set with the ?calibrate=1 tool); otherwise it's worked out from the plan with
// the building's georeference.
// (georef.metresPerPixel, when set by the calibration tool, overrides the floors' scale.)
export function entrancesFor(b, georef = b.georeference) {
  const mpp = georef?.metresPerPixel ?? metresPerPixel(b);
  const out = [];
  for (const f of b.floors) {
    for (const en of f.layout?.entrances ?? []) {
      if (en.kind !== "main" || !en.nodeId) continue;
      // Exact position: set live in the calibrate tool, else saved in building.json,
      // else worked out from the floor plan.
      const override = en.ref ? georef?.entranceCoordinates?.[en.ref] : undefined;
      const lngLat = override === null ? null : override ?? en.lngLat ?? null; // null = cleared in the tool
      const finalLngLat = lngLat ?? (georef && mpp ? pixelToLngLat(georef, mpp, en.x, en.y) : null);
      if (!finalLngLat) continue;
      const side = georef ? compassSide(georef, en.side) : { W: "West", E: "East", N: "North", S: "South" }[en.side];
      out.push({
        nodeId: en.nodeId,
        ref: en.ref,
        floor: f.number,
        name: side ? `${side} entrance` : en.label ?? "Entrance",
        lngLat: finalLngLat,
        exact: Boolean(lngLat),
      });
    }
  }
  return out;
}

// One searchable list for the campus search bar: buildings + every place
// inside them ("5.01" finds Room 5.01 in Marie Reay).
export function campusPlaces(buildings) {
  const out = [];
  for (const b of buildings) {
    const name = shortName(b.name);
    out.push({
      key: `b:${b.name}`,
      type: "building",
      building: b,
      title: name,
      subtitle: `${buildingCode(b.name)} · ${b.floors.length} ${b.floors.length === 1 ? "floor" : "floors"}`,
      search: `${b.name} ${name}`.toLowerCase(),
    });
    for (const p of buildPlaces(b.floors, b.georeference)) {
      if (p.kind === "entrance") continue;
      out.push({
        ...p,
        key: `p:${b.name}:${p.key}`,
        placeKey: p.key,
        type: "place",
        building: b,
        subtitle: `${p.floorLabel} · ${name}`,
        search: `${p.search} ${b.name} ${name}`.toLowerCase(),
      });
    }
  }
  return out;
}

// Rooms rank above other places, buildings first when the name matches.
export function searchCampus(items, query, limit = 8) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return items.filter((i) => i.type === "building").slice(0, limit);
  const rank = (i) => (i.type === "building" ? 0 : i.kind === "room" ? 1 : 2);
  return items
    .filter((i) => words.every((w) => i.search.includes(w)))
    .sort((a, b) => rank(a) - rank(b))
    .slice(0, limit);
}