/**
 * Seeds the database with Building 155, Level 1 — from the evacuation plan.
 *
 * Run locally (needs DATABASE_URL pointed at your Neon DB):
 *   node prisma/seed.js
 *
 * To add another floor/building: run scripts/geo-interpolate.js with new
 * corners + landmarks, paste the output into a new NODES/EDGES block below
 * (or a separate seed file), and re-run.
 */
import "dotenv/config";
import { prisma } from "../src/config/db.js";

const BUILDING = "Building 155 (Marie Reay Teaching Centre)";
const FLOOR = 1;

// One entry per landmark on this floor, from the Building 155 evacuation plan.
// `id` is a short human-readable code you invent — used to wire up edges below.
// No named rooms yet (the evacuation plan doesn't label individual rooms) —
// add rooms here once you have a room-numbered floor plan for this level.
const NODES = [
  { id: "B155-CORR",   name: "Corridor",        type: "corridor", accessible: true,  lat: -35.277516, lng: 149.120544 },
  { id: "B155-STAIR-A", name: "Stairwell A",     type: "stair",    accessible: false, lat: -35.277543, lng: 149.120510 },
  { id: "B155-STAIR-B", name: "Stairwell B",     type: "stair",    accessible: false, lat: -35.277634, lng: 149.120458 },
  { id: "B155-LIFT-1", name: "Lift 1",           type: "lift",     accessible: true,  lat: -35.277643, lng: 149.120499 },
  { id: "B155-LIFT-2", name: "Lift 2",           type: "lift",     accessible: true,  lat: -35.277640, lng: 149.120492 },
  { id: "B155-LIFT-3", name: "Lift 3",           type: "lift",     accessible: true,  lat: -35.277638, lng: 149.120486 },
  { id: "B155-EXIT-W", name: "Final Exit (West)", type: "service", accessible: true,  lat: -35.277620, lng: 149.120514 },
  { id: "B155-EXIT-S", name: "Final Exit (South)", type: "service", accessible: true, lat: -35.277664, lng: 149.120393 },
];

// Connections between the nodes above, by their `id`.
// accessible: false on a stairs edge is what Accessibility Mode filters out.
const EDGES = [
  { fromId: "B155-CORR",    toId: "B155-STAIR-A", type: "stairs",  accessible: false, weight: 12 },
  { fromId: "B155-CORR",    toId: "B155-STAIR-B", type: "stairs",  accessible: false, weight: 15 },
  { fromId: "B155-CORR",    toId: "B155-LIFT-1",  type: "lift",    accessible: true,  weight: 10 },
  { fromId: "B155-LIFT-1",  toId: "B155-LIFT-2",  type: "passage", accessible: true,  weight: 2 },
  { fromId: "B155-LIFT-2",  toId: "B155-LIFT-3",  type: "passage", accessible: true,  weight: 2 },
  { fromId: "B155-CORR",    toId: "B155-EXIT-W",  type: "door",    accessible: true,  weight: 14 },
  { fromId: "B155-STAIR-B", toId: "B155-EXIT-S",  type: "door",    accessible: true,  weight: 8 },
];

async function main() {
  console.log(`Seeding ${BUILDING}, floor ${FLOOR}...`);

  // Nodes first (edges reference them)
  const idMap = {}; // our short id -> Prisma's generated id
  for (const n of NODES) {
    const created = await prisma.node.create({
      data: {
        name: n.name,
        type: n.type,
        floor: FLOOR,
        building: BUILDING,
        accessible: n.accessible,
        lat: n.lat,
        lng: n.lng,
      },
    });
    idMap[n.id] = created.id;
    console.log(`  node: ${n.name}`);
  }

  for (const e of EDGES) {
    await prisma.edge.create({
      data: {
        fromNodeId: idMap[e.fromId],
        toNodeId: idMap[e.toId],
        type: e.type,
        accessible: e.accessible,
        weight: e.weight,
        building: BUILDING,
      },
    });
    console.log(`  edge: ${e.fromId} -> ${e.toId}`);
  }

  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
