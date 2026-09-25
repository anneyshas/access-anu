import { prisma } from "../config/prisma.js";

// GET /api/buildings
// Returns one entry per building: its name, its real-world center point
// (used to place the marker on the outer campus map), its georeference
// (pins the floor plans to real lat/lng for outdoor navigation), and its floors —
// each with its vector `layout` (what the indoor map draws) and the
// reference floor plan image. All in the same pixel space as the nodes.
export async function getBuildings(req, res) {
  const buildings = await prisma.building.findMany({
    include: { floors: { orderBy: { number: "asc" } } },
  });

  const results = buildings.map((b) => ({
    name: b.name,
    center: { lat: b.lat, lng: b.lng },
    georeference: b.georeference,
    floors: b.floors.map((f) => ({
      number: f.number,
      label: f.label,
      imageUrl: f.imageUrl,
      imageWidth: f.imageWidth,
      imageHeight: f.imageHeight,
      layout: f.layout,
    })),
  }));

  res.json(results);
}