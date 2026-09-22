import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

// ANU campus, Canberra
const ANU_CENTER = [149.1189, -35.2777];
const DEFAULT_ZOOM = 16;

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

    return () => mapRef.current?.remove();
  }, []);

  return (
    <div
      ref={mapContainerRef}
      style={{ position: "absolute", inset: 0 }}
    />
  );
}
