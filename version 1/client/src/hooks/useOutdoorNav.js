// Outdoor navigation to a place inside a building.
//
//  1. Plan: as soon as a room is chosen, fetch the indoor routes from every
//     main entrance in the background (step-free and fastest). Separately get
//     a Mapbox walking route to each entrance, then pick the entrance with the
//     lowest total time. The outdoor route never waits for the indoor one.
//  2. Navigate: follow a live position (phone GPS, or a simulated walk for
//     demos), show the next turn, re-route if the user leaves the path.
//  3. Arrive: near the chosen entrance -> phase "arrived"; the caller then
//     opens indoor directions from that entrance.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchWalkingRoute } from "../services/directions";
import { fetchRoute } from "../services/api";
import { bearing, cumulative, distance, pointAlong, snapToLine } from "../lib/geo";

const WALK_SPEED = 1.3; // m/s outdoors
const indoorSpeed = (stepFree) => (stepFree ? 1.0 : 1.3);
const SIM_SPEEDUP = 6; // demo walk runs 6x faster than real walking
const OFF_ROUTE_M = 25; // further than this from the path -> re-route
const REROUTE_EVERY_MS = 10000;
const ARRIVE_M = 15;

// Route + the last few metres from where the path ends to the entrance door.
function withTail(route, entrance) {
  const end = route.line[route.line.length - 1];
  const tail = distance(end, entrance.lngLat);
  const line = tail > 2 ? [...route.line, entrance.lngLat] : route.line;
  const cum = cumulative(line);
  // Where each turn instruction sits along the line.
  const stepAt = route.steps.map((s) => snapToLine(line, cum, s.location).along);
  return { ...route, line, cum, stepAt, total: cum[cum.length - 1], tail };
}

