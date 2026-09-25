import { useMemo, useState } from "react";
import Icon from "./icons";
import { IconBadge } from "./mapIcons";
import { KIND_INFO, routeMinutes, searchPlaces } from "../places";

const STEP_ICON = { start: "origin", walk: "walk", lift: "lift", stairs: "stairs", arrive: "flag" };

function Mode({ active, icon, label, route, loading, onClick }) {
  const stepFree = icon === "accessible";
  let detail = "…";
  if (!loading) detail = route?.error ? "No route" : route ? `${routeMinutes(route, stepFree)} min` : "—";
  return (
    <button
      onClick={onClick}
      className={`flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full px-3 text-[13px] font-medium transition-colors ${
        active ? "bg-map-blue-soft text-map-blue" : "text-map-ink-2 hover:bg-map-hover"
      }`}
      title={label}
    >
      <Icon name={icon} className="size-[18px]" />
      <span>{label}</span>
      <span className={active ? "" : "text-map-muted"}>· {detail}</span>
    </button>
  );
}

// "From" / "To" field: shows the chosen place, or a search box to pick one.
function PlaceField({ icon, iconClass, value, placeholder, places, editing, onEdit, onPick }) {
  const [query, setQuery] = useState("");
  const results = useMemo(() => (query ? searchPlaces(places, query).slice(0, 8) : []), [places, query]);
  return (
    <div className="relative flex items-center gap-2">
      <span className={`grid size-6 shrink-0 place-items-center ${iconClass}`}>
        <Icon name={icon} className="size-4" />
      </span>
      {editing ? (
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onBlur={() => setTimeout(() => onEdit(false), 150)}
          placeholder={placeholder}
          className="h-10 min-w-0 flex-1 rounded-lg border border-map-blue bg-white px-3 text-[14px] outline-none"
        />
      ) : (
        <button
          onClick={() => onEdit(true)}
          className="h-10 min-w-0 flex-1 truncate rounded-lg border border-map-line px-3 text-left text-[14px] hover:bg-map-hover"
        >
          {value ? (
            <>
              {value.title} <span className="text-map-muted">· {value.floorLabel}</span>
            </>
          ) : (
            <span className="text-map-muted">{placeholder}</span>
          )}
        </button>
      )}
      {editing && results.length > 0 && (
        <div className="absolute top-11 right-0 left-8 z-10 max-h-64 overflow-y-auto rounded-xl bg-white py-1 shadow-map">
          {results.map((p) => (
            <button
              key={p.key}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                document.activeElement?.blur(); // close the phone keyboard
                onPick(p);
                setQuery("");
                onEdit(false);
              }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-map-hover"
            >
              <IconBadge name={KIND_INFO[p.kind].icon} color={KIND_INFO[p.kind].badge} size={24} />
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-medium">{p.title}</span>
                <span className="block truncate text-[11px] text-map-muted">{p.subtitle}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Google-Maps-style directions: From/To, Step-free vs Fastest, and the
 * turn-by-turn steps. Clicking a step shows that floor.
 */
export default function DirectionsPanel({
  from,
  to,
  places,
  stepFree,
  routes,
  loading,
  picking,
  onPicking,
  onFrom,
  onTo,
  onSwap,
  onMode,
  onClose,
  onStep,
  activeFloor,
}) {
  const route = stepFree ? routes.stepFree : routes.fastest;
  const [open, setOpen] = useState(false); // steps list on phones

  const steps = route && !route.error && (
    <ol className="space-y-0.5">
      {route.steps.map((s, i) => {
        const here = s.floor === activeFloor;
        return (
          <li key={i}>
            <button
              onClick={() => onStep(s)}
              className={`flex w-full items-start gap-3 rounded-lg px-2 py-2 text-left hover:bg-map-hover ${here ? "" : "opacity-70"}`}
            >
              <span
                className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-full ${
                  s.kind === "arrive" ? "bg-map-red text-white" : s.kind === "lift" || s.kind === "stairs" ? "bg-map-blue text-white" : "bg-map-hover text-map-ink-2"
                }`}
              >
                <Icon name={STEP_ICON[s.kind]} className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] text-map-ink">{s.text}</span>
                <span className="block text-[12px] text-map-muted">Level {s.floor}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );

  return (
    <>
      <div data-overlay="top" className="absolute top-3 right-3 left-3 z-30 flex max-h-[calc(100%-24px)] max-w-[400px] flex-col rounded-2xl bg-white shadow-map sm:top-4 sm:left-4">
        <div className="flex items-start gap-1 p-3 pb-2">
          <button onClick={onClose} className="grid size-9 shrink-0 place-items-center rounded-full text-map-muted hover:bg-map-hover" aria-label="Close directions">
            <Icon name="back" />
          </button>
          <div className="min-w-0 flex-1 space-y-2">
            <PlaceField
              icon="origin"
              iconClass="text-map-muted"
              value={from}
              placeholder="Choose starting point, or tap the map"
              places={places}
              editing={picking === "from"}
              onEdit={(on) => onPicking(on ? "from" : null)}
              onPick={onFrom}
            />
            <PlaceField
              icon="place"
              iconClass="text-map-red"
              value={to}
              placeholder="Choose destination"
              places={places}
              editing={picking === "to"}
              onEdit={(on) => onPicking(on ? "to" : null)}
              onPick={onTo}
            />
          </div>
          <button onClick={onSwap} className="mt-6 grid size-9 shrink-0 place-items-center rounded-full text-map-muted hover:bg-map-hover" aria-label="Swap start and destination" title="Swap">
            <Icon name="swap" />
          </button>
        </div>

        <div className="flex gap-1 border-b border-map-line px-3 pb-3">
          <Mode active={stepFree} icon="accessible" label="Step-free" route={routes.stepFree} loading={loading} onClick={() => onMode(true)} />
          <Mode active={!stepFree} icon="walk" label="Fastest" route={routes.fastest} loading={loading} onClick={() => onMode(false)} />
        </div>

        <div className="min-h-0 overflow-y-auto px-2 py-2">
          {loading && <p className="px-2 py-2 text-[13px] text-map-muted">Finding a route…</p>}
          {!loading && !from && <p className="px-2 py-2 text-[13px] text-map-muted">Choose a starting point — search above, or tap a room on the map.</p>}
          {!loading && route?.error && (
            <p className="px-2 py-2 text-[13px] text-map-red">
              {route.error}.{stepFree && " Try Fastest, which can use stairs."}
            </p>
          )}
          {!loading && route && !route.error && (
            <>
              <div className="flex items-baseline gap-2 px-2 pb-2">
                <span className="text-[20px] text-map-green">{routeMinutes(route, stepFree)} min</span>
                <span className="text-[13px] text-map-muted">
                  ({route.distance} m{route.floors.length > 1 ? ` · ${route.floors.length} floors` : ""})
                </span>
                {stepFree && (
                  <span className="ml-auto flex items-center gap-1 text-[12px] font-medium text-map-green">
                    <Icon name="accessible" className="size-4" /> No stairs
                  </span>
                )}
              </div>
              <div className="hidden sm:block">{steps}</div>
              <button onClick={() => setOpen((o) => !o)} className="mx-2 mb-1 text-[13px] font-medium text-map-blue sm:hidden">
                {open ? "Hide steps" : `Show ${route.steps.length} steps`}
              </button>
              {open && <div className="sm:hidden">{steps}</div>}
            </>
          )}
        </div>
      </div>
    </>
  );
}