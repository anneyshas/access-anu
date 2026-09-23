// Floating floor picker on the left of the map, top floor first (like the
// level picker in Google Maps). Shows "L1", "L2", ... with the full label
// as a tooltip.
export default function FloorSwitcher({ floors, activeFloor, onSelectFloor }) {
  const ordered = [...floors].sort((a, b) => b.number - a.number);
  return (
    <div className="floor-switcher" role="group" aria-label="Choose floor">
      {ordered.map((f) => (
        <button
          key={f.number}
          className={f.number === activeFloor ? "active" : ""}
          onClick={() => onSelectFloor(f.number)}
          title={f.label || `Level ${f.number}`}
        >
          L{f.number}
        </button>
      ))}
    </div>
  );
}
