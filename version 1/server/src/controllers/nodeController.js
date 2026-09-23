import { prisma } from "../config/prisma.js";

// GET /api/nodes?building=...&floor=...
// Returns plain JSON — nodes are positioned in pixels on a floor plan image,
// not real-world coordinates, so GeoJSON doesn't fit here anymore. The
// frontend draws these directly at { x, y } on top of the floor plan image.
export async function getNodes(req, res) {
  const { building, floor } = req.query;

  if (!building) {
    return res.status(400).json({ error: "building query param is required" });
  }

  const where = { building };
  if (floor !== undefined) where.floor = Number(floor);

  const nodes = await prisma.node.findMany({ where });

  res.json(nodesToPlain(nodes));
}

export function nodesToPlain(nodes) {
  return nodes.map((n) => ({
    id: n.id,
    name: n.name,
    type: n.type,
    floor: n.floor,
    building: n.building,
    accessible: n.accessible,
    x: n.pixelX,
    y: n.pixelY,
  }));
}