import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { fetchGraph } from "../services/api";

// ANU campus, Canberra
const ANU_CENTER = [149.1189, -35.2777];
const DEFAULT_ZOOM = 16;
const BUILDING = "Building 155 (Marie Reay Teaching Centre)"; // NEW

export default function CampusMap() {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);

  useEffect(() => {
    const token = import.meta.env.VITE_MAPBOX_TOKEN;

    if (!token) {
      console.error(
        "VITE_MAPBOX_TOKEN is not set. Add it to client/.env (see .env.example)."
      );
      return;
    }

    mapboxgl.accessToken = token;

    mapRef.current = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/standard",
      center: ANU_CENTER,
      zoom: DEFAULT_ZOOM,
      pitch: 45,
    });

    mapRef.current.addControl(new mapboxgl.NavigationControl());

    // NEW — everything below, until the return statement
    mapRef.current.on("load", async () => {
      const { nodes, edges } = await fetchGraph(BUILDING);

      mapRef.current.addSource("nodes", { type: "geojson", data: nodes });
      mapRef.current.addSource("edges", { type: "geojson", data: edges });

      mapRef.current.addLayer({
        id: "edges-layer",
        type: "line",
        source: "edges",
        paint: {
          "line-color": ["case", ["get", "accessible"], "#2f6fed", "#e0762f"],
          "line-width": 2,
          "line-dasharray": ["case", ["get", "accessible"], ["literal", [1, 0]], ["literal", [2, 2]]],
        },
      });

      mapRef.current.addLayer({
        id: "nodes-layer",
        type: "circle",
        source: "nodes",
        paint: {
          "circle-radius": 6,
          "circle-color": ["case", ["get", "accessible"], "#2f6fed", "#e0762f"],
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      });

      const coords = nodes.features.map((f) => f.geometry.coordinates);
      const lngs = coords.map((c) => c[0]);
      const lats = coords.map((c) => c[1]);
      mapRef.current.fitBounds(
        [
          [Math.min(...lngs), Math.min(...lats)],
          [Math.max(...lngs), Math.max(...lats)],
        ],
        { padding: 60, maxZoom: 19 }
      );
    });
    // END NEW

    return () => mapRef.current?.remove();
  }, []);

  return (
    <div
      ref={mapContainerRef}
      style={{ position: "absolute", inset: 0 }}
    />
  );
}