import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { fetchBuildings } from "../services/api";
import Icon from "./icons";
import { IconBadge } from "./mapIcons";
import OutdoorNav from "./OutdoorNav.jsx";
import CalibratePanel from "./CalibratePanel";
import useOutdoorNav from "../hooks/useOutdoorNav";
import { KIND_INFO } from "../places";
import { buildingCode, campusPlaces, entrancesFor, searchCampus, shortName } from "../lib/campus";
import { distance } from "../lib/geo";

// ANU campus, Canberra
const ANU_CENTER = [149.1189, -35.2777];
const DEFAULT_ZOOM = 16;
const CAMPUS_RADIUS_M = 3000; // navigation only starts from on (or near) campus
const CALIBRATE = new URLSearchParams(window.location.search).has("calibrate");
const wide = () => window.innerWidth >= 640;

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

// Blue "you are here" dot with an accuracy halo.
function userDotElement() {
  const el = document.createElement("div");
  el.className = "pointer-events-none";
  el.innerHTML = `
    <div class="relative size-0">
      <div data-halo class="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#1a73e8]/30 bg-[#1a73e8]/15" style="width:40px;height:40px"></div>
      <div class="absolute size-[18px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white bg-[#1a73e8] shadow-[0_1px_4px_rgba(0,0,0,.4)]"></div>
    </div>`;
  return el;
}

// Small door marker for a building entrance (green = the one the route uses).
function entranceElement(label, highlighted) {
  const el = document.createElement("div");
  el.className = "pointer-events-none";
  el.innerHTML = `
    <div class="flex items-center gap-1" style="transform: translateX(calc(50% - 9px))">
      <div class="grid size-[18px] place-items-center rounded-full border-2 border-white ${highlighted ? "bg-[#188038]" : "bg-[#5f6368]"} shadow">
        <svg viewBox="0 0 24 24" width="11" height="11" fill="white"><path d="M11 7 9.6 8.4l2.6 2.6H2v2h10.2l-2.6 2.6L11 17l5-5-5-5zm9 12h-8v2h8c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-8v2h8v14z"/></svg>
      </div>
      <span class="whitespace-nowrap text-[11px] font-medium ${highlighted ? "text-[#188038]" : "text-[#3c4043]"} [paint-order:stroke] [-webkit-text-stroke:3px_white]" style="font-family: Roboto, system-ui, sans-serif">${label}</span>
    </div>`;
  return el;
}

// Draws (or updates) the route line. After a style switch it is re-added
// by the styleTick effect.
function drawRoute(map, coords) {
  const data = { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coords ?? [] } };
  try {
    const src = map.getSource("nav-route");
    if (src) return src.setData(data);
    map.addSource("nav-route", { type: "geojson", data });
    const layout = { "line-join": "round", "line-cap": "round" };
    map.addLayer({ id: "nav-route-casing", type: "line", source: "nav-route", slot: "top", layout, paint: { "line-color": "#ffffff", "line-width": 11 } });
    map.addLayer({ id: "nav-route-line", type: "line", source: "nav-route", slot: "top", layout, paint: { "line-color": "#1a73e8", "line-width": 7 } });
  } catch {
    // style is switching; the next style.load redraws it
  }
}

