import { prisma } from "../config/prisma.js";

// GET /api/edges?building=...
// Returns plain JSON — one entry per edge, with each end's pixel position
// resolved (via fromNode/toNode) so the frontend can draw a line between
// them directly on top of the floor plan image without a second lookup.
export async function getEdges(req, res) {
  const { building } = req.query;

  if (!building) {
    return res.status(400).json({ error: "building query param is required" });
  }

  const edges = await prisma.edge.findMany({
    where: { building },
    include: { fromNode: true, toNode: true },
  });

  res.json(edgesToPlain(edges));
}

export function edgesToPlain(edges) {
  return edges.map((e) => ({
    id: e.id,
    type: e.type,
    accessible: e.accessible,
    weight: e.weight,
    bidirectional: e.bidirectional,
    fromNodeId: e.fromNodeId,
    toNodeId: e.toNodeId,
    from: { x: e.fromNode.pixelX, y: e.fromNode.pixelY },
    to: { x: e.toNode.pixelX, y: e.toNode.pixelY },
  }));
}