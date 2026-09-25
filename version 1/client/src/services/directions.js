// Outdoor walking directions from the Mapbox Directions API.
// Docs: https://docs.mapbox.com/api/navigation/directions/

const BASE = "https://api.mapbox.com/directions/v5/mapbox/walking";

// from/to are [lng, lat]. Resolves to
// { line: [[lng, lat]...], distance (m), duration (s), steps: [...] }
export async function fetchWalkingRoute(from, to, { signal } = {}) {
  const coords = `${from[0]},${from[1]};${to[0]},${to[1]}`;
  const url = new URL(`${BASE}/${coords}`);
  url.searchParams.set("geometries", "geojson");
  url.searchParams.set("overview", "full");
  url.searchParams.set("steps", "true");
  url.searchParams.set("access_token", import.meta.env.VITE_MAPBOX_TOKEN);

  const res = await fetch(url, { signal });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.code !== "Ok" || !body.routes?.length) {
    throw new Error(body.message || "Couldn't find a walking route");
  }
  const r = body.routes[0];
  return {
    line: r.geometry.coordinates,
    distance: r.distance,
    duration: r.duration,
    steps: r.legs.flatMap((leg) =>
      leg.steps.map((s) => ({
        text: s.maneuver.instruction,
        type: s.maneuver.type, // depart, turn, arrive, ...
        modifier: s.maneuver.modifier, // left, right, straight, ...
        location: s.maneuver.location,
        distance: s.distance,
      }))
    ),
  };
}