// Outer campus map: building pins, a search bar that finds buildings AND
// rooms, and walking navigation to a room that hands over to the indoor map.
export default function CampusView({ onEnterBuilding }) {
  const mapContainerRef = useRef(null);
  const [map, setMap] = useState(null);
  const [styleTick, setStyleTick] = useState(0);
  const [buildings, setBuildings] = useState([]);
  const [georefs, setGeorefs] = useState({}); // building name -> georeference edited by calibration
  const [selected, setSelected] = useState(null); // search item: building or place
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [error, setError] = useState(null);

  // Navigation state
  const [target, setTarget] = useState(null); // place we're navigating to
  const [origin, setOrigin] = useState(null); // { lngLat, label, accuracy }
  const [originStatus, setOriginStatus] = useState(null);
  const [picking, setPicking] = useState(false);
  const [stepFree, setStepFree] = useState(true);
  const [following, setFollowing] = useState(true);

  const liveBuildings = useMemo(() => buildings.map((b) => ({ ...b, georeference: georefs[b.name] ?? b.georeference })), [buildings, georefs]);
  const items = useMemo(() => campusPlaces(liveBuildings), [liveBuildings]);
  const results = useMemo(() => searchCampus(items, query), [items, query]);

  const dest = useMemo(() => {
    if (!target) return null;
    const b = liveBuildings.find((x) => x.name === target.building.name);
    return b ? { building: b, place: target, entrances: entrancesFor(b) } : null;
  }, [target, liveBuildings]);
  const nav = useOutdoorNav({ dest, origin, stepFree });

  // ---- map setup ----------------------------------------------------------------
  useEffect(() => {
    const token = import.meta.env.VITE_MAPBOX_TOKEN;
    if (!token) {
      setError("VITE_MAPBOX_TOKEN is not set. Add it to client/.env.");
      return;
    }
    mapboxgl.accessToken = token;

    const m = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/standard",
      center: ANU_CENTER,
      zoom: DEFAULT_ZOOM,
      pitch: 45,
    });
    m.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), "bottom-right");
    m.on("style.load", () => setStyleTick((t) => t + 1));
    m.on("dragstart", (e) => e.originalEvent && setFollowing(false));

    m.on("load", async () => {
      setMap(m);
      try {
        const list = (await fetchBuildings()).filter((b) => b.center.lat != null && b.center.lng != null);
        setBuildings(list);
        for (const b of list) {
          const el = document.createElement("div");
          el.innerHTML = markerHtml(b);
          el.title = shortName(b.name);
          el.addEventListener("click", (e) => {
            e.stopPropagation();
            setSelected({ type: "building", building: b, key: `b:${b.name}` });
            m.flyTo({ center: [b.center.lng, b.center.lat], zoom: 17.5, pitch: 50, duration: 900 });
          });
          new mapboxgl.Marker({ element: el, anchor: "bottom" }).setLngLat([b.center.lng, b.center.lat]).addTo(m);
        }
      } catch (err) {
        console.error(err);
        setError(err.message);
      }
    });

    return () => m.remove();
  }, []);

  // Map clicks: set the starting point while picking, otherwise close the card.
  const pickingRef = useRef(picking);
  useEffect(() => {
    pickingRef.current = picking;
    if (map) map.getCanvas().style.cursor = picking ? "crosshair" : "";
  }, [map, picking]);
  useEffect(() => {
    if (!map) return;
    const onClick = (e) => {
      if (pickingRef.current) {
        setOrigin({ lngLat: [e.lngLat.lng, e.lngLat.lat], label: "Chosen point on map", accuracy: 5 });
        setOriginStatus("ok");
        setPicking(false);
        return;
      }
      setSelected(null);
    };
    map.on("click", onClick);
    return () => map.off("click", onClick);
  }, [map]);

  // ---- where am I? ----------------------------------------------------------------
  const locate = useCallback(() => {
    setPicking(false);
    if (!navigator.geolocation) {
      setOriginStatus("This browser can't share your location. Choose a point on the map.");
      return;
    }
    if (!window.isSecureContext) {
      setOriginStatus("Location needs HTTPS. Choose a point on the map, or open the site over https.");
      return;
    }
    setOriginStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lngLat = [pos.coords.longitude, pos.coords.latitude];
        const away = distance(lngLat, ANU_CENTER);
        if (away > CAMPUS_RADIUS_M) {
          setOrigin(null);
          setOriginStatus(`You're about ${Math.round(away / 1000)} km from ANU. Choose a start point on campus, then try Demo walk.`);
          return;
        }
        setOrigin({ lngLat, label: "Your location", accuracy: pos.coords.accuracy });
        setOriginStatus("ok");
      },
      (err) => setOriginStatus(err.code === 1 ? "Location permission denied. Choose a point on the map." : "Couldn't get your location. Choose a point on the map."),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );
  }, []);

  const startDirections = (place) => {
    setSelected(null);
    setTarget(place);
    setFollowing(true);
    if (!origin) locate();
  };

  const closeDirections = () => {
    nav.stop();
    setTarget(null);
    setPicking(false);
  };

  const enterBuilding = useCallback(() => {
    if (!dest) return;
    const entrance = nav.active?.entrance ?? nav.best?.entrance;
    onEnterBuilding(dest.building, { directions: { fromNodeId: entrance?.nodeId, toKey: dest.place.placeKey, stepFree } });
  }, [dest, nav.active, nav.best, stepFree, onEnterBuilding]);

  // ---- drawing: entrances, blue dot, route ------------------------------------------
  const chosenEntrance = (nav.active ?? nav.best)?.entrance?.nodeId;
  useEffect(() => {
    if (!map || !dest) return;
    const markers = dest.entrances.map((en) =>
      new mapboxgl.Marker({ element: entranceElement(en.name, chosenEntrance === en.nodeId), anchor: "center" }).setLngLat(en.lngLat).addTo(map)
    );
    return () => markers.forEach((mk) => mk.remove());
  }, [map, dest, chosenEntrance]);

  const dotRef = useRef(null);
  const dotPos = nav.phase !== "preview" && nav.position ? nav.position : target ? origin : null;
  useEffect(() => {
    if (!map) return;
    if (!dotPos) {
      dotRef.current?.remove();
      dotRef.current = null;
      return;
    }
    if (!dotRef.current) dotRef.current = new mapboxgl.Marker({ element: userDotElement() }).setLngLat(dotPos.lngLat).addTo(map);
    dotRef.current.setLngLat(dotPos.lngLat);
    const mPerPx = (156543.03 * Math.cos((dotPos.lngLat[1] * Math.PI) / 180)) / 2 ** map.getZoom();
    const px = Math.min(160, Math.max(24, (2 * (dotPos.accuracy ?? 10)) / mPerPx));
    const halo = dotRef.current.getElement().querySelector("[data-halo]");
    if (halo) Object.assign(halo.style, { width: `${px}px`, height: `${px}px` });
  }, [map, dotPos]);

  const routeLine = !target ? null : nav.phase === "navigating" ? nav.progress?.remainingLine : nav.phase === "preview" ? nav.best?.outdoor?.line : null;
  useEffect(() => {
    if (map) drawRoute(map, routeLine);
  }, [map, styleTick, routeLine]);

  // Preview: fit the whole route on screen.
  const previewLine = target && nav.phase === "preview" ? nav.best?.outdoor?.line : null;
  useEffect(() => {
    if (!map || !previewLine) return;
    const bounds = previewLine.reduce((b, p) => b.extend(p), new mapboxgl.LngLatBounds(previewLine[0], previewLine[0]));
    const padding = wide() ? { top: 60, bottom: 60, left: 460, right: 140 } : { top: 380, bottom: 40, left: 40, right: 40 };
    map.fitBounds(bounds, { padding, maxZoom: 18, pitch: 0, bearing: 0, duration: 900 });
  }, [map, previewLine]);

  // Navigating: follow the user with the route pointing up.
  useEffect(() => {
    if (!map || nav.phase !== "navigating" || !following || !nav.position) return;
    map.easeTo({
      center: nav.position.lngLat,
      bearing: nav.progress?.heading ?? map.getBearing(),
      pitch: 55,
      zoom: 18,
      duration: 600,
      padding: wide() ? { left: 420, top: 0, bottom: 0, right: 0 } : { top: 140, bottom: 120, left: 0, right: 0 },
    });
  }, [map, nav.phase, nav.position, nav.progress?.heading, following]);

  useEffect(() => {
    if (nav.phase === "arrived" && map && nav.active) {
      map.easeTo({ center: nav.active.entrance.lngLat, zoom: 18.5, pitch: 50, duration: 800 });
    }
  }, [nav.phase, map, nav.active]);

  // ---- search -------------------------------------------------------------------------
  const pick = (item) => {
    setQuery("");
    setFocused(false);
    setSelected(item);
    const b = item.building;
    map?.flyTo({ center: [b.center.lng, b.center.lat], zoom: 17.5, pitch: 50, duration: 900 });
  };

  const calBuilding = CALIBRATE && map ? liveBuildings.find((b) => b.georeference) : null;

  return (
    <div className={`absolute inset-0 font-sans ${dest ? "navigating" : ""}`}>
      {/* h-full/w-full (not absolute): mapbox-gl.css forces .mapboxgl-map to position:relative,
          which overrides Tailwind classes, so the parent does the positioning. */}
      <div ref={mapContainerRef} className="h-full w-full" />

      {dest ? (
        <OutdoorNav
          dest={dest}
          origin={origin}
          originStatus={originStatus}
          onUseMyLocation={locate}
          onPickOnMap={() => setPicking((p) => !p)}
          picking={picking}
          stepFree={stepFree}
          onMode={setStepFree}
          nav={nav}
          following={following}
          onRecenter={() => setFollowing(true)}
          onEnd={closeDirections}
          onEnter={enterBuilding}
          onClose={closeDirections}
        />
      ) : (
        <SearchBox query={query} setQuery={setQuery} focused={focused} setFocused={setFocused} results={results} onPick={pick} />
      )}

      {!dest && selected && (
        <SelectionCard
          item={selected}
          onClose={() => setSelected(null)}
          onDirections={startDirections}
          onIndoor={(item) =>
            onEnterBuilding(
              liveBuildings.find((b) => b.name === item.building.name),
              item.type === "place" ? { select: item.placeKey } : undefined
            )
          }
        />
      )}

      {calBuilding && (
        <CalibratePanel
          map={map}
          building={calBuilding}
          georef={calBuilding.georeference}
          onChange={(g) => setGeorefs((all) => ({ ...all, [calBuilding.name]: g }))}
        />
      )}

      {error && <div className="absolute top-20 left-4 z-20 rounded-lg bg-map-red px-3 py-2 text-sm text-white shadow-map">{error}</div>}
    </div>
  );
}

