import { prisma } from "../config/prisma.js";
import { nodesToPlain } from "./nodeController.js";
import { edgesToPlain } from "./edgeController.js";

// GET /api/graph/:building?floor=1 — nodes + edges in one call, plain JSON
// with pixel coordinates. This is the endpoint the indoor view uses:
//   const { nodes, edges } = await fetch(...).then(r => r.json());
//   // draw each node at (node.x, node.y) on top of the floor plan image
//
// `floor` is optional. Pass it to get just that floor's nodes + the edges
// that connect two nodes on that floor (intra-floor edges). Once
// inter-floor super-edges (stairs/lifts connecting floors) exist, they'll
// need their own handling here since they don't belong to a single floor.
export async function getGraph(req, res) {
  const { building } = req.params;
  const { floor } = req.query;

  const nodeWhere = { building };
  if (floor !== undefined) nodeWhere.floor = Number(floor);

  const nodes = await prisma.node.findMany({ where: nodeWhere });

  if (nodes.length === 0) {
    return res.status(404).json({ error: `No data found for building "${building}"` });
  }

  const nodeIds = new Set(nodes.map((n) => n.id));

  const allEdges = await prisma.edge.findMany({
    where: { building },
    include: { fromNode: true, toNode: true },
  });

  const edges =
    floor === undefined
      ? allEdges
      : allEdges.filter((e) => nodeIds.has(e.fromNodeId) && nodeIds.has(e.toNodeId));

  res.json({
    nodes: nodesToPlain(nodes),
    edges: edgesToPlain(edges),
  });
}