/**
 * Seeds the database with Building 155 (Marie Reay), Level 1.
 *
 * Run locally (needs DATABASE_URL pointed at your Neon DB):
 *   node prisma/seed.js
 *
 * Safe to re-run: clears this building's nodes/edges first, upserts the
 * Building + Floor rows.
 */
import { readFileSync } from "node:fs";
import { prisma } from "../src/config/db.js";

// Vector map of this floor (room shapes, columns, entrances), traced from
// the floor plan image in the same pixel space. Spaces reference nodes by
// the short ids below; main() swaps those for the real database ids.
const LAYOUT = JSON.parse(
  readFileSync(new URL("./layouts/building-155-level-1.json", import.meta.url), "utf8")
);
 
const BUILDING = "Building 155 (Marie Reay Teaching Centre)";
const FLOOR = 1;
const FLOOR_LABEL = "Level 1";
 
// One real-world point for this building, just for the outer map marker.
const BUILDING_LAT = -35.277588;
const BUILDING_LNG = 149.120508;
 
// Floor plan image (client/public/floorplans/...). Straightened crop of the
// Level One evacuation diagram; every pixelX/pixelY below is on THIS image.
const FLOOR_IMAGE = "/floorplans/building-155-level-1.png";
const FLOOR_IMAGE_WIDTH = 1480;
const FLOOR_IMAGE_HEIGHT = 1272;
 
// Rough scale for edge weights: the building is ~1200px wide on the image
// and roughly 42 m across. Weights are computed from pixel distance x this.
// Adjust if you measure the real width.
const METRES_PER_PIXEL = 0.035;
 
// Room numbering: <floor>.<sequence> (1.01, 1.02, ...). Placeholder names —
// swap in the real room numbers when you have them.
const NODES = [
  // Outdoor shops (top row). No door from inside, so no edges: they show on
  // the map but pathfinding never routes into them.
  { id: "SHOP-101", name: "Room 1.01 (Shop)", type: "room", accessible: false, pixelX: 285,  pixelY: 175 },
  { id: "SHOP-102", name: "Room 1.02 (Shop)", type: "room", accessible: false, pixelX: 585,  pixelY: 175 },
  { id: "SHOP-103", name: "Room 1.03 (Shop)", type: "room", accessible: false, pixelX: 875,  pixelY: 175 },
  { id: "SHOP-104", name: "Room 1.04 (Shop)", type: "room", accessible: false, pixelX: 1175, pixelY: 175 },
 
  // Vertical circulation (stairs/lifts connect to other floors later).
  // "Stairs by Lifts" is the open staircase up to Level 2.
  { id: "STAIR-A",  name: "Stairwell A",     type: "stair", accessible: false, pixelX: 210, pixelY: 470 },
  { id: "STAIR-B",  name: "Stairwell B",     type: "stair", accessible: false, pixelX: 1170, pixelY: 955 },
  { id: "STAIRS-L", name: "Stairs by Lifts", type: "stair", accessible: false, pixelX: 720, pixelY: 735 },
 
  // Common space — the tiered seating (looks like stairs on the plan, but
  // it's a sitting area, not a way to Level 2). Reachable on the flat.
  { id: "COMMON", name: "Common Space (Seating)", type: "room", accessible: true, pixelX: 740, pixelY: 470 },
  { id: "LIFT-1",   name: "Lift 1",          type: "lift",  accessible: true,  pixelX: 495, pixelY: 845 },
  { id: "LIFT-2",   name: "Lift 2",          type: "lift",  accessible: true,  pixelX: 613, pixelY: 845 },
  { id: "LIFT-3",   name: "Lift 3",          type: "lift",  accessible: true,  pixelX: 733, pixelY: 845 },
 
  // Amenities
  { id: "WC", name: "Toilets", type: "wc", accessible: true, pixelX: 475, pixelY: 560 },
 
  // Corridors / open floor — the walkable hubs routes pass through.
  // Placed along the green egress arrows on the plan.
  { id: "CORR-W",      name: "West Hall",       type: "corridor", accessible: true, pixelX: 250,  pixelY: 770 },
  { id: "CORR-SW",     name: "South-West Hall", type: "corridor", accessible: true, pixelX: 250,  pixelY: 1065 },
  { id: "CORR-TOILET", name: "Toilet Corridor", type: "corridor", accessible: true, pixelX: 475,  pixelY: 650 },
  { id: "CORR-LIFT",   name: "Lift Lobby",      type: "corridor", accessible: true, pixelX: 613,  pixelY: 960 },
  { id: "CORR-C",      name: "Central Hall",    type: "corridor", accessible: true, pixelX: 890,  pixelY: 645 },
  { id: "CORR-N",      name: "North Hall",      type: "corridor", accessible: true, pixelX: 1020, pixelY: 480 },
  { id: "CORR-E",      name: "East Hall",       type: "corridor", accessible: true, pixelX: 960,  pixelY: 1090 },
 
  // Exits. The two stairwell exits are only reachable through the
  // stairwells, so they're not accessible.
  { id: "EXIT-W",  name: "Final Exit (West)",       type: "service", accessible: true,  pixelX: 140,  pixelY: 722 },
  { id: "EXIT-SE", name: "Final Exit (South-East)", type: "service", accessible: true,  pixelX: 1325, pixelY: 1145 },
  { id: "EXIT-SA", name: "Stairwell A Exit",        type: "service", accessible: false, pixelX: 128,  pixelY: 378 },
  { id: "EXIT-SB", name: "Stairwell B Exit",        type: "service", accessible: false, pixelX: 1340, pixelY: 925 },
];
 
