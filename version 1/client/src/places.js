import { compassSide } from "./lib/geo";

// Turns each floor's layout into searchable "places" (rooms, toilets,
// lifts, stairs...) so search and the place card work across every floor.

export const KIND_INFO = {
  room:      { name: "Room",          icon: "room",    badge: "#7e57c2" },
  toilet:    { name: "Toilets",       icon: "toilet",  badge: "#1a73e8" },
  seating:   { name: "Common space",  icon: "seating", badge: "#188038" },
  lift:      { name: "Lift",          icon: "lift",    badge: "#3367d6" },
  stairs:    { name: "Stairs",        icon: "stairs",  badge: "#5f6368" },
  stairwell: { name: "Stairwell",     icon: "stairs",  badge: "#5f6368" },
  shop:      { name: "Shop",          icon: "shop",    badge: "#e37400" },
  entrance:  { name: "Entrance",      icon: "entrance", badge: "#188038" },
};

// Category chips shown under the search box.
export const CATEGORIES = [
  { id: "toilet", label: "Toilets", kinds: ["toilet"] },
  { id: "lift", label: "Lifts", kinds: ["lift"] },
  { id: "stairs", label: "Stairs", kinds: ["stairs", "stairwell"] },
  { id: "seating", label: "Seating", kinds: ["seating"] },
];

export const isClosed = (sp) => sp.accessible === false && !["stairwell", "stairs"].includes(sp.kind);
export const isSelectable = (sp) => Boolean(KIND_INFO[sp.kind]) && !isClosed(sp);

function placeTitle(sp, index) {
  if (sp.kind === "room") return `Room ${sp.label}`;
  if (sp.kind === "lift") return `Lift ${index}`;
  if (sp.kind === "seating") return sp.label ?? "Common space";
  return sp.label ?? KIND_INFO[sp.kind]?.name ?? "Place";
}

// georef (optional): the building's georeference, so entrances get real
// compass names ("North-west entrance") instead of the plan's side.
export function buildPlaces(floors, georef) {
  const places = [];
  for (const f of floors) {
    let lift = 0;
    for (const sp of f.layout?.spaces ?? []) {
      if (!isSelectable(sp)) continue;
      if (sp.kind === "lift") lift += 1;
      const title = placeTitle(sp, lift);
      places.push({
        key: `${f.number}:${sp.id}`,
        spaceId: sp.id,
        nodeId: sp.nodeId,
        floor: f.number,
        floorLabel: f.label ?? `Level ${f.number}`,
        kind: sp.kind,
        title,
        subtitle: `${KIND_INFO[sp.kind].name} · ${f.label ?? `Level ${f.number}`}`,
        stepFree: sp.kind !== "stairs" && sp.kind !== "stairwell",
        search: `${title} ${sp.label ?? ""} ${sp.sublabel ?? ""} ${KIND_INFO[sp.kind].name} ${f.label} level ${f.number}`.toLowerCase(),
      });
    }
    // Main building entrances are places too (a natural starting point).
    for (const en of f.layout?.entrances ?? []) {
      if (en.kind !== "main" || !en.nodeId) continue;
      const side = georef ? compassSide(georef, en.side) : { W: "West", E: "East", N: "North", S: "South" }[en.side] ?? "";
      const title = `${side} entrance`.trim();
      places.push({
        key: `${f.number}:entrance-${en.nodeId}`,
        spaceId: null,
        entranceAt: [en.x, en.y],
        nodeId: en.nodeId,
        floor: f.number,
        floorLabel: f.label ?? `Level ${f.number}`,
        kind: "entrance",
        title,
        subtitle: `Entrance · ${f.label ?? `Level ${f.number}`}`,
        stepFree: true,
        search: `${title} entrance door way in exit ${f.label} level ${f.number}`.toLowerCase(),
      });
    }
  }
  return places;
}

// Where directions start by default: the first main entrance on the lowest floor.
export const defaultStart = (places) =>
  [...places].filter((p) => p.kind === "entrance").sort((a, b) => a.floor - b.floor)[0] ?? null;

// Rough travel time: walking ~1.3 m/s, step-free (wheelchair / pram) ~1.0 m/s.
export const minutes = (metres, stepFree) => Math.max(1, Math.round(metres / (stepFree ? 1.0 : 1.3) / 60));

export function searchPlaces(places, query, category) {
  const cat = CATEGORIES.find((c) => c.id === category);
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return places.filter(
    (p) => (!cat || cat.kinds.includes(p.kind)) && words.every((w) => p.search.includes(w))
  );
}