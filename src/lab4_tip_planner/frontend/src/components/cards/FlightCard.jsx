export default function FlightCard({ option, selected, onSelect, preferredDates }) {
  return (
    <div onClick={onSelect}
      className={`cursor-pointer rounded-xl border-2 p-5 transition-all duration-200 hover:shadow-md ${
        selected ? "border-indigo-500 bg-indigo-50/60 shadow-md" : "border-gray-200 bg-white hover:border-gray-300"
      }`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <span className="text-lg font-bold text-gray-800">{option.airline}</span>
          {option.recommended && (
            <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
              ⭐ Recomendado
            </span>
          )}
        </div>
        <Radio checked={selected} />
      </div>

      <div className="grid grid-cols-2 gap-4 mb-3">
        <Leg label="IDA" leg={option.outbound} preferredDate={preferredDates?.outbound} />
        <Leg label="VUELTA" leg={option.return} preferredDate={preferredDates?.return} />
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        <div className="flex items-center gap-3">
          <div>
            <span className="text-2xl font-bold text-indigo-600">{option.price_per_person}€</span>
            <span className="text-sm text-gray-500 ml-1">/persona</span>
          </div>
          {option.baggage && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              option.baggage.toLowerCase().includes("incluida")
                ? "bg-green-100 text-green-700"
                : option.baggage.toLowerCase().includes("mano")
                ? "bg-amber-100 text-amber-700"
                : "bg-red-100 text-red-700"
            }`}>
              {option.baggage.toLowerCase().includes("incluida") ? "🧳" : option.baggage.toLowerCase().includes("mano") ? "🎒" : "❌"} {option.baggage}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">Total: <strong>{option.price_total}€</strong></span>
          {(option.kayak_url || option.skyscanner_url) && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                window.open(option.kayak_url || option.skyscanner_url, "flight_preview", "width=550,height=750,scrollbars=yes,resizable=yes");
              }}
              className="text-xs bg-sky-100 hover:bg-sky-200 text-sky-700 font-medium px-2.5 py-1 rounded-full transition">
              🔍 Ver en Kayak
            </button>
          )}
        </div>
      </div>

      {option.reason && (
        <p className="text-xs text-gray-500 mt-2 italic">{option.reason}</p>
      )}
    </div>
  );
}

function Leg({ label, leg, preferredDate }) {
  if (!leg) return null;

  const isPreferred = preferredDate && leg.date === preferredDate;
  const daysDiff = preferredDate && leg.date ? dateDiff(preferredDate, leg.date) : null;

  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold text-gray-400 uppercase">{label}</p>
      <p className="text-sm font-medium text-gray-800">{leg.route}</p>
      <div className="flex items-center gap-2">
        <p className="text-sm text-gray-600">📅 {leg.date}</p>
        {isPreferred && (
          <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">
            ✓ Fecha preferida
          </span>
        )}
        {!isPreferred && daysDiff !== null && daysDiff !== 0 && (
          <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">
            {daysDiff > 0 ? `+${daysDiff}d` : `${daysDiff}d`} vs preferida
          </span>
        )}
      </div>
      <p className="text-sm text-gray-600">🕐 {leg.departure} → {leg.arrival} ({leg.duration})</p>
      <p className={`text-xs font-medium ${leg.stops === "Directo" ? "text-green-600" : "text-amber-600"}`}>
        {leg.stops}
      </p>
    </div>
  );
}

function dateDiff(preferred, actual) {
  try {
    const d1 = new Date(preferred);
    const d2 = new Date(actual);
    return Math.round((d2 - d1) / 86400000);
  } catch {
    return null;
  }
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
