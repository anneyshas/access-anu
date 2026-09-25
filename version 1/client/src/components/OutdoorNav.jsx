// Panels for outdoor navigation: the route preview, the turn-by-turn banner
// while walking, and the "you've arrived" card that hands over to the indoor map.
import { useEffect, useState } from "react";
import Icon from "./icons";
import { formatDistance, formatMinutes } from "../lib/geo";
import { shortName } from "../lib/campus";

const turnIcon = (step) => {
  if (!step) return "flag";
  if (step.type === "arrive") return "flag";
  if (step.modifier?.includes("left")) return "turnLeft";
  if (step.modifier?.includes("right")) return "turnRight";
  return "straight";
};

const clock = (secondsFromNow) =>
  new Date(Date.now() + secondsFromNow * 1000).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

function ModePills({ stepFree, onMode, best }) {
  return (
    <div className="flex gap-2">
      {[
        { on: true, label: "Step-free", icon: "accessible" },
        { on: false, label: "Fastest", icon: "walk" },
      ].map((m) => (
        <button
          key={m.label}
          onClick={() => onMode(m.on)}
          className={`flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium ${
            stepFree === m.on ? "border-map-blue-soft bg-map-blue-soft text-map-blue" : "border-map-line text-map-ink-2 hover:bg-map-hover"
          }`}
        >
          <Icon name={m.icon} className="size-4" /> {m.label}
          {stepFree === m.on && best && !best.none && <span className="font-normal">· {formatMinutes(best.totalTime)}</span>}
        </button>
      ))}
    </div>
  );
}

