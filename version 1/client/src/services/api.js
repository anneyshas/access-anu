const API_BASE = import.meta.env.VITE_API_BASE_URL;

// GET /api/buildings — every building with a real-world center point (for
// the outer campus map marker) and its floors (image + dimensions).
export async function fetchBuildings() {
  const res = await fetch(`${API_BASE}/buildings`);
  if (!res.ok) throw new Error(`Failed to fetch buildings: ${res.status}`);
  return res.json();
}

// GET /api/graph/:building?floor=1 — that floor's nodes + edges, positioned
// in pixels on the floor plan image. Omit `floor` to get every floor's data
// for that building at once.
export async function fetchGraph(building, floor) {
  const url = new URL(`${API_BASE}/graph/${encodeURIComponent(building)}`);
  if (floor !== undefined) url.searchParams.set("floor", floor);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch graph: ${res.status}`);
  return res.json();
}