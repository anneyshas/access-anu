import { useEffect, useState } from "react";
import FloorSwitcher from "./FloorSwitcher";
import FloorMap from "./FloorMap";
import { fetchGraph } from "../services/api";

// Dev-only: add ?graph=1 to the URL to draw the nodes/edges (and a faint
// copy of the original floor plan) on top of the map — handy when tracing
// and placing nodes for a new floor. Users just see the map.
const SHOW_GRAPH = new URLSearchParams(window.location.search).has("graph");

// Indoor view: full-screen map of one floor, floor switcher on the left.
export default function BuildingView({ building, onBack }) {
  const floors = building.floors ?? [];
  const [activeFloor, setActiveFloor] = useState(floors[0]?.number);
  const [graph, setGraph] = useState(null);
  const [error, setError] = useState(null);

  const floor = floors.find((f) => f.number === activeFloor);
  const shortName = building.name.replace(/\s*\(.*\)$/, "");
  const fullName = building.name.match(/\((.*)\)/)?.[1];

  useEffect(() => {
    setError(null);
    setGraph(null);
    if (!SHOW_GRAPH || activeFloor === undefined) return;
    fetchGraph(building.name, activeFloor)
      .then(setGraph)
      .catch((err) => setError(err.message));
  }, [building.name, activeFloor]);

  return (
    <div className="building-view">
      {floor ? (
        <FloorMap
          layout={floor.layout}
          image={
            floor.imageUrl
              ? { url: floor.imageUrl, width: floor.imageWidth, height: floor.imageHeight }
              : null
          }
          graph={graph}
          showImage={SHOW_GRAPH}
        />
      ) : (
        <div className="map-empty">No floor data yet for {building.name}.</div>
      )}

      <div className="map-header">
        <button className="map-back" onClick={onBack} aria-label="Back to campus map">
          ←
        </button>
        <div className="map-title">
          <div className="map-title-main">{fullName ?? shortName}</div>
          <div className="map-title-sub">
            {fullName ? `${shortName} · ` : ""}
            {floor?.label ?? ""}
          </div>
        </div>
      </div>

      {floors.length > 0 && (
        <FloorSwitcher floors={floors} activeFloor={activeFloor} onSelectFloor={setActiveFloor} />
      )}

      {error && <div className="map-error">{error}</div>}
    </div>
  );
}
