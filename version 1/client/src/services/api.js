// Full URL (http://localhost:5000/api) or a path ("/api", proxied by Vite —
// needed when testing on a phone over HTTPS).
const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";
const apiUrl = (path) => new URL(`${API_BASE}${path}`, window.location.origin);

// GET /api/buildings — every building with a real-world center point (for
// the outer campus map marker) and its floors (image + dimensions).
export async function fetchBuildings() {
  const res = await fetch(apiUrl("/buildings"));
  if (!res.ok) throw new Error(`Failed to fetch buildings: ${res.status}`);
  return res.json();
}

// GET /api/graph/:building?floor=1 — that floor's nodes + edges, positioned
// in pixels on the floor plan image. Omit `floor` to get every floor's data
// for that building at once.
export async function fetchGraph(building, floor) {
  const url = apiUrl(`/graph/${encodeURIComponent(building)}`);
  if (floor !== undefined) url.searchParams.set("floor", floor);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch graph: ${res.status}`);
  return res.json();
}

// GET /api/route?from=&to=&accessible= — shortest route between two nodes
// (across floors). accessible=true avoids all stairs. Resolves to the route,
// or to { error } when there's no route (e.g. no step-free way there).
export async function fetchRoute(from, to, accessible) {
  const url = apiUrl("/route");
  url.searchParams.set("from", from);
  url.searchParams.set("to", to);
  url.searchParams.set("accessible", accessible ? "true" : "false");
  const res = await fetch(url);
  const body = await res.json().catch(() => ({}));
  if (res.status === 404) return { error: body.error ?? "No route found" };
  if (!res.ok) throw new Error(body.error ?? `Failed to fetch route: ${res.status}`);
  return body;
}