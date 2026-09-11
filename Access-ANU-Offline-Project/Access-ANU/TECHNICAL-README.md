# Access ANU — B155 connected floor navigator

Client-side 3D reconstruction of two user-supplied B155 diagrams. Level Two's photo was perspective-corrected and rotated 90 degrees anticlockwise to align with Level One. Lift shafts are snapped to the same common-coordinate footprints. Coordinates and heights are illustrative, not surveyed metres.

## Interaction

- Both floors: exploded, staggered 3D view; blue Level One routes, teal Level Two routes. Dashed bridges represent connector transitions, not walkable space between separated slabs.
- Level One / Level Two: focus either map for point selection. Each endpoint retains its own floor ID. Floor selectors clear only the relevant endpoint and focus the requested floor.
- Click to select A then B, or use the endpoint cards to change which point is selected. Drag to rotate, scroll to zoom. Top view and low-wall controls are preserved.
- Best available connection, lifts only, or stairs only. Route instructions focus each floor or return to the combined view.
- Focus the canvas and use arrow keys / Enter for keyboard point selection.

## Run

Serve `dist/` over HTTP: `python3 -m http.server 8000 --directory dist`. No API keys or external runtime dependencies. ES modules and the module worker require HTTP rather than opening index.html with file://.

## Data and routing

- `geometry.mjs`: original Level One walls, door gaps, columns, stairs and lifts, traced from source-image pixels divided by 20.
- `level2.mjs`: registered Level Two geometry. Stairwell voids are explicit obstacles. The small northern flight has no confirmed destination and no connector.
- `building.mjs`: two floor records plus seven bidirectional connections: three lifts, two central stairs, two enclosed stairwells. Connections join walkable landing / door points, not shaft centres.
- `router.mjs`: A* over two 8-connected floor grids (0.18-unit cells) with explicit inter-floor edges. A 3D Euclidean heuristic uses a 3.6-unit illustrative storey rise. Each transfer costs at least its Euclidean endpoint distance; stairs carry a 1.3 multiplier to represent the longer inclined path. These are model distances, not measured travel times or live lift waiting estimates. Both clearance and shortest routes use the same selected transport filter.
- Horizontal edge cost: `length * (1 + weight / (0.3 + max(0, clearance - radius))^2)`. Weight zero is shortest on the discretised model, not an exact continuous-space geodesic. Proximity cost applies to floor segments; stair/lift travel uses the dedicated transfer edge. Reported clearance excludes transfer travel. Minimum buffer is checked for both endpoints and sampled horizontal segments; corner cutting is prohibited.
- Floor segments and transfer records are returned separately. Multi-transfer paths are supported, including an isolated landing reached through the other floor.
- `worker.mjs`: computes both routes off the UI thread. Debounced requests and request IDs prevent stale results from replacing a newer selection.
- `app.mjs`: dependency-free, orthographic 3D mesh renderer using a 2D canvas with depth-sorted faces, inverse-projection picking per displayed floor, and labelled transition bridges. Floor explosion is purely visual and never changes routing coordinates.

## Limits

Door and landing positions are inferred from photographs and diagrams. In particular, Level One's unverified northern-room doors and internal access to enclosed stairwells remain closed. Main-hall routes can use central stairs and lifts; selecting an enclosed landing can use its inter-floor connection. Service-room doors and central stair landing correspondence need on-site verification. Storey height, travel-distance multipliers, wall height and scale are illustrative. Lifts-only mode is not an accessibility certification or lift-availability feed. No live positioning is included.

## Verification

Run `node verify.mjs`. Tests cover the original single-floor routes, all obstacle buffers and preference settings, pillar exclusion, door-gap reachability, bidirectional inter-floor routes, lift/stair filters, connector-only level changes, stairwell-void exclusion, same-floor Level Two routes, and a two-transfer route. A separate canvas/application smoke harness rendered stacked/focused/top views and exercised actual pointer handlers to select endpoints on different floors. No browser end-to-end test was performed.
