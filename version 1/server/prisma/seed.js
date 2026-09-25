/**
 * Seeds the database with Building 155 (Marie Reay), Level 1.
 *
 * Run locally (needs DATABASE_URL pointed at your Neon DB):
 *   node prisma/seed.js
 *
 * Safe to re-run: clears this building's nodes/edges first, upserts the
 * Building + Floor rows.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { prisma } from "../src/config/db.js";

// Vector map of this floor (room shapes, columns, entrances), traced from
// the floor plan image in the same pixel space. Spaces reference nodes by
// the short ids below; main() swaps those for the real database ids.
const DATA_DIR = new URL("./layouts/", import.meta.url);
const readJson = (url) => JSON.parse(readFileSync(url, "utf8"));
 
async function seedBuilding(dirName) {
  const dir = new URL(`${dirName}/`, DATA_DIR);
  const b = readJson(new URL("building.json", dir));
  const floors = b.floors.map((f) => readJson(new URL(f, dir)));
  const mpp = b.metresPerPixel;
 
  console.log(`Seeding ${b.name} (${floors.length} floors)...`);
 
  // Clear this building's graph first (edges reference nodes).
  await prisma.edge.deleteMany({ where: { building: b.name } });
  await prisma.node.deleteMany({ where: { building: b.name } });
 
  const building = await prisma.building.upsert({
    where: { name: b.name },
    update: { lat: b.lat, lng: b.lng, georeference: b.georeference ?? undefined },
    create: { name: b.name, lat: b.lat, lng: b.lng, georeference: b.georeference ?? undefined },
  });
 
  const idMap = {}; // "<floor>:<short id>" -> database id
  const nodeByKey = {}; // "<floor>:<short id>" -> node from the JSON
 
  for (const f of floors) {
    const key = (id) => `${f.number}:${id}`;
 
    // Nodes
    for (const n of f.nodes) {
      const created = await prisma.node.create({
        data: {
          name: n.name,
          type: n.type,
          floor: f.number,
          building: b.name,
          accessible: n.accessible,
          pixelX: n.pixelX,
          pixelY: n.pixelY,
        },
      });
      idMap[key(n.id)] = created.id;
      nodeByKey[key(n.id)] = n;
    }
 
    // Edges within the floor; weight = pixel distance x metres-per-pixel
    for (const e of f.edges) {
      const from = nodeByKey[key(e.fromId)];
      const to = nodeByKey[key(e.toId)];
      if (!from || !to) throw new Error(`Level ${f.number}: edge references unknown node ${e.fromId} -> ${e.toId}`);
      await prisma.edge.create({
        data: {
          fromNodeId: idMap[key(e.fromId)],
          toNodeId: idMap[key(e.toId)],
          type: e.type,
          accessible: e.accessible,
          weight: Math.round(Math.hypot(from.pixelX - to.pixelX, from.pixelY - to.pixelY) * mpp * 10) / 10,
          building: b.name,
        },
      });
    }
 
    // Layout: link spaces/entrances to real node ids and copy each node's
    // accessibility (the map greys out rooms you can't enter).
    const link = ({ node, ...rest }) => {
      if (!node) return rest;
      if (!idMap[key(node)]) throw new Error(`Level ${f.number}: layout references unknown node ${node}`);
      return { ...rest, nodeId: idMap[key(node)], accessible: nodeByKey[key(node)].accessible };
    };
    const layout = {
      ...f.layout,
      metresPerPixel: mpp,
      spaces: f.layout.spaces.map(link),
      entrances: (f.layout.entrances ?? []).map(link),
    };
 
    const floorData = {
      label: f.label,
      imageUrl: f.image?.url ?? null,
      imageWidth: f.image?.width ?? null,
      imageHeight: f.image?.height ?? null,
      layout,
    };
    await prisma.floor.upsert({
      where: { buildingId_number: { buildingId: building.id, number: f.number } },
      update: floorData,
      create: { buildingId: building.id, number: f.number, ...floorData },
    });
 
    console.log(`  ${f.label}: ${f.nodes.length} nodes, ${f.edges.length} edges, ${layout.spaces.length} spaces`);
  }
 
  // Edges between floors (the "graph of graphs")
  for (const v of b.verticalEdges ?? []) {
    if (!idMap[v.from] || !idMap[v.to]) throw new Error(`Vertical edge references unknown node ${v.from} -> ${v.to}`);
    await prisma.edge.create({
      data: {
        fromNodeId: idMap[v.from],
        toNodeId: idMap[v.to],
        type: v.type,
        accessible: v.accessible,
        weight: v.weight,
        building: b.name,
      },
    });
  }
  console.log(`  ${(b.verticalEdges ?? []).length} connections between floors`);
}
 
async function main() {
  const buildings = readdirSync(DATA_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(new URL(`${d.name}/building.json`, DATA_DIR)))
    .map((d) => d.name);
 
  for (const dir of buildings) await seedBuilding(dir);
  console.log("Done.");
}
 
main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());