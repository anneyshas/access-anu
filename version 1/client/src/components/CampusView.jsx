import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { fetchBuildings } from "../services/api";
import Icon from "./icons";

// ANU campus, Canberra
const ANU_CENTER = [149.1189, -35.2777];
const DEFAULT_ZOOM = 16;

const shortName = (name) => name.match(/\((.*)\)/)?.[1] ?? name;
const code = (name) => name.replace(/\s*\(.*\)$/, "");

// Red Google-Maps-style pin with a building glyph, and the name beside it.
function markerHtml(b) {
  return `
    <div class="group flex cursor-pointer items-center gap-1" style="transform: translateX(calc(50% - 14px))">
      <svg width="28" height="38" viewBox="0 0 28 38" class="drop-shadow-md transition-transform group-hover:-translate-y-0.5">
        <path d="M14 37C11 28 1 22 1 13a13 13 0 0 1 26 0c0 9-10 15-13 24z" fill="#ea4335" stroke="#b31412"/>
        <rect x="8.5" y="7" width="11" height="12" rx="1.5" fill="white"/>
        <rect x="11" y="9.5" width="2.2" height="2.2" fill="#ea4335"/><rect x="14.8" y="9.5" width="2.2" height="2.2" fill="#ea4335"/>
        <rect x="11" y="13.2" width="2.2" height="2.2" fill="#ea4335"/><rect x="14.8" y="13.2" width="2.2" height="5.8" fill="#ea4335"/>
      </svg>
      <span class="-mt-3 whitespace-nowrap text-[13px] font-medium text-[#b31412] [paint-order:stroke] [-webkit-text-stroke:3px_white]" style="font-family: Roboto, system-ui, sans-serif">${shortName(b.name)}</span>
    </div>`;
}

// Outer campus map — one pin per building. Click a pin for its card, then
// "Indoor map" to go inside.
export default function CampusView({ onSelectBuilding }) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const [buildings, setBuildings] = useState([]);
  const [active, setActive] = useState(null);
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
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
    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), "bottom-right");

    map.on("load", async () => {
      try {
        const list = (await fetchBuildings()).filter((b) => b.center.lat != null && b.center.lng != null);
        setBuildings(list);
        for (const b of list) {
          const el = document.createElement("div");
          el.innerHTML = markerHtml(b);
          el.title = shortName(b.name);
          el.addEventListener("click", (e) => {
            e.stopPropagation();
            setActive(b);
            map.flyTo({ center: [b.center.lng, b.center.lat], zoom: 17.5, pitch: 50, duration: 900 });
          });
          new mapboxgl.Marker({ element: el, anchor: "bottom" }).setLngLat([b.center.lng, b.center.lat]).addTo(map);
        }
      } catch (err) {
        console.error(err);
        setError(err.message);
      }
    });
    map.on("click", () => setActive(null));

    return () => map.remove();
  }, []);

  const results = buildings.filter((b) => b.name.toLowerCase().includes(query.trim().toLowerCase()));
  const pick = (b) => {
    setQuery("");
    setFocused(false);
    setActive(b);
    mapRef.current?.flyTo({ center: [b.center.lng, b.center.lat], zoom: 17.5, pitch: 50, duration: 900 });
  };

  return (
    <div className="absolute inset-0 font-sans">
      {/* h-full/w-full (not absolute): mapbox-gl.css forces .mapboxgl-map to position:relative,
          which overrides Tailwind classes, so the parent does the positioning. */}
      <div ref={mapContainerRef} className="h-full w-full" />

      {/* Search */}
      <div className="absolute top-3 right-3 left-3 z-10 max-w-[400px] sm:top-4 sm:left-4">
        <div className="flex h-12 items-center gap-2 rounded-full bg-white pr-2 pl-4 shadow-map">
          <span className="text-[15px] font-bold tracking-tight text-map-blue">AccessANU</span>
          <span className="h-6 w-px bg-map-line" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 150)}
            placeholder="Search ANU buildings"
            className="h-full min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-map-muted"
          />
          <span className="grid size-10 place-items-center text-map-blue">
            <Icon name="search" />
          </span>
        </div>
        {focused && (
          <div className="mt-2 rounded-2xl bg-white py-2 shadow-map">
            {results.length === 0 ? (
              <div className="px-4 py-3 text-sm text-map-muted">No buildings match “{query}”.</div>
            ) : (
              results.map((b) => (
                <button key={b.name} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(b)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-map-hover">
                  <span className="grid size-8 place-items-center rounded-full bg-map-red text-white">
                    <Icon name="building" className="size-[18px]" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] font-medium">{shortName(b.name)}</span>
                    <span className="block truncate text-[12px] text-map-muted">
                      {code(b.name)} · {b.floors.length} {b.floors.length === 1 ? "floor" : "floors"}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Building card */}
      {active && (
        <div className="absolute inset-x-0 bottom-0 z-10 rounded-t-2xl bg-white p-4 shadow-map sm:inset-x-auto sm:bottom-6 sm:left-4 sm:w-[360px] sm:rounded-2xl">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-map-red text-white">
              <Icon name="building" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-[20px] leading-tight">{shortName(active.name)}</h2>
              <p className="mt-0.5 text-[13px] text-map-muted">
                {code(active.name)} · {active.floors.length} {active.floors.length === 1 ? "floor" : "floors"} · Indoor map available
              </p>
            </div>
            <button onClick={() => setActive(null)} className="-mt-1 -mr-1 grid size-9 place-items-center rounded-full text-map-muted hover:bg-map-hover" aria-label="Close">
              <Icon name="close" />
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-[12px]">
            <span className="flex items-center gap-1 rounded-full bg-[#e6f4ea] px-2.5 py-1 font-medium text-map-green">
              <Icon name="accessible" className="size-4" /> Lifts to every floor
            </span>
          </div>
          <button onClick={() => onSelectBuilding(active)} className="mt-4 flex h-9 items-center gap-2 rounded-full bg-map-blue px-4 text-[14px] font-medium text-white hover:bg-[#1765cc]">
            <Icon name="layers" className="size-[18px]" /> Indoor map
          </button>
        </div>
      )}

      {error && (
        <div className="absolute top-20 left-4 z-20 rounded-lg bg-map-red px-3 py-2 text-sm text-white shadow-map">{error}</div>
      )}
    </div>
  );
}