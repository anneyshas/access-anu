import { useEffect, useMemo, useState } from "react";
import FloorSwitcher from "./FloorSwitcher";
import FloorMap from "./FloorMap";
import SearchPanel from "./SearchPanel";
import PlaceCard from "./Placecard";
import { fetchGraph } from "../services/api";
import { buildPlaces, CATEGORIES } from "../places";

// Dev-only: add ?graph=1 to the URL to draw the nodes/edges (and a faint copy
// of the original floor plan) on top of the map.
const SHOW_GRAPH = new URLSearchParams(window.location.search).has("graph");

// Indoor view: full-screen map of one floor with search, category chips,
// a floor picker and a place card for the selected room.
export default function BuildingView({ building, onBack }) {
  const floors = useMemo(() => building.floors ?? [], [building]);
  const [activeFloor, setActiveFloor] = useState(floors[0]?.number);
  const [selected, setSelected] = useState(null); // { floor, spaceId }
  const [focusKey, setFocusKey] = useState(0);
  const [category, setCategory] = useState(null);
  const [graph, setGraph] = useState(null);
  const [error, setError] = useState(null);

  const floor = floors.find((f) => f.number === activeFloor);
  const places = useMemo(() => buildPlaces(floors), [floors]);
  const shortName = building.name.match(/\((.*)\)/)?.[1] ?? building.name;
  const selectedPlace = selected && places.find((p) => p.floor === selected.floor && p.spaceId === selected.spaceId);

  useEffect(() => {
    setError(null);
    setGraph(null);
    if (!SHOW_GRAPH || activeFloor === undefined) return;
    fetchGraph(building.name, activeFloor)
      .then(setGraph)
      .catch((err) => setError(err.message));
  }, [building.name, activeFloor]);

  const pickPlace = (p) => {
    setActiveFloor(p.floor);
    setSelected({ floor: p.floor, spaceId: p.spaceId });
    setFocusKey((k) => k + 1);
  };

  const changeFloor = (n) => {
    setActiveFloor(n);
    if (selected?.floor !== n) setSelected(null);
  };

  return (
    <div className="absolute inset-0 overflow-hidden bg-map-bg font-sans text-map-ink">
      {floor ? (
        <FloorMap
          layout={floor.layout}
          image={floor.imageUrl ? { url: floor.imageUrl, width: floor.imageWidth, height: floor.imageHeight } : null}
          graph={graph}
          showImage={SHOW_GRAPH}
          selectedId={selected?.floor === activeFloor ? selected.spaceId : null}
          highlight={CATEGORIES.find((c) => c.id === category)?.kinds ?? []}
          focusKey={focusKey}
          onSelect={(spaceId) => setSelected(spaceId ? { floor: activeFloor, spaceId } : null)}
        />
      ) : (
        <div className="absolute inset-0 grid place-items-center text-map-muted">No floor data yet for {building.name}.</div>
      )}

      <SearchPanel
        buildingName={shortName}
        places={places}
        category={category}
        onCategory={setCategory}
        onPick={pickPlace}
        onBack={onBack}
      />

      {floors.length > 0 && <FloorSwitcher floors={floors} activeFloor={activeFloor} onSelectFloor={changeFloor} />}

      <PlaceCard place={selectedPlace} buildingName={shortName} onClose={() => setSelected(null)} />

      {error && (
        <div className="absolute top-4 left-1/2 z-40 -translate-x-1/2 rounded-lg bg-map-red px-3 py-2 text-sm text-white shadow-map">{error}</div>
      )}
    </div>
  );
}