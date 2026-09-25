// Pathfinding over the building graph ("graph of graphs": each floor's
// nodes/edges plus lift/stair edges between floors). Pure functions, no DB —
// the controller loads the rows and passes them in.

// Small binary min-heap for Dijkstra's priority queue.
class MinHeap {
  constructor() {
    this.items = [];
  }
  get size() {
    return this.items.length;
  }
  push(priority, value) {
    const a = this.items;
    a.push([priority, value]);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p][0] <= a[i][0]) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop() {
    const a = this.items;
    const top = a[0];
    const last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && a[l][0] < a[m][0]) m = l;
        if (r < a.length && a[r][0] < a[m][0]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
}

/**
 * Shortest path with Dijkstra.
 *   accessibleOnly: skip edges marked not accessible (stairs, stairwell fire
 *   doors) and pass only through accessible nodes — Accessibility Mode.
 *   includeEmergency: also use emergency_stairs edges (fire stairwells).
 *   Off by default: fire stairs are for evacuation, not everyday routes.
 * Returns { path: [nodeId...], edges: [edge...], cost (seconds) } or null.
 */
export const EMERGENCY_EDGE = "emergency_stairs";

// Routes are chosen by estimated TIME (seconds), not raw distance, so the
// fastest route can prefer the main stairs for a floor or two and the lift
// for longer trips, like people actually do.
const WALK_SPEED = 1.3; // m/s
const LIFT_BOARD = 15; // s charged getting on and again getting off (~30 s average wait)
const LIFT_PER_FLOOR = 5; // s
const STAIRS_PER_FLOOR = 15; // s per flight
const STAIRS_METRES_PER_FLOOR = 8; // walking length of one flight (for the distance shown)

const isVertical = (a, b) => a && b && a.floor !== b.floor;
function edgeCost(e, a, b) {
  if (isVertical(a, b)) return e.type === "lift" ? LIFT_PER_FLOOR : STAIRS_PER_FLOOR;
  let t = e.weight / WALK_SPEED;
  if ((a?.type === "lift") !== (b?.type === "lift")) t += LIFT_BOARD; // stepping into / out of a lift
  return t;
}

export function shortestPath(nodes, edges, fromId, toId, { accessibleOnly = false, includeEmergency = false } = {}) {
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  if (!nodeById.has(fromId) || !nodeById.has(toId)) return null;

  const adj = new Map();
  const add = (a, b, e) => {
    if (!adj.has(a)) adj.set(a, []);
    adj.get(a).push([b, e]);
  };
  for (const e of edges) {
    if (accessibleOnly && !e.accessible) continue;
    if (!includeEmergency && e.type === EMERGENCY_EDGE) continue;
    add(e.fromNodeId, e.toNodeId, e);
    if (e.bidirectional !== false) add(e.toNodeId, e.fromNodeId, e);
  }

  const dist = new Map([[fromId, 0]]);
  const prev = new Map();
  const heap = new MinHeap();
  heap.push(0, fromId);

  while (heap.size) {
    const [d, u] = heap.pop();
    if (u === toId) break;
    if (d > dist.get(u)) continue;
    for (const [v, e] of adj.get(u) ?? []) {
      const node = nodeById.get(v);
      if (accessibleOnly && v !== toId && node && !node.accessible) continue;
      const nd = d + edgeCost(e, nodeById.get(u), node);
      if (nd < (dist.get(v) ?? Infinity)) {
        dist.set(v, nd);
        prev.set(v, [u, e]);
        heap.push(nd, v);
      }
    }
  }

  if (!dist.has(toId)) return null;
  const path = [toId];
  const used = [];
  while (path[path.length - 1] !== fromId) {
    const [u, e] = prev.get(path[path.length - 1]);
    used.push(e);
    path.push(u);
  }
  path.reverse();
  used.reverse();
  return { path, edges: used, cost: dist.get(toId) };
}

const round = (m) => Math.max(1, Math.round(m));
const floorName = (n) => `Level ${n}`;

/**
 * Turns a path into what the app shows: per-floor legs to draw on the map,
 * and turn-by-turn instructions ("Walk 23 m to Lift 2", "Take Lift 2 up to
 * Level 5", "Arrive at Room 5.04"), plus the real walking distance (metres)
 * and an estimated duration (seconds) at the given walking speed
 * (step-free / wheelchair ~1.0 m/s, walking ~1.3 m/s).
 */
export function describeRoute(nodes, result, { speed = WALK_SPEED } = {}) {
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const pts = result.path.map((id) => {
    const n = nodeById.get(id);
    return { nodeId: n.id, name: n.name, type: n.type, floor: n.floor, x: n.pixelX, y: n.pixelY };
  });

  // Consecutive nodes on the same floor form a leg.
  const legs = [];
  for (const p of pts) {
    const leg = legs[legs.length - 1];
    if (leg && leg.floor === p.floor) leg.points.push(p);
    else legs.push({ floor: p.floor, points: [p] });
  }

  const steps = [];
  const start = pts[0];
  const end = pts[pts.length - 1];
  steps.push({ kind: "start", text: `Start at ${start.name}`, floor: start.floor, nodeId: start.nodeId });

  let walked = 0;
  let i = 0;
  while (i < result.edges.length) {
    const a = pts[i];
    const b = pts[i + 1];
    if (a.floor === b.floor) {
      walked += result.edges[i].weight;
      i += 1;
      continue;
    }
    // A run of floor changes on the same lift / stairwell.
    let j = i;
    while (j + 1 < result.edges.length && pts[j + 1].floor !== pts[j + 2].floor) j += 1;
    const top = pts[j + 1];
    if (walked > 0) {
      steps.push({ kind: "walk", text: `Walk ${round(walked)} m to ${a.name}`, floor: a.floor, nodeId: a.nodeId, distance: round(walked) });
      walked = 0;
    }
    const kind = result.edges[i].type === "lift" ? "lift" : "stairs";
    const dir = top.floor > a.floor ? "up" : "down";
    steps.push({
      kind,
      text: `Take ${a.name} ${dir} to ${floorName(top.floor)}`,
      floor: a.floor,
      toFloor: top.floor,
      nodeId: a.nodeId,
    });
    i = j + 1;
  }
  if (walked > 0) {
    steps.push({ kind: "walk", text: `Walk ${round(walked)} m to ${end.name}`, floor: end.floor, nodeId: end.nodeId, distance: round(walked) });
  }
  steps.push({ kind: "arrive", text: `Arrive at ${end.name}`, floor: end.floor, nodeId: end.nodeId });

  // Floors where you actually walk (not ones a lift/stairwell just passes).
  const walked_floors = legs
    .filter((l, i) => l.points.length > 1 || i === 0 || i === legs.length - 1)
    .map((l) => l.floor);

  // Distance you actually cover, and how long it takes
  let metres = 0;
  let seconds = 0;
  result.edges.forEach((e, k) => {
    const a = nodeById.get(result.path[k]);
    const b = nodeById.get(result.path[k + 1]);
    if (isVertical(a, b)) {
      if (e.type === "lift") seconds += LIFT_PER_FLOOR;
      else {
        seconds += STAIRS_PER_FLOOR;
        metres += STAIRS_METRES_PER_FLOOR;
      }
    } else {
      metres += e.weight;
      seconds += e.weight / speed;
      if ((a?.type === "lift") !== (b?.type === "lift")) seconds += LIFT_BOARD;
    }
  });

  return {
    distance: round(metres),
    duration: Math.round(seconds),
    floors: [...new Set(walked_floors)],
    legs,
    steps,
  };
}