export default function useOutdoorNav({ dest, origin, stepFree }) {
  const [outdoor, setOutdoor] = useState(null); // [{ entrance, outdoor }]
  const [indoor, setIndoor] = useState({}); // entrance nodeId -> { stepFree, fastest } (fetched in the background)
  const [planning, setPlanning] = useState(false);
  const [error, setError] = useState(null);

  const [phase, setPhase] = useState("preview"); // preview | navigating | arrived
  const [source, setSource] = useState(null); // "gps" | "sim"
  const [active, setActive] = useState(null); // plan being followed (outdoor may be re-routed)
  const [position, setPosition] = useState(null); // { lngLat, accuracy }
  const [gpsError, setGpsError] = useState(null);
  const lastReroute = useRef(0);
  const offCount = useRef(0);

  const destKey = dest ? `${dest.place.key}|${dest.entrances.map((e) => `${e.nodeId}@${e.lngLat.join(",")}`).join(";")}` : null;
  const indoorKey = dest ? `${dest.place.nodeId}|${dest.entrances.map((e) => e.nodeId).join(",")}` : null;
  const originKey = origin ? origin.lngLat.map((v) => v.toFixed(6)).join(",") : null;

  // ---- 1a. indoor routes: start as soon as a destination is chosen --------
  // They don't depend on where you are, so they load in the background while
  // the outdoor route is found (and are handed to the indoor map on arrival).
  useEffect(() => {
    setIndoor({});
    if (!dest) return;
    let cancelled = false;
    for (const entrance of dest.entrances) {
      Promise.all([
        fetchRoute(entrance.nodeId, dest.place.nodeId, true).catch((e) => ({ error: e.message })),
        fetchRoute(entrance.nodeId, dest.place.nodeId, false).catch((e) => ({ error: e.message })),
      ]).then(([sf, fast]) => {
        if (!cancelled) setIndoor((all) => ({ ...all, [entrance.nodeId]: { stepFree: sf, fastest: fast } }));
      });
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indoorKey]);

  // ---- 1b. outdoor walking routes to every entrance ------------------------
  useEffect(() => {
    setOutdoor(null);
    setError(null);
    setPhase("preview");
    setSource(null);
    setActive(null);
    setPosition(null);
    if (!dest || !origin) return;
    if (!dest.entrances.length) {
      setError("This building has no mapped entrances yet.");
      return;
    }
    const ctrl = new AbortController();
    setPlanning(true);
    Promise.all(
      dest.entrances.map(async (entrance) => {
        const route = await fetchWalkingRoute(origin.lngLat, entrance.lngLat, { signal: ctrl.signal }).catch((e) => ({ error: e.message }));
        return { entrance, outdoor: route.error ? route : withTail(route, entrance) };
      })
    )
      .then((p) => {
        if (ctrl.signal.aborted) return;
        setOutdoor(p);
        if (p.every((x) => x.outdoor.error)) setError(p[0].outdoor.error);
      })
      .finally(() => !ctrl.signal.aborted && setPlanning(false));
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destKey, originKey]);

  // Best entrance for the chosen mode: outdoor time + indoor time. While an
  // indoor route is still loading, that entrance is scored on outdoor time only.
  const indoorFor = useCallback((nodeId) => indoor[nodeId]?.[stepFree ? "stepFree" : "fastest"] ?? null, [indoor, stepFree]);
  const best = useMemo(() => {
    if (!outdoor) return null;
    const scored = outdoor
      .map((p) => {
        if (p.outdoor.error) return null;
        const route = indoorFor(p.entrance.nodeId);
        if (route?.error) return null; // e.g. no step-free way from this entrance
        const outdoorTime = p.outdoor.total / WALK_SPEED;
        const indoorTime = route ? route.duration ?? route.distance / indoorSpeed(stepFree) : 0;
        return { ...p, indoorRoute: route, indoorLoading: !route, outdoorTime, indoorTime, totalTime: outdoorTime + indoorTime };
      })
      .filter(Boolean)
      .sort((a, b) => a.totalTime - b.totalTime);
    return scored[0] ?? { none: true };
  }, [outdoor, indoorFor, stepFree]);

  // ---- 2. navigate ----------------------------------------------------------
  const start = useCallback(
    (mode) => {
      if (!best || best.none) return;
      setActive(best);
      setSource(mode);
      setPhase("navigating");
      setGpsError(null);
      setPosition(mode === "sim" ? { lngLat: best.outdoor.line[0], accuracy: 5 } : origin ? { lngLat: origin.lngLat, accuracy: origin.accuracy ?? 30 } : null);
      lastReroute.current = Date.now();
      offCount.current = 0;
    },
    [best, origin]
  );

  const stop = useCallback(() => {
    setPhase("preview");
    setSource(null);
    setActive(null);
    setPosition(null);
  }, []);

  // Live GPS
  useEffect(() => {
    if (phase !== "navigating" || source !== "gps") return;
    if (!navigator.geolocation) {
      setGpsError("This browser can't share your location.");
      return;
    }
    const id = navigator.geolocation.watchPosition(
      (pos) => setPosition({ lngLat: [pos.coords.longitude, pos.coords.latitude], accuracy: pos.coords.accuracy }),
      (err) => setGpsError(err.code === 1 ? "Location permission was denied." : "Can't get your location right now."),
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [phase, source]);

  // Simulated walk along the route (for demos away from campus)
  const simLine = source === "sim" && phase === "navigating" ? active?.outdoor : null;
  useEffect(() => {
    if (!simLine) return;
    let d = 0;
    const tick = 250;
    const id = setInterval(() => {
      d = Math.min(simLine.total, d + (WALK_SPEED * SIM_SPEEDUP * tick) / 1000);
      setPosition({ lngLat: pointAlong(simLine.line, simLine.cum, d), accuracy: 5 });
    }, tick);
    return () => clearInterval(id);
  }, [simLine]);

  // Progress along the route
  const progress = useMemo(() => {
    if (phase === "preview" || !active || !position) return null;
    const r = active.outdoor;
    const snap = snapToLine(r.line, r.cum, position.lngLat);
    const remaining = Math.max(0, r.total - snap.along);
    const nextIdx = r.stepAt.findIndex((at, i) => at > snap.along + 3 && r.steps[i].type !== "depart");
    const next = nextIdx >= 0 ? r.steps[nextIdx] : null;
    const a = r.line[Math.min(snap.segment, r.line.length - 2)];
    const b = r.line[Math.min(snap.segment + 1, r.line.length - 1)];
    return {
      snap,
      remaining,
      remainingTime: remaining / WALK_SPEED,
      next,
      toNext: next ? r.stepAt[nextIdx] - snap.along : remaining,
      heading: bearing(a, b),
      remainingLine: [snap.point, ...r.line.slice(snap.segment + 1)],
      toEntrance: distance(position.lngLat, active.entrance.lngLat),
    };
  }, [phase, active, position]);

  // Arrival + re-routing
  useEffect(() => {
    if (phase !== "navigating" || !progress || !position) return;
    if (progress.toEntrance < ARRIVE_M || (progress.remaining < 5 && progress.toEntrance < 40)) {
      setPhase("arrived");
      return;
    }
    if (source !== "gps") return;
    const off = progress.snap.offset > Math.max(OFF_ROUTE_M, position.accuracy ?? 0);
    offCount.current = off ? offCount.current + 1 : 0;
    if (offCount.current >= 2 && Date.now() - lastReroute.current > REROUTE_EVERY_MS) {
      lastReroute.current = Date.now();
      offCount.current = 0;
      const entrance = active.entrance;
      fetchWalkingRoute(position.lngLat, entrance.lngLat)
        .then((route) => setActive((a) => (a ? { ...a, outdoor: withTail(route, entrance), rerouted: true } : a)))
        .catch(() => {});
    }
  }, [phase, progress, position, source, active]);

  // Indoor part for the entrance being walked to (for time estimates + hand-off)
  const activeIndoor = active ? indoor[active.entrance.nodeId] ?? null : null;
  const activeIndoorRoute = active ? indoorFor(active.entrance.nodeId) : null;
  const indoorTime = activeIndoorRoute && !activeIndoorRoute.error ? activeIndoorRoute.duration ?? activeIndoorRoute.distance / indoorSpeed(stepFree) : 0;

  return { best, planning, error, phase, source, active, position, progress, gpsError, start, stop, indoor, activeIndoor, indoorTime };
}