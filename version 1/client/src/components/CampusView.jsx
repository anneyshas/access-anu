import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { fetchBuildings } from "../services/api";

// ANU campus, Canberra
const ANU_CENTER = [149.1189, -35.2777];
const DEFAULT_ZOOM = 16;

// Outer campus map — one marker per building. Click a marker to go indoors.
export default function CampusView({ onSelectBuilding }) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const token = import.meta.env.VITE_MAPBOX_TOKEN;
    if (!token) {
      setError("VITE_MAPBOX_TOKEN is not set. Add it to client/.env.");
      return;
    }

    mapboxgl.accessToken = token;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/standard",
      center: ANU_CENTER,
      zoom: DEFAULT_ZOOM,
      pitch: 45,
    });
    mapRef.current = map;
    map.addControl(new mapboxgl.NavigationControl());

    map.on("load", async () => {
      try {
        const buildings = await fetchBuildings();

        for (const b of buildings) {
          if (b.center.lat == null || b.center.lng == null) continue;

          const el = document.createElement("div");
          el.className = "building-marker";
          el.title = `Open ${b.name}`;
          el.innerHTML = `
            <span class="building-marker-label">${b.name.replace(/\s*\(.*\)$/, "")}</span>
            <svg class="building-marker-pin" width="30" height="40" viewBox="0 0 24 32" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 0C5.373 0 0 5.373 0 12c0 9 12 20 12 20s12-11 12-20c0-6.627-5.373-12-12-12z" />
              <rect x="7" y="6" width="10" height="11" rx="1" fill="white"/>
              <rect x="9" y="8.5" width="2" height="2" fill="currentColor"/>
              <rect x="13" y="8.5" width="2" height="2" fill="currentColor"/>
              <rect x="9" y="12" width="2" height="2" fill="currentColor"/>
              <rect x="13" y="12" width="2" height="5" fill="currentColor"/>
            </svg>
          `;

          el.addEventListener("click", () => onSelectBuilding(b));

          new mapboxgl.Marker({ element: el, anchor: "bottom" })
            .setLngLat([b.center.lng, b.center.lat])
            .addTo(map);
        }
      } catch (err) {
        console.error(err);
        setError(err.message);
      }
    });

    return () => map.remove();
  }, [onSelectBuilding]);

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <div ref={mapContainerRef} style={{ position: "absolute", inset: 0 }} />
      {error && (
        <div style={errorBannerStyle}>{error}</div>
      )}
    </div>
  );
}

const errorBannerStyle = {
  position: "absolute",
  top: 12,
  left: 12,
  background: "#b91c1c",
  color: "white",
  padding: "8px 12px",
  borderRadius: 6,
  fontSize: 14,
  zIndex: 10,
};