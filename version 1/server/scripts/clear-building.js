/**
 * One-off cleanup: deletes ALL Node/Edge rows for BUILDING.
 * Use this to fix duplicate data from re-running an old seed.js.
 *
 * Run: node scripts/clear-building.js
 */
import { prisma } from "../src/config/prisma.js";
const BUILDING = "Building 155 (Marie Reay Teaching Centre)";

async function main() {
  const nodeCountBefore = await prisma.node.count({ where: { building: BUILDING } });
  const edgeCountBefore = await prisma.edge.count({ where: { building: BUILDING } });
  console.log(`Before: ${nodeCountBefore} nodes, ${edgeCountBefore} edges`);

  await prisma.edge.deleteMany({ where: { building: BUILDING } });
  await prisma.node.deleteMany({ where: { building: BUILDING } });

  const nodeCountAfter = await prisma.node.count({ where: { building: BUILDING } });
  const edgeCountAfter = await prisma.edge.count({ where: { building: BUILDING } });
  console.log(`After: ${nodeCountAfter} nodes, ${edgeCountAfter} edges (should both be 0)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());