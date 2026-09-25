import { useEffect, useMemo, useState } from "react";
import FloorSwitcher from "./FloorSwitcher";
import FloorMap from "./FloorMap";
import SearchPanel from "./SearchPanel";
import PlaceCard from "./Placecard";
import DirectionsPanel from "./Directionspanel";
import { fetchGraph, fetchRoute } from "../services/api";
import { buildPlaces, CATEGORIES, defaultStart } from "../places";

// Dev-only: add ?graph=1 to the URL to draw the nodes/edges (and a faint copy
// of the original floor plan) on top of the map.
const SHOW_GRAPH = new URLSearchParams(window.location.search).has("graph");

// Bounding box of one floor's part of a route (for zooming onto it).
function routeBox(route, floor) {
  const pts = (route?.legs ?? []).filter((l) => l.floor === floor).flatMap((l) => l.points);
  if (!pts.length) return null;
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

// Indoor view: full-screen map of one floor with search, category chips, a
// floor picker, a place card for the selected room, and directions.
// `intent` (optional) opens the view ready to go, e.g. after outdoor
// navigation reaches the building:
//   { directions: { fromNodeId, toKey, stepFree } }  -> indoor directions
//   { select: placeKey }                               -> show that place
export default function BuildingView({ building, onBack, intent }) {
  const floors = useMemo(() => building.floors ?? [], [building]);
  const [activeFloor, setActiveFloor] = useState(floors[0]?.number);
  const [selected, setSelected] = useState(null); // { floor, spaceId }
  const [focusKey, setFocusKey] = useState(0);
  const [focusBox, setFocusBox] = useState(null);
  const [category, setCategory] = useState(null);
  const [graph, setGraph] = useState(null);
  const [error, setError] = useState(null);

  // Directions state
  const [dir, setDir] = useState(null); // { from, to } places, or null when not navigating
  const [stepFree, setStepFree] = useState(true); // Accessibility Mode on by default
  const [routes, setRoutes] = useState({ stepFree: null, fastest: null });
  const [loading, setLoading] = useState(false);
  const [picking, setPicking] = useState(null); // "from" | "to" | null

  const floor = floors.find((f) => f.number === activeFloor);
  const places = useMemo(() => buildPlaces(floors, building.georeference), [floors, building.georeference]);
  const shortName = building.name.match(/\((.*)\)/)?.[1] ?? building.name;
  const selectedPlace = selected && places.find((p) => p.floor === selected.floor && p.spaceId === selected.spaceId);
  const route = dir ? (stepFree ? routes.stepFree : routes.fastest) : null;
  const liveRoute = route && !route.error ? route : null;

  // Apply the intent once, when the view opens.
  useEffect(() => {
    if (!intent) return;
    if (intent.directions) {
      const { fromNodeId, toKey, stepFree: sf } = intent.directions;
      const to = places.find((p) => p.key === toKey);
      const from = places.find((p) => p.nodeId === fromNodeId) ?? defaultStart(places);
      if (to) {
        setStepFree(sf ?? true);
        setDir({ from: from && from.key !== to.key ? from : null, to });
        setPicking(from ? null : "from");
      }
    } else if (intent.select) {
      const p = places.find((x) => x.key === intent.select);
      if (p) {
        setActiveFloor(p.floor);
        setSelected(p.spaceId ? { floor: p.floor, spaceId: p.spaceId } : null);
        setFocusKey((k) => k + 1);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intent]);

  useEffect(() => {
    setError(null);
    setGraph(null);
    if (!SHOW_GRAPH || activeFloor === undefined) return;
    fetchGraph(building.name, activeFloor)
      .then(setGraph)
      .catch((err) => setError(err.message));
  }, [building.name, activeFloor]);

  // Fetch both route options whenever start/destination change.
  const fromId = dir?.from?.nodeId;
  const toId = dir?.to?.nodeId;
  useEffect(() => {
    if (!fromId || !toId) {
      setRoutes({ stepFree: null, fastest: null });
      return;
    }
    if (fromId === toId) {
      setRoutes({ stepFree: { error: "You're already there" }, fastest: { error: "You're already there" } });
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([fetchRoute(fromId, toId, true), fetchRoute(fromId, toId, false)])
      .then(([a, b]) => {
        if (cancelled) return;
        setRoutes({ stepFree: a, fastest: b });
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [fromId, toId]);

  // When a route arrives (or the mode changes), show where it starts.
  useEffect(() => {
    if (!liveRoute) return;
    const start = liveRoute.legs[0].floor;
    setActiveFloor(start);
    const box = routeBox(liveRoute, start);
    if (box) setFocusBox({ key: Date.now(), ...box });
  }, [liveRoute]);

  const showFloor = (n) => {
    setActiveFloor(n);
    if (liveRoute) {
      const box = routeBox(liveRoute, n);
      if (box) setFocusBox({ key: Date.now(), ...box });
    } else if (selected?.floor !== n) {
      setSelected(null);
    }
  };

  const pickPlace = (p) => {
    setActiveFloor(p.floor);
    setSelected(p.spaceId ? { floor: p.floor, spaceId: p.spaceId } : null);
    setFocusKey((k) => k + 1);
  };

  const startDirections = (to) => {
    const start = defaultStart(places);
    setDir({ from: start && start.key !== to.key ? start : null, to });
    setPicking(start && start.key !== to.key ? null : "from");
    setCategory(null);
  };

  const closeDirections = () => {
    setDir(null);
    setPicking(null);
    setRoutes({ stepFree: null, fastest: null });
  };

  // Tapping the map: in directions, it fills the From (or To) field;
  // otherwise it selects the place.
  const onMapSelect = (spaceId) => {
    if (dir) {
      if (!spaceId) return;
      const p = places.find((x) => x.floor === activeFloor && x.spaceId === spaceId);
      if (!p) return;
      if (picking === "to") setDir((d) => ({ ...d, to: p }));
      else setDir((d) => ({ ...d, from: p }));
      setPicking(null);
      return;
    }
    setSelected(spaceId ? { floor: activeFloor, spaceId } : null);
  };

  const destinationSpace = dir?.to?.floor === activeFloor ? dir.to.spaceId : null;

  return (
    <div className="absolute inset-0 overflow-hidden bg-map-bg font-sans text-map-ink">
      {floor ? (
        <FloorMap
          layout={floor.layout}
          image={floor.imageUrl ? { url: floor.imageUrl, width: floor.imageWidth, height: floor.imageHeight } : null}
          graph={graph}
          showImage={SHOW_GRAPH}
          selectedId={dir ? destinationSpace : selected?.floor === activeFloor ? selected.spaceId : null}
          highlight={CATEGORIES.find((c) => c.id === category)?.kinds ?? []}
          focusKey={focusKey}
          onSelect={onMapSelect}
          floorNumber={activeFloor}
          route={liveRoute}
          onFloorJump={showFloor}
          focusBox={focusBox}
        />
      ) : (
        <div className="absolute inset-0 grid place-items-center text-map-muted">No floor data yet for {building.name}.</div>
      )}

      {dir ? (
        <DirectionsPanel
          from={dir.from}
          to={dir.to}
          places={places}
          stepFree={stepFree}
          routes={routes}
          loading={loading}
          picking={picking}
          onPicking={setPicking}
          onFrom={(p) => setDir((d) => ({ ...d, from: p }))}
          onTo={(p) => setDir((d) => ({ ...d, to: p }))}
          onSwap={() => setDir((d) => ({ from: d.to, to: d.from }))}
          onMode={setStepFree}
          onClose={closeDirections}
          onStep={(s) => showFloor(s.floor)}
          activeFloor={activeFloor}
        />
      ) : (
        <SearchPanel buildingName={shortName} places={places} category={category} onCategory={setCategory} onPick={pickPlace} onBack={onBack} />
      )}

      {floors.length > 0 && (
        <FloorSwitcher
          floors={floors}
          activeFloor={activeFloor}
          onSelectFloor={showFloor}
          routeFloors={liveRoute?.floors ?? []}
          placement={dir ? "right" : "left"}
        />
      )}

      {!dir && (
        <PlaceCard place={selectedPlace} buildingName={shortName} onClose={() => setSelected(null)} onDirections={startDirections} />
      )}

      {error && (
        <div className="absolute top-4 left-1/2 z-40 -translate-x-1/2 rounded-lg bg-map-red px-3 py-2 text-sm text-white shadow-map">{error}</div>
      )}
    </div>
  );
}