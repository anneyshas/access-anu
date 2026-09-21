const fs = require('fs');

const outputPath = process.argv[2] || 'building-demo.stl';
const floorHeight = 4;

// Each floor is a double-loaded corridor: a spine of walkable waypoints with
// rooms opening off both sides, a lift, and a staircase at each end — the
// layout real indoor-nav pathfinding has to deal with (multiple routes,
// vertical circulation choices), not just a single room-to-corridor star.
const CORRIDOR_X = [6, 14, 22, 30, 38, 46]; // 6 waypoints, 8m apart

function buildFloor(floor, z) {
  const base = floor * 100; // floor 1 -> rooms 101-110, floor 2 -> rooms 201-210
  const regions = [];

  // Corridor spine
  CORRIDOR_X.forEach((x, i) => {
    regions.push({ name: `Corridor_F${floor}_${i + 1}`, x: x - 3, y: 14, z, width: 6, depth: 3 });
  });

  // North rooms: one above every corridor waypoint
  CORRIDOR_X.forEach((x, i) => {
    regions.push({ name: `Room_${base + i + 1}`, x: x - 3, y: 2, z, width: 6, depth: 5 });
  });

  // South rooms: below the first four waypoints only (leaves room for the
  // near-end lift/stair lobby without crowding the layout)
  CORRIDOR_X.slice(0, 4).forEach((x, i) => {
    regions.push({ name: `Room_${base + 7 + i}`, x: x - 3, y: 25, z, width: 6, depth: 5 });
  });

  // Vertical circulation: lift + stair near the near end, second stair at the far end
  regions.push({ name: `Lift_F${floor}`, x: 0, y: 8, z, width: 4, depth: 3 });
  regions.push({ name: `Stairs_1_F${floor}`, x: 0, y: 21, z, width: 4, depth: 3 });
  regions.push({ name: `Stairs_2_F${floor}`, x: 53, y: 14, z, width: 4, depth: 3 });

  return regions;
}

const regions = [...buildFloor(1, 0), ...buildFloor(2, floorHeight)];

function triangle(a, b, c) {
  const normal = [0, 0, 1];
  return `  facet normal ${normal.join(' ')}\n    outer loop\n      vertex ${a.join(' ')}\n      vertex ${b.join(' ')}\n      vertex ${c.join(' ')}\n    endloop\n  endfacet\n`;
}

function box(region) {
  const x = region.x, y = region.y, z = region.z;
  const X = x + region.width, Y = y + region.depth, Z = z + 2.5;
  const v = [
    [x, y, z], [X, y, z], [X, Y, z], [x, Y, z],
    [x, y, Z], [X, y, Z], [X, Y, Z], [x, Y, Z],
  ];
  const faces = [[0, 2, 1, 3], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]];
  return `solid ${region.name}\n${faces.map(([a, b, c, d]) => triangle(v[a], v[b], v[c]) + triangle(v[a], v[c], v[d])).join('')}endsolid ${region.name}\n`;
}

const stl = regions.map(box).join('');
fs.writeFileSync(outputPath, stl);
console.log(`Generated ${outputPath} with ${regions.length} named scan regions across 2 floors.`);
