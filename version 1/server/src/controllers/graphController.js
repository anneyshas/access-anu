import { prisma } from "../config/prisma.js";
import { nodesToFeatureCollection } from "./nodeController.js";
import { edgesToFeatureCollection } from "./edgeController.js";

// GET /api/graph/:building — nodes + edges in one call, both already as
// GeoJSON FeatureCollections. This is the endpoint the frontend uses:
//   const { nodes, edges } = await fetch(...).then(r => r.json());
//   map.addSource('nodes', { type: 'geojson', data: nodes });
//   map.addSource('edges', { type: 'geojson', data: edges });
export async function getGraph(req, res) {
  const { building } = req.params;

  const [nodes, edges] = await Promise.all([
    prisma.node.findMany({ where: { building } }),
    prisma.edge.findMany({
      where: { building },
      include: { fromNode: true, toNode: true },
    }),
  ]);

  if (nodes.length === 0) {
    return res.status(404).json({ error: `No data found for building "${building}"` });
  }

  res.json({
    nodes: nodesToFeatureCollection(nodes),
    edges: edgesToFeatureCollection(edges),
  });
}