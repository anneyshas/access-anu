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

export function buildPlaces(floors) {
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
        floor: f.number,
        floorLabel: f.label ?? `Level ${f.number}`,
        kind: sp.kind,
        title,
        subtitle: `${KIND_INFO[sp.kind].name} · ${f.label ?? `Level ${f.number}`}`,
        stepFree: sp.kind !== "stairs" && sp.kind !== "stairwell",
        search: `${title} ${sp.label ?? ""} ${sp.sublabel ?? ""} ${KIND_INFO[sp.kind].name} ${f.label} level ${f.number}`.toLowerCase(),
      });
    }
  }
  return places;
}

export function searchPlaces(places, query, category) {
  const cat = CATEGORIES.find((c) => c.id === category);
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return places.filter(
    (p) => (!cat || cat.kinds.includes(p.kind)) && words.every((w) => p.search.includes(w))
  );
}