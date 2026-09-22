import { prisma } from "../config/prisma.js";

// GET /api/nodes?building=...&floor=...
// Returns a GeoJSON FeatureCollection of Point features — ready to hand
// straight to mapboxgl's addSource({ type: 'geojson', data: ... }).
export async function getNodes(req, res) {
  const { building, floor } = req.query;

  if (!building) {
    return res.status(400).json({ error: "building query param is required" });
  }

  const where = { building };
  if (floor !== undefined) where.floor = Number(floor);

  const nodes = await prisma.node.findMany({ where });

  res.json(nodesToFeatureCollection(nodes));
}

export function nodesToFeatureCollection(nodes) {
  return {
    type: "FeatureCollection",
    features: nodes.map((n) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [n.lng, n.lat] },
      properties: {
        id: n.id,
        name: n.name,
        type: n.type,
        floor: n.floor,
        building: n.building,
        accessible: n.accessible,
      },
    })),
  };
}