// Connections between the nodes above, by `id`. Weight (metres) is computed
// from pixel distance in main(). accessible: false is what Accessibility
// Mode will filter out.
const EDGES = [
  { fromId: "EXIT-W",      toId: "CORR-W",      type: "door",      accessible: true },
  { fromId: "CORR-W",      toId: "STAIR-A",     type: "fire_door", accessible: false },
  { fromId: "STAIR-A",     toId: "EXIT-SA",     type: "fire_door", accessible: false },
  { fromId: "CORR-W",      toId: "CORR-TOILET", type: "passage",   accessible: true },
  { fromId: "CORR-W",      toId: "CORR-SW",     type: "passage",   accessible: true },
  { fromId: "CORR-SW",     toId: "CORR-LIFT",   type: "passage",   accessible: true },
  { fromId: "CORR-TOILET", toId: "WC",          type: "door",      accessible: true },
  { fromId: "CORR-TOILET", toId: "CORR-C",      type: "passage",   accessible: true },
  { fromId: "CORR-LIFT",   toId: "LIFT-1",      type: "door",      accessible: true },
  { fromId: "CORR-LIFT",   toId: "LIFT-2",      type: "door",      accessible: true },
  { fromId: "CORR-LIFT",   toId: "LIFT-3",      type: "door",      accessible: true },
  { fromId: "CORR-LIFT",   toId: "CORR-E",      type: "passage",   accessible: true },
  { fromId: "CORR-C",      toId: "STAIRS-L",    type: "stairs",    accessible: false },
  { fromId: "CORR-C",      toId: "CORR-N",      type: "passage",   accessible: true },
  { fromId: "CORR-C",      toId: "CORR-E",      type: "passage",   accessible: true },
  { fromId: "CORR-N",      toId: "COMMON",      type: "passage",   accessible: true },
  { fromId: "CORR-E",      toId: "STAIR-B",     type: "fire_door", accessible: false },
  { fromId: "STAIR-B",     toId: "EXIT-SB",     type: "fire_door", accessible: false },
  { fromId: "CORR-E",      toId: "EXIT-SE",     type: "door",      accessible: true },
];
 
function edgeWeight(a, b) {
  const px = Math.hypot(a.pixelX - b.pixelX, a.pixelY - b.pixelY);
  return Math.round(px * METRES_PER_PIXEL * 10) / 10;
}
 
async function main() {
  console.log(`Seeding ${BUILDING}, floor ${FLOOR}...`);
 
  // Clear this building's graph first so re-runs don't duplicate.
  // Edges first (they reference nodes).
  await prisma.edge.deleteMany({ where: { building: BUILDING } });
  await prisma.node.deleteMany({ where: { building: BUILDING } });
  console.log(`  cleared existing rows for ${BUILDING}`);
 
  const building = await prisma.building.upsert({
    where: { name: BUILDING },
    update: { lat: BUILDING_LAT, lng: BUILDING_LNG },
    create: { name: BUILDING, lat: BUILDING_LAT, lng: BUILDING_LNG },
  });
 
  const floorData = {
    label: FLOOR_LABEL,
    imageUrl: FLOOR_IMAGE,
    imageWidth: FLOOR_IMAGE_WIDTH,
    imageHeight: FLOOR_IMAGE_HEIGHT,
  };
  await prisma.floor.upsert({
    where: { buildingId_number: { buildingId: building.id, number: FLOOR } },
    update: floorData,
    create: { buildingId: building.id, number: FLOOR, ...floorData },
  });
  console.log(`  upserted Building + Floor record`);
 
  const byId = Object.fromEntries(NODES.map((n) => [n.id, n]));
  const idMap = {}; // our short id -> Prisma's generated id
 
  for (const n of NODES) {
    const created = await prisma.node.create({
      data: {
        name: n.name,
        type: n.type,
        floor: FLOOR,
        building: BUILDING,
        accessible: n.accessible,
        pixelX: n.pixelX,
        pixelY: n.pixelY,
      },
    });
    idMap[n.id] = created.id;
  }
  console.log(`  created ${NODES.length} nodes`);
 
  for (const e of EDGES) {
    const from = byId[e.fromId];
    const to = byId[e.toId];
    if (!from || !to) throw new Error(`Edge references unknown node: ${e.fromId} -> ${e.toId}`);
 
    await prisma.edge.create({
      data: {
        fromNodeId: idMap[e.fromId],
        toNodeId: idMap[e.toId],
        type: e.type,
        accessible: e.accessible,
        weight: edgeWeight(from, to),
        building: BUILDING,
      },
    });
  }
  console.log(`  created ${EDGES.length} edges`);
 
  // Store the vector map on the floor, with spaces/entrances pointing at the
  // real node ids (so the map can later highlight a route's destination),
  // and each space carrying its node's `accessible` flag so the map can grey
  // out rooms you can't get into.
  const linkNode = ({ node, ...rest }) => {
    if (node && !idMap[node]) throw new Error(`Layout references unknown node: ${node}`);
    return node ? { ...rest, nodeId: idMap[node], accessible: byId[node].accessible } : rest;
  };
  const layout = {
    ...LAYOUT,
    spaces: LAYOUT.spaces.map(linkNode),
    entrances: (LAYOUT.entrances ?? []).map(linkNode),
  };
  await prisma.floor.update({
    where: { buildingId_number: { buildingId: building.id, number: FLOOR } },
    data: { layout },
  });
  console.log(`  stored floor layout (${layout.spaces.length} spaces)`);
 
  console.log("Done.");
}
 
main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
 