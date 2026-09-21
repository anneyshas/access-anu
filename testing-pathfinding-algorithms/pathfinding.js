const isNode = typeof module !== 'undefined' && module.exports;
let nodes = [], edges = [];

// The browser supplies graph data with setGraphData; Node keeps loading graph.json.
if (isNode) {
  const fs = require('fs');
  const graphPath = process.argv[2] || './graph.json';
  ({ nodes, edges } = JSON.parse(fs.readFileSync(graphPath, 'utf8')));
}

// Build adjacency map: nodeId → [{ to, weight, accessible }]
function buildGraph(accessibilityMode, preferLift = false) {
  const graph = {};
  for (const n of nodes) graph[n.id] = [];

  for (const e of edges) {
    if (accessibilityMode && !e.accessible) continue; // skip stairs
    const weight = e.weight + (preferLift && e.type === 'stairs' ? 15 : 0);
    graph[e.from].push({ to: e.to, weight });
    graph[e.to].push(  { to: e.from, weight }); // bidirectional
  }
  return graph;
}

// Node lookup by id
let nodeMap = Object.fromEntries(nodes.map(n => [n.id, n]));

// ─── Heuristic for A* (Euclidean distance) ────────────────────
function heuristic(aId, bId) {
  const a = nodeMap[aId], b = nodeMap[bId];
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

// ─── Min-heap (priority queue) ────────────────────────────────
class MinHeap {
  constructor() { this.heap = []; }
  push(item) {
    this.heap.push(item);
    this._bubbleUp(this.heap.length - 1);
  }
  pop() {
    const top = this.heap[0];
    const last = this.heap.pop();
    if (this.heap.length > 0) { this.heap[0] = last; this._sinkDown(0); }
    return top;
  }
  get size() { return this.heap.length; }
  _bubbleUp(i) {
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.heap[p].f <= this.heap[i].f) break;
      [this.heap[p], this.heap[i]] = [this.heap[i], this.heap[p]];
      i = p;
    }
  }
  _sinkDown(i) {
    const n = this.heap.length;
    while (true) {
      let smallest = i, l = 2*i+1, r = 2*i+2;
      if (l < n && this.heap[l].f < this.heap[smallest].f) smallest = l;
      if (r < n && this.heap[r].f < this.heap[smallest].f) smallest = r;
      if (smallest === i) break;
      [this.heap[smallest], this.heap[i]] = [this.heap[i], this.heap[smallest]];
      i = smallest;
    }
  }
}

// ─── Dijkstra ─────────────────────────────────────────────────
function dijkstra(graph, startId, goalId, onVisit) {
  const dist = {}, prev = {}, explored = new Set();
  for (const id in graph) dist[id] = Infinity;
  dist[startId] = 0;

  const pq = new MinHeap();
  pq.push({ f: 0, id: startId });

  while (pq.size > 0) {
    const { id } = pq.pop();
    if (explored.has(id)) continue;
    explored.add(id);
    if (onVisit) onVisit({ type: 'explore', id, distance: dist[id] });
    if (id === goalId) break;

    for (const { to, weight } of graph[id]) {
      const d = dist[id] + weight;
      if (d < dist[to]) {
        dist[to] = d;
        prev[to] = id;
        if (onVisit) onVisit({ type: 'relax', from: id, to, distance: d });
        pq.push({ f: d, id: to });
      }
    }
  }

  return { path: buildPath(prev, startId, goalId), cost: dist[goalId], nodesExplored: explored.size };
}

// ─── A* ───────────────────────────────────────────────────────
function aStar(graph, startId, goalId, onVisit) {
  const g = {}, prev = {}, explored = new Set();
  for (const id in graph) g[id] = Infinity;
  g[startId] = 0;

  const pq = new MinHeap();
  pq.push({ f: heuristic(startId, goalId), id: startId });

  while (pq.size > 0) {
    const { id } = pq.pop();
    if (explored.has(id)) continue;
    explored.add(id);
    if (onVisit) onVisit({ type: 'explore', id, distance: g[id] });
    if (id === goalId) break;

    for (const { to, weight } of graph[id]) {
      const tentative = g[id] + weight;
      if (tentative < g[to]) {
        g[to] = tentative;
        prev[to] = id;
        if (onVisit) onVisit({ type: 'relax', from: id, to, distance: tentative });
        pq.push({ f: tentative + heuristic(to, goalId), id: to });
      }
    }
  }

  return { path: buildPath(prev, startId, goalId), cost: g[goalId], nodesExplored: explored.size };
}

// ─── Reconstruct path ─────────────────────────────────────────
function buildPath(prev, start, goal) {
  const path = [];
  let cur = goal;
  while (cur && cur !== start) { path.unshift(cur); cur = prev[cur]; }
  if (cur === start) path.unshift(start);
  return path.length > 1 ? path : [];
}

if (isNode) {
// ─── Run tests ────────────────────────────────────────────────
const tests = [
  { from: 'R101', to: 'R103' },
  { from: 'R101', to: 'R204' },  // cross-floor via lift or stairs
  { from: 'R102', to: 'R201' },
];

for (const mode of [false, true]) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  MODE: ${mode ? '♿ Accessibility ON (no stairs)' : '🚶 Normal (all routes)'}`);
  console.log(`${'═'.repeat(60)}`);

  const graph = buildGraph(mode);

  for (const { from, to } of tests) {
    console.log(`\n  Route: ${from} → ${to}`);

    const t1 = performance.now();
    const d = dijkstra(graph, from, to);
    const t1end = performance.now();

    const t2 = performance.now();
    const a = aStar(graph, from, to);
    const t2end = performance.now();

    console.table({
      Dijkstra: {
        'Path':           d.path.join(' → ') || 'No path',
        'Cost (m)':       d.cost === Infinity ? '∞' : d.cost,
        'Nodes explored': d.nodesExplored,
        'Time (ms)':      (t1end - t1).toFixed(4),
      },
      'A*': {
        'Path':           a.path.join(' → ') || 'No path',
        'Cost (m)':       a.cost === Infinity ? '∞' : a.cost,
        'Nodes explored': a.nodesExplored,
        'Time (ms)':      (t2end - t2).toFixed(4),
      },
    });
  }
}

module.exports = { buildGraph, dijkstra, aStar, setGraphData: (data) => {
  nodes = data.nodes;
  edges = data.edges;
  nodeMap = Object.fromEntries(nodes.map(n => [n.id, n]));
}, getNodes: () => nodes, getEdges: () => edges };
} else {
  globalThis.Pathfinding = { buildGraph, dijkstra, aStar, setGraphData: (data) => {
    nodes = data.nodes;
    edges = data.edges;
    nodeMap = Object.fromEntries(nodes.map(n => [n.id, n]));
  }, getNodes: () => nodes, getEdges: () => edges };
}