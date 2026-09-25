// Floor picker, top floor first (like the level picker in Google Maps).
// Floors on the current route get a small blue dot.
//
// Always on the right edge. BuildingView measures the panels around it and
// passes `top` / `maxHeight` so it never sits under the search box, the
// directions panel, the place card or the zoom buttons; if space is short the
// list scrolls instead of overlapping.
export default function FloorSwitcher({ floors, activeFloor, onSelectFloor, routeFloors = [], top = 16, maxHeight }) {
  const ordered = [...floors].sort((a, b) => b.number - a.number);
  return (
    <div
      role="group"
      aria-label="Choose floor"
      style={{ top, maxHeight }}
      className="absolute right-3 z-20 flex flex-col overflow-y-auto rounded-lg bg-white shadow-map sm:right-4"
    >
      {ordered.map((f) => {
        const active = f.number === activeFloor;
        const onRoute = routeFloors.includes(f.number);
        return (
          <button
            key={f.number}
            onClick={() => onSelectFloor(f.number)}
            title={f.label || `Level ${f.number}`}
            className={`relative h-10 w-11 shrink-0 border-b border-map-line text-[14px] font-medium last:border-b-0 ${
              active ? "bg-map-blue-soft text-map-blue" : "text-map-ink-2 hover:bg-map-hover"
            }`}
          >
            {f.number}
            {onRoute && <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-map-blue" />}
          </button>
        );
      })}
    </div>
  );
}