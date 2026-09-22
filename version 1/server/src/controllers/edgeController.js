import { prisma } from "../config/prisma.js";

// GET /api/edges?building=...
// Returns a GeoJSON FeatureCollection of LineString features (one per edge,
// drawn between its two connected nodes' real coordinates).
export async function getEdges(req, res) {
  const { building } = req.query;

  if (!building) {
    return res.status(400).json({ error: "building query param is required" });
  }

  const edges = await prisma.edge.findMany({
    where: { building },
    include: { fromNode: true, toNode: true },
  });

  res.json(edgesToFeatureCollection(edges));
}

export function edgesToFeatureCollection(edges) {
  return {
    type: "FeatureCollection",
    features: edges.map((e) => ({
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: [
          [e.fromNode.lng, e.fromNode.lat],
          [e.toNode.lng, e.toNode.lat],
        ],
      },
      properties: {
        id: e.id,
        type: e.type,
        accessible: e.accessible,
        weight: e.weight,
        bidirectional: e.bidirectional,
        fromNodeId: e.fromNodeId,
        toNodeId: e.toNodeId,
      },
    })),
  };
}