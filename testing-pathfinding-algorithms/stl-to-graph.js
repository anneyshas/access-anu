const fs = require('fs');

const inputPath = process.argv[2] || 'building-demo.stl';
const outputPath = process.argv[3] || 'graph-from-stl.json';
const stl = fs.readFileSync(inputPath, 'utf8');
const regionPattern = /solid\s+([^\r\n]+)([\s\S]*?)endsolid\s+[^\r\n]+/gi;
const vertexPattern = /vertex\s+([\d.eE+-]+)\s+([\d.eE+-]+)\s+([\d.eE+-]+)/g;
const namePattern = /^(Room|Corridor|Lift|Stairs?)_/;
const nodes = [];

for (const match of stl.matchAll(regionPattern)) {
  const name = match[1].trim();
  if (!namePattern.test(name)) continue; // ignore any non-navigable scan geometry (walls, shell, etc.)
  const vertices = [...match[2].matchAll(vertexPattern)].map(vertex => vertex.slice(1).map(Number));
  if (!vertices.length) continue;
  const sums = vertices.reduce((total, vertex) => total.map((value, index) => value + vertex[index]), [0, 0, 0]);
  const [x, y, z] = sums.map(value => value / vertices.length);
  const id = name
    .replace(/^Room_/, 'R')
    .replace(/^Corridor_/, 'CORR-')
    .replace(/^Lift_/, 'LIFT-')
    .replace(/^Stairs?_/, 'STAIRS-')
    .replace(/_/g, '-');
  const floor = Math.round(z / 4) + 1;
  const type = id.startsWith('R') ? 'room' : id.startsWith('CORR') ? 'corridor' : id.startsWith('LIFT') ? 'lift' : 'stair';
  nodes.push({ id, name: name.replace(/_/g, ' '), x: Number(x.toFixed(2)), y: Number(y.toFixed(2)), z: Number(z.toFixed(2)), floor, type });
}

function distance(a, b) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);
}

function addEdge(edges, from, to, type, accessible = true) {
  const weight = Number(distance(from, to).toFixed(2));
  edges.push({ from: from.id, to: to.id, weight, accessible, type });
}

function nearest(node, candidates) {
  return candidates.reduce((best, candidate) => (distance(node, candidate) < distance(node, best) ? candidate : best));
}

const edges = [];
for (const floor of [...new Set(nodes.map(node => node.floor))]) {
  const floorNodes = nodes.filter(node => node.floor === floor);
  const corridor = floorNodes.filter(node => node.type === 'corridor').sort((a, b) => a.x - b.x);
  const rooms = floorNodes.filter(node => node.type === 'room');
  const verticals = floorNodes.filter(node => node.type === 'lift' || node.type === 'stair');

  // Corridor spine: consecutive waypoints are walkable
  for (let i = 1; i < corridor.length; i++) addEdge(edges, corridor[i - 1], corridor[i], 'corridor');

  // Every room and every lift/stair door opens onto its nearest corridor waypoint
  for (const room of rooms) addEdge(edges, room, nearest(room, corridor), 'door');
  for (const vertical of verticals) {
    addEdge(edges, vertical, nearest(vertical, corridor), vertical.type === 'lift' ? 'lift' : 'stairs', vertical.type === 'lift');
  }
}

// Vertical shafts: link matching lift/stair nodes across floors (grouped by
// id with the per-floor suffix stripped, e.g. STAIRS-1-F1 + STAIRS-1-F2)
const shaftGroups = {};
for (const node of nodes) {
  if (node.type !== 'lift' && node.type !== 'stair') continue;
  const shaft = node.id.replace(/-F\d+$/, '');
  shaftGroups[shaft] = shaftGroups[shaft] || [];
  shaftGroups[shaft].push(node);
}
for (const group of Object.values(shaftGroups)) {
  group.sort((a, b) => a.floor - b.floor);
  for (let i = 1; i < group.length; i++) addEdge(edges, group[i - 1], group[i], group[i].type, group[i].type === 'lift');
}

fs.writeFileSync(outputPath, JSON.stringify({ source: inputPath, nodes, edges }, null, 2) + '\n');
console.log(`Parsed ${inputPath}: ${nodes.length} nodes, ${edges.length} edges -> ${outputPath}`);
