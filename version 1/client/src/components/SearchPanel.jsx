import { useMemo, useState } from "react";
import Icon from "./icons";
import { IconBadge } from "./mapIcons";
import { CATEGORIES, KIND_INFO, searchPlaces } from "../places";

/**
 * Google-Maps-style search card: back button, search box, category chips,
 * and a results list spanning every floor of the building.
 */
export default function SearchPanel({ buildingName, places, category, onCategory, onPick, onBack }) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);

  const results = useMemo(() => searchPlaces(places, query, category), [places, query, category]);
  const open = (focused && query.trim().length > 0) || Boolean(category);

  const pick = (p) => {
    document.activeElement?.blur(); // close the phone keyboard so the place card is visible
    onPick(p);
    setQuery("");
    setFocused(false);
    onCategory(null);
  };

  return (
    <div data-overlay="top" className="pointer-events-none absolute top-3 left-3 right-3 z-30 flex max-w-[400px] flex-col gap-2 sm:top-4 sm:left-4">
      <div className="pointer-events-auto flex h-12 items-center gap-1 rounded-full bg-white pr-2 pl-1 shadow-map">
        <button
          onClick={onBack}
          className="grid size-10 place-items-center rounded-full text-map-muted hover:bg-map-hover"
          aria-label="Back to campus map"
          title="Back to campus map"
        >
          <Icon name="back" />
        </button>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder={`Search ${buildingName}`}
          className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-map-ink outline-none placeholder:text-map-muted"
        />
        {query ? (
          <button
            onClick={() => setQuery("")}
            className="grid size-10 place-items-center rounded-full text-map-muted hover:bg-map-hover"
            aria-label="Clear search"
          >
            <Icon name="close" />
          </button>
        ) : (
          <span className="grid size-10 place-items-center text-map-blue">
            <Icon name="search" />
          </span>
        )}
      </div>

      <div className="pointer-events-auto -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {CATEGORIES.map((c) => {
          const active = category === c.id;
          return (
            <button
              key={c.id}
              onClick={() => onCategory(active ? null : c.id)}
              className={`flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium shadow-map transition-colors ${
                active ? "bg-map-blue-soft text-map-blue" : "bg-white text-map-ink-2 hover:bg-map-hover"
              }`}
            >
              <IconBadge name={KIND_INFO[c.kinds[0]].icon} color={KIND_INFO[c.kinds[0]].badge} size={18} />
              {c.label}
            </button>
          );
        })}
      </div>

      {open && (
        <div className="pointer-events-auto max-h-[55vh] overflow-y-auto rounded-2xl bg-white py-2 shadow-map">
          {results.length === 0 ? (
            <div className="px-4 py-3 text-sm text-map-muted">No places match “{query}”.</div>
          ) : (
            results.map((p) => (
              <button
                key={p.key}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(p)}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-map-hover"
              >
                <IconBadge name={KIND_INFO[p.kind].icon} color={KIND_INFO[p.kind].badge} size={30} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-medium text-map-ink">{p.title}</span>
                  <span className="block truncate text-[12px] text-map-muted">{p.subtitle}</span>
                </span>
                {p.stepFree && (
                  <span className="text-map-muted" title="Step-free access">
                    <Icon name="accessible" className="size-4" />
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}