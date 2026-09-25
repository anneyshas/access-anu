// Floor picker, top floor first (like the level picker in Google Maps).
// Floors on the current route get a small blue dot.
// placement "left" sits under the search box; "right" sits above the zoom
// buttons (used while the directions panel covers the top-left).
export default function FloorSwitcher({ floors, activeFloor, onSelectFloor, routeFloors = [], placement = "left" }) {
  const ordered = [...floors].sort((a, b) => b.number - a.number);
  const where = placement === "right" ? "right-3 bottom-44 sm:right-4" : "top-[124px] left-3 sm:left-4";
  return (
    <div
      role="group"
      aria-label="Choose floor"
      className={`absolute z-20 flex flex-col overflow-hidden rounded-lg bg-white shadow-map ${where}`}
    >
      {ordered.map((f) => {
        const active = f.number === activeFloor;
        const onRoute = routeFloors.includes(f.number);
        return (
          <button
            key={f.number}
            onClick={() => onSelectFloor(f.number)}
            title={f.label || `Level ${f.number}`}
            className={`relative h-10 w-11 border-b border-map-line text-[14px] font-medium last:border-b-0 ${
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