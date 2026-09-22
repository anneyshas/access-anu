/**
 * Converts a pixel position on a floor plan image into real-world lat/lng,
 * using 4 known corner reference points (bilinear interpolation).
 *
 * Usage:
 *   node scripts/geo-interpolate.js
 * (edit the CORNERS and POINTS_TO_CONVERT below for your floor first)
 */

// --- 1. Building 155, Level 1 — floor image's 4 corners ---
const IMAGE_WIDTH = 1448;   // px
const IMAGE_HEIGHT = 1086;  // px

const CORNERS = {
  topLeft:     { lat: -35.27737527985799, lng: 149.12046986344615 },
  topRight:    { lat: -35.27758373284163, lng: 149.12073952033637 },
  bottomLeft:  { lat: -35.27777379404118, lng: 149.12054928408634 },
  bottomRight: { lat: -35.27761757276526, lng: 149.12027194693815 },
};

// --- 2. Landmarks read off the evacuation plan (pixel positions are
//     visual estimates — nudge x/y and re-run if a marker looks off
//     once plotted on the real map) ---
const POINTS_TO_CONVERT = [
  { name: "Stairwell A (top-left)",        x: 230, y: 430 },
  { name: "Stairwell B (mid-right)",       x: 790, y: 790 },
  { name: "Lift 1",                        x: 340, y: 760 },
  { name: "Lift 2",                        x: 425, y: 760 },
  { name: "Lift 3",                        x: 505, y: 760 },
  { name: "Final Exit (west, mid)",        x: 100, y: 670 },
  { name: "Final Exit (bottom, near FIP)", x: 910, y: 1010 },
  { name: "Corridor / open floor (You Are Here)", x: 565, y: 250 },
];

function pixelToLatLng(px, py) {
  const u = px / IMAGE_WIDTH;   // 0 = left edge, 1 = right edge
  const v = py / IMAGE_HEIGHT;  // 0 = top edge, 1 = bottom edge

  const top = {
    lat: CORNERS.topLeft.lat + (CORNERS.topRight.lat - CORNERS.topLeft.lat) * u,
    lng: CORNERS.topLeft.lng + (CORNERS.topRight.lng - CORNERS.topLeft.lng) * u,
  };
  const bottom = {
    lat: CORNERS.bottomLeft.lat + (CORNERS.bottomRight.lat - CORNERS.bottomLeft.lat) * u,
    lng: CORNERS.bottomLeft.lng + (CORNERS.bottomRight.lng - CORNERS.bottomLeft.lng) * u,
  };

  return {
    lat: top.lat + (bottom.lat - top.lat) * v,
    lng: top.lng + (bottom.lng - top.lng) * v,
  };
}

for (const point of POINTS_TO_CONVERT) {
  const { lat, lng } = pixelToLatLng(point.x, point.y);
  console.log(`${point.name}: { lat: ${lat.toFixed(6)}, lng: ${lng.toFixed(6)} }`);
}
