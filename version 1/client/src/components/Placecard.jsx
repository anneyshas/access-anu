import Icon from "./icons";
import { IconBadge } from "./mapIcons";
import { KIND_INFO } from "../places";

/**
 * Details for the selected place — bottom sheet on phones, floating card on
 * larger screens (like the place panel in Google Maps).
 */
export default function PlaceCard({ place, buildingName, onClose, onDirections }) {
  if (!place) return null;
  const info = KIND_INFO[place.kind];

  return (
    <div className="absolute inset-x-0 bottom-0 z-30 rounded-t-2xl bg-white p-4 shadow-map sm:inset-x-auto sm:bottom-6 sm:left-4 sm:w-[360px] sm:rounded-2xl">
      <div className="flex items-start gap-3">
        <IconBadge name={info.icon} color={info.badge} size={40} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[20px] leading-tight font-normal text-map-ink">{place.title}</h2>
          <p className="mt-0.5 truncate text-[13px] text-map-muted">
            {info.name} · {place.floorLabel} · {buildingName}
          </p>
        </div>
        <button
          onClick={onClose}
          className="-mt-1 -mr-1 grid size-9 place-items-center rounded-full text-map-muted hover:bg-map-hover"
          aria-label="Close"
        >
          <Icon name="close" />
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-[12px]">
        {place.stepFree ? (
          <span className="flex items-center gap-1 rounded-full bg-[#e6f4ea] px-2.5 py-1 font-medium text-map-green">
            <Icon name="accessible" className="size-4" /> Step-free access
          </span>
        ) : (
          <span className="flex items-center gap-1 rounded-full bg-map-hover px-2.5 py-1 font-medium text-map-ink-2">
            <Icon name="stairs" className="size-4" /> Stairs — not step-free
          </span>
        )}
        <span className="flex items-center gap-1 rounded-full bg-map-hover px-2.5 py-1 font-medium text-map-ink-2">
          <Icon name="layers" className="size-4" /> {place.floorLabel}
        </span>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          onClick={() => onDirections(place)}
          className="flex h-9 items-center gap-2 rounded-full bg-map-blue px-4 text-[14px] font-medium text-white hover:bg-[#1765cc]"
        >
          <Icon name="directions" className="size-[18px]" /> Directions
        </button>
      </div>
    </div>
  );
}