function SearchBox({ query, setQuery, focused, setFocused, results, onPick }) {
  return (
    <div className="absolute top-3 right-3 left-3 z-10 max-w-[400px] sm:top-4 sm:left-4">
      <div className="flex h-12 items-center gap-2 rounded-full bg-white pr-2 pl-4 shadow-map">
        <span className="text-[15px] font-bold tracking-tight text-map-blue">AccessANU</span>
        <span className="h-6 w-px bg-map-line" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          onKeyDown={(e) => e.key === "Enter" && results[0] && onPick(results[0])}
          placeholder="Search a building or room, e.g. 5.01"
          className="h-full min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-map-muted"
        />
        <span className="grid size-10 place-items-center text-map-blue">
          <Icon name="search" />
        </span>
      </div>
      {focused && (
        <div className="mt-2 max-h-[60vh] overflow-auto rounded-2xl bg-white py-2 shadow-map">
          {results.length === 0 ? (
            <div className="px-4 py-3 text-sm text-map-muted">Nothing matches “{query}”.</div>
          ) : (
            results.map((item) => (
              <button
                key={item.key}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onPick(item)}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-map-hover"
              >
                {item.type === "building" ? (
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-map-red text-white">
                    <Icon name="building" className="size-[18px]" />
                  </span>
                ) : (
                  <IconBadge name={KIND_INFO[item.kind].icon} color={KIND_INFO[item.kind].badge} size={32} />
                )}
                <span className="min-w-0">
                  <span className="block truncate text-[14px] font-medium">{item.title}</span>
                  <span className="block truncate text-[12px] text-map-muted">{item.subtitle}</span>
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function SelectionCard({ item, onClose, onDirections, onIndoor }) {
  const b = item.building;
  const isPlace = item.type === "place";
  const info = isPlace ? KIND_INFO[item.kind] : null;
  return (
    <div className="absolute inset-x-0 bottom-0 z-10 rounded-t-2xl bg-white p-4 shadow-map sm:inset-x-auto sm:bottom-6 sm:left-4 sm:w-[360px] sm:rounded-2xl">
      <div className="flex items-start gap-3">
        {isPlace ? (
          <IconBadge name={info.icon} color={info.badge} size={40} />
        ) : (
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-map-red text-white">
            <Icon name="building" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[20px] leading-tight">{isPlace ? item.title : shortName(b.name)}</h2>
          <p className="mt-0.5 text-[13px] text-map-muted">
            {isPlace
              ? `${info.name} · ${item.floorLabel} · ${shortName(b.name)}`
              : `${buildingCode(b.name)} · ${b.floors.length} ${b.floors.length === 1 ? "floor" : "floors"} · Indoor map available`}
          </p>
        </div>
        <button onClick={onClose} className="-mt-1 -mr-1 grid size-9 place-items-center rounded-full text-map-muted hover:bg-map-hover" aria-label="Close">
          <Icon name="close" />
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-[12px]">
        {isPlace && !item.stepFree ? (
          <span className="flex items-center gap-1 rounded-full bg-map-hover px-2.5 py-1 font-medium text-map-ink-2">
            <Icon name="stairs" className="size-4" /> Stairs — not step-free
          </span>
        ) : (
          <span className="flex items-center gap-1 rounded-full bg-[#e6f4ea] px-2.5 py-1 font-medium text-map-green">
            <Icon name="accessible" className="size-4" /> {isPlace ? "Step-free access" : "Lifts to every floor"}
          </span>
        )}
      </div>
      <div className="mt-4 flex gap-2">
        {isPlace && (
          <button onClick={() => onDirections(item)} className="flex h-9 items-center gap-2 rounded-full bg-map-blue px-4 text-[14px] font-medium text-white hover:bg-[#1765cc]">
            <Icon name="directions" className="size-[18px]" /> Directions
          </button>
        )}
        <button
          onClick={() => onIndoor(item)}
          className={`flex h-9 items-center gap-2 rounded-full px-4 text-[14px] font-medium ${
            isPlace ? "border border-map-line text-map-blue hover:bg-map-hover" : "bg-map-blue text-white hover:bg-[#1765cc]"
          }`}
        >
          <Icon name="layers" className="size-[18px]" /> {isPlace ? "View inside" : "Indoor map"}
        </button>
      </div>
    </div>
  );
}