// ---- Route preview (before starting) ----------------------------------------
function Preview({ dest, origin, originStatus, onUseMyLocation, onPickOnMap, picking, stepFree, onMode, nav, onClose }) {
  const { best, planning, error } = nav;
  const ready = best && !best.none;
  return (
    <div className="absolute top-0 left-0 z-20 w-full bg-white shadow-map sm:top-4 sm:left-4 sm:w-[400px] sm:rounded-2xl">
      <div className="flex items-center gap-2 px-2 pt-2">
        <button onClick={onClose} className="grid size-10 place-items-center rounded-full text-map-ink-2 hover:bg-map-hover" aria-label="Close directions">
          <Icon name="back" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[16px] font-medium">{dest.place.title}</div>
          <div className="truncate text-[12px] text-map-muted">
            {dest.place.floorLabel} · {shortName(dest.building.name)}
          </div>
        </div>
      </div>

      <div className="space-y-2 px-4 pt-2 pb-3">
        {/* From */}
        <div className="flex items-center gap-3">
          <span className="grid size-6 place-items-center">
            <span className="size-3.5 rounded-full border-[3px] border-white bg-map-blue shadow-[0_0_0_1px_#1a73e8]" />
          </span>
          <div className="min-w-0 flex-1 rounded-lg bg-map-hover px-3 py-2 text-[14px]">
            {picking ? (
              <span className="text-map-blue">Tap the map where you are…</span>
            ) : origin ? (
              <span>{origin.label}</span>
            ) : originStatus === "locating" ? (
              <span className="text-map-muted">Finding your location…</span>
            ) : (
              <span className="text-map-muted">Choose a starting point</span>
            )}
          </div>
        </div>
        <div className="flex gap-2 pl-9">
          <button onClick={onUseMyLocation} className="flex h-8 items-center gap-1.5 rounded-full border border-map-line px-3 text-[13px] font-medium text-map-blue hover:bg-map-hover">
            <Icon name="myLocation" className="size-4" /> My location
          </button>
          <button
            onClick={onPickOnMap}
            className={`flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium hover:bg-map-hover ${picking ? "border-map-blue text-map-blue" : "border-map-line text-map-ink-2"}`}
          >
            <Icon name="pin" className="size-4" /> Choose on map
          </button>
        </div>
        {originStatus && originStatus !== "ok" && originStatus !== "locating" && (
          <p className="pl-9 text-[12px] text-map-red">{originStatus}</p>
        )}

        {/* To */}
        <div className="flex items-center gap-3">
          <span className="grid size-6 place-items-center text-map-red">
            <Icon name="place" className="size-5" />
          </span>
          <div className="min-w-0 flex-1 truncate rounded-lg bg-map-hover px-3 py-2 text-[14px]">
            {dest.place.title}, {dest.place.floorLabel}
          </div>
        </div>

        <div className="pt-1 pl-9">
          <ModePills stepFree={stepFree} onMode={onMode} best={best} />
        </div>
      </div>

      <div className="border-t border-map-line px-4 py-3">
        {!origin ? (
          <p className="text-[13px] text-map-muted">Set where you're starting from to see the route.</p>
        ) : planning ? (
          <p className="text-[13px] text-map-muted">Finding the best route…</p>
        ) : error ? (
          <p className="text-[13px] text-map-red">{error}</p>
        ) : best?.none ? (
          <p className="text-[13px] text-map-red">{stepFree ? "No step-free route to this place." : "No route found."}</p>
        ) : ready ? (
          <>
            <div className="flex items-baseline gap-2">
              <span className="text-[20px] text-map-green">{formatMinutes(best.totalTime)}</span>
              <span className="text-[13px] text-map-muted">
                {formatDistance(best.outdoor.total)} outside · {formatDistance(best.indoorRoute.distance)} inside
              </span>
            </div>
            <p className="mt-0.5 text-[13px] text-map-ink-2">
              Walk to the <b className="font-medium">{best.entrance.name}</b>, then {indoorSummary(best.indoorRoute)}
            </p>
            <p className="mt-1 text-[12px] text-map-muted">Outdoor paths come from Mapbox and may include steps or kerbs.</p>
            <div className="mt-3 flex gap-2">
              <button onClick={() => nav.start("gps")} className="flex h-10 items-center gap-2 rounded-full bg-map-blue px-5 text-[14px] font-medium text-white hover:bg-[#1765cc]">
                <Icon name="navigation" className="size-[18px]" /> Start
              </button>
              <button onClick={() => nav.start("sim")} className="flex h-10 items-center gap-2 rounded-full border border-map-line px-4 text-[14px] font-medium text-map-blue hover:bg-map-hover">
                <Icon name="play" className="size-[18px]" /> Demo walk
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

function indoorSummary(route) {
  const change = route.steps.find((s) => s.kind === "lift" || s.kind === "stairs");
  if (!change) return "follow the indoor map to the room.";
  return `${change.text.charAt(0).toLowerCase()}${change.text.slice(1)}.`;
}

// ---- While walking ----------------------------------------------------------
function Navigating({ dest, nav, following, onRecenter, onEnd }) {
  const { progress, active, source, gpsError } = nav;
  const next = progress?.next;
  return (
    <>
      <div className="absolute top-0 left-0 z-20 w-full p-2 sm:top-4 sm:left-4 sm:w-[400px] sm:p-0">
        <div className="flex items-center gap-3 rounded-2xl bg-[#0b8043] px-4 py-3 text-white shadow-map">
          <Icon name={turnIcon(next)} className="size-9 shrink-0" />
          <div className="min-w-0">
            <div className="text-[22px] leading-tight font-medium">{progress ? formatDistance(progress.toNext) : "…"}</div>
            <div className="text-[15px] leading-snug">
              {next && next.type !== "arrive" ? next.text : `Arrive at the ${active.entrance.name}`}
            </div>
          </div>
        </div>
        {source === "sim" && <div className="mt-2 inline-block rounded-full bg-white px-3 py-1 text-[12px] font-medium text-map-ink-2 shadow-map">Demo walk · {6}× speed</div>}
        {gpsError && <div className="mt-2 rounded-lg bg-map-red px-3 py-2 text-[13px] text-white shadow-map">{gpsError}</div>}
        {active.rerouted && source === "gps" && <div className="mt-2 inline-block rounded-full bg-white px-3 py-1 text-[12px] text-map-ink-2 shadow-map">Route updated</div>}
      </div>

      {!following && (
        <button onClick={onRecenter} className="absolute right-3 bottom-40 z-20 flex h-10 items-center gap-2 rounded-full bg-white px-4 text-[14px] font-medium text-map-blue shadow-map sm:bottom-32">
          <Icon name="navigation" className="size-[18px]" /> Re-centre
        </button>
      )}

      <div className="absolute inset-x-0 bottom-0 z-20 rounded-t-2xl bg-white px-4 py-3 shadow-map sm:inset-x-auto sm:bottom-6 sm:left-4 sm:w-[400px] sm:rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-[20px] text-map-green">
              {progress ? formatMinutes(progress.remainingTime + active.indoorTime) : "…"}
              <span className="ml-2 text-[14px] text-map-muted">
                {progress && `${formatDistance(progress.remaining)} · arrive ${clock(progress.remainingTime + active.indoorTime)}`}
              </span>
            </div>
            <div className="truncate text-[13px] text-map-ink-2">
              Then inside: {dest.place.title}, {dest.place.floorLabel}
            </div>
          </div>
          <button onClick={onEnd} className="h-10 rounded-full bg-[#fce8e6] px-5 text-[14px] font-medium text-[#c5221f] hover:bg-[#fad2cf]">
            End
          </button>
        </div>
      </div>
    </>
  );
}

// ---- Arrived: hand over to the indoor map --------------------------------------
function Arrived({ dest, nav, onEnter, onEnd }) {
  const [count, setCount] = useState(5);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return;
    if (count <= 0) {
      onEnter();
      return;
    }
    const t = setTimeout(() => setCount((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [count, paused, onEnter]);

  return (
    <div className="absolute inset-x-0 bottom-0 z-20 rounded-t-2xl bg-white p-4 shadow-map sm:inset-x-auto sm:bottom-6 sm:left-4 sm:w-[400px] sm:rounded-2xl">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#e6f4ea] text-map-green">
          <Icon name="flag" />
        </span>
        <div className="min-w-0">
          <h2 className="text-[18px] leading-tight">You've arrived</h2>
          <p className="mt-0.5 text-[13px] text-map-muted">
            {shortName(dest.building.name)} · {nav.active.entrance.name}
          </p>
        </div>
      </div>
      <p className="mt-3 text-[14px] text-map-ink-2">
        Next: indoor directions to <b className="font-medium">{dest.place.title}</b> ({dest.place.floorLabel}).
      </p>
      <div className="mt-3 flex gap-2">
        <button onClick={onEnter} className="flex h-10 items-center gap-2 rounded-full bg-map-blue px-5 text-[14px] font-medium text-white hover:bg-[#1765cc]">
          <Icon name="layers" className="size-[18px]" /> Continue inside{!paused && ` (${count})`}
        </button>
        <button
          onClick={() => {
            setPaused(true);
            onEnd();
          }}
          className="h-10 rounded-full border border-map-line px-4 text-[14px] font-medium text-map-ink-2 hover:bg-map-hover"
        >
          Stay outside
        </button>
      </div>
    </div>
  );
}

export default function OutdoorNav(props) {
  const { nav } = props;
  if (nav.phase === "arrived") return <Arrived {...props} />;
  if (nav.phase === "navigating") return <Navigating {...props} />;
  return <Preview {...props} />;
}