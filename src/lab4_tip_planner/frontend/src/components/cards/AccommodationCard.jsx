import { useState } from "react";

function getNightDate(startDate, nightNum) {
  if (!startDate) return null;
  try {
    const d = new Date(startDate);
    d.setDate(d.getDate() + nightNum - 1);
    return d.toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" });
  } catch { return null; }
}

export default function AccommodationCard({ data, totalNights, selected, onSelect, startDate }) {
  const [activeNight, setActiveNight] = useState(0);

  const numNights = totalNights || data?.nights?.length || 1;
  const nights = data?.nights || [];

  return (
    <div className="space-y-4">
      {/* Night tabs — all visible from the start */}
      <div>
        <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-2">
          Alojamiento por noche ({nights.length}/{numNights} completadas):
        </p>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {Array.from({ length: numNights }, (_, i) => {
            const night = nights.find((n) => n.night === i + 1);
            const isLoaded = !!night;
            const hasSelection = selected[i] != null;
            const isActive = activeNight === i;

            return (
              <button key={i} onClick={() => isLoaded && setActiveNight(i)}
                className={`relative px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all border ${
                  isActive && isLoaded
                    ? "bg-indigo-100 text-indigo-700 border-indigo-400 shadow-sm"
                    : hasSelection
                    ? "bg-green-50 text-green-700 border-green-300"
                    : isLoaded
                    ? "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
                    : "bg-gray-50 text-gray-300 border-gray-100 cursor-wait"
                }`}>
                <span className="flex items-center gap-1">
                  {!isLoaded && <span className="inline-block w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />}
                  {startDate ? getNightDate(startDate, i + 1) : `Noche ${i + 1}`}
                </span>
                {isLoaded && night.city && (
                  <span className="block text-[10px] opacity-70">{night.city}</span>
                )}
                {!isLoaded && (
                  <span className="block text-[10px] opacity-50">Buscando...</span>
                )}
                {hasSelection && !isActive && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full text-white text-[9px] flex items-center justify-center">✓</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Options for active night */}
      {(() => {
        const activeData = nights.find((n) => n.night === activeNight + 1);
        if (!activeData) {
          return (
            <div className="flex items-center justify-center py-10 text-gray-400">
              <div className="text-center">
                <div className="text-3xl mb-2 animate-pulse">🏠</div>
                <p className="text-sm">Buscando alojamientos para la noche {activeNight + 1}...</p>
              </div>
            </div>
          );
        }

        return (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-700">
                📍 {activeData.city} — {activeData.zone}
              </p>
              <p className="text-xs text-gray-400">
                Noche {activeData.night} de {numNights}
              </p>
            </div>

            {activeData.options.map((opt, j) => {
              const isSelected = selected[activeNight] === j;
              return (
                <div key={`${activeNight}-${j}`} onClick={() => onSelect(activeNight, j)}
                  className={`cursor-pointer rounded-xl border-2 p-4 transition-all hover:shadow-md ${
                    isSelected ? "border-indigo-500 bg-indigo-50/60 shadow-md" : "border-gray-200 bg-white hover:border-gray-300"
                  }`}>
                  <div className="flex gap-4">
                    <div className="w-32 h-24 flex-shrink-0 rounded-lg overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200 relative">
                      {(opt.image_url || opt.image) ? (
                        <img
                          src={opt.image_url || opt.image}
                          alt={opt.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.target.style.display = "none";
                            e.target.nextSibling.style.display = "flex";
                          }}
                        />
                      ) : null}
                      <div className={`w-full h-full items-center justify-center flex-col ${(opt.image_url || opt.image) ? "hidden" : "flex"}`}>
                        <span className="text-2xl">
                          {opt.name?.toLowerCase().includes("casa") || opt.name?.toLowerCase().includes("cabaña") ? "🏡"
                          : opt.name?.toLowerCase().includes("estudio") || opt.name?.toLowerCase().includes("loft") ? "🏢"
                          : "🏠"}
                        </span>
                        <span className="text-[9px] text-gray-400 mt-0.5">Sin imagen</span>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-800">{opt.name}</span>
                          {opt.superhost && (
                            <span className="text-xs bg-pink-100 text-pink-700 px-1.5 py-0.5 rounded-full">🏆 Superhost</span>
                          )}
                        </div>
                        <Radio checked={isSelected} />
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">📍 {opt.neighborhood}</p>
                      <div className="flex gap-1.5 mt-1">
                        {opt.private_bathroom && (
                          <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">🚿 Baño privado</span>
                        )}
                        {opt.kitchen && (
                          <span className="text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full">🍳 Cocina</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{opt.description}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-lg font-bold text-indigo-600">{opt.price}€<span className="text-xs text-gray-400 font-normal">/noche</span></span>
                        {opt.rating && <span className="text-xs text-amber-600">⭐ {opt.rating}</span>}
                        {opt.listing_url && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(opt.listing_url, "airbnb_preview", "width=500,height=700,scrollbars=yes,resizable=yes");
                            }}
                            className="text-xs bg-pink-100 hover:bg-pink-200 text-pink-700 font-medium px-2.5 py-1 rounded-full transition">
                            🏠 Ver en Airbnb
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* Summary bar */}
      <div className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-2.5 border border-gray-200">
        <span className="text-sm text-gray-600">
          {Object.keys(selected).length} de {numNights} noches seleccionadas
        </span>
        {data?.price_range && (
          <span className="text-sm text-gray-500">
            Rango: <strong className="text-indigo-600">{data.price_range.min}€</strong> – <strong className="text-indigo-600">{data.price_range.max}€</strong>/noche
          </span>
        )}
      </div>
    </div>
  );
}

function Radio({ checked }) {
  return (
    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
      checked ? "border-indigo-500 bg-indigo-500" : "border-gray-300"
    }`}>
      {checked && (
        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      )}
    </div>
  );
}
