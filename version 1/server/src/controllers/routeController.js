import { prisma } from "../config/prisma.js";
import { shortestPath, describeRoute } from "../services/pathfinding.js";

// GET /api/route?from=<nodeId>&to=<nodeId>&accessible=true|false
// Shortest route between two nodes anywhere in the same building (across
// floors via lifts/stairs). accessible=true is Accessibility Mode: no stairs.
export async function getRoute(req, res) {
  const { from, to } = req.query;
  const accessibleOnly = req.query.accessible === "true" || req.query.accessible === "1";

  if (!from || !to) {
    return res.status(400).json({ error: "from and to query params are required (node ids)" });
  }

  const [start, end] = await Promise.all([
    prisma.node.findUnique({ where: { id: from } }),
    prisma.node.findUnique({ where: { id: to } }),
  ]);
  if (!start || !end) return res.status(404).json({ error: "Start or destination not found" });
  if (start.building !== end.building) {
    return res.status(400).json({ error: "Routes between different buildings aren't supported yet" });
  }

  const [nodes, edges] = await Promise.all([
    prisma.node.findMany({ where: { building: start.building } }),
    prisma.edge.findMany({ where: { building: start.building } }),
  ]);

  const result = shortestPath(nodes, edges, from, to, { accessibleOnly });
  if (!result) {
    return res.status(404).json({
      error: accessibleOnly ? "No step-free route to this place" : "No route found",
      accessible: accessibleOnly,
    });
  }

  res.json({ from, to, accessible: accessibleOnly, ...describeRoute(nodes, result, { speed: accessibleOnly ? 1.0 : 1.3 }) });
}