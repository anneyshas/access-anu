// Floor picker, top floor first (like the level picker in Google Maps).
export default function FloorSwitcher({ floors, activeFloor, onSelectFloor }) {
  const ordered = [...floors].sort((a, b) => b.number - a.number);
  return (
    <div
      role="group"
      aria-label="Choose floor"
      className="absolute top-[124px] left-3 z-20 flex flex-col overflow-hidden rounded-lg bg-white shadow-map sm:left-4"
    >
      {ordered.map((f) => {
        const active = f.number === activeFloor;
        return (
          <button
            key={f.number}
            onClick={() => onSelectFloor(f.number)}
            title={f.label || `Level ${f.number}`}
            className={`h-10 w-11 border-b border-map-line text-[14px] font-medium last:border-b-0 ${
              active ? "bg-map-blue-soft text-map-blue" : "text-map-ink-2 hover:bg-map-hover"
            }`}
          >
            {f.number}
          </button>
        );
      })}
    </div>
  );
}