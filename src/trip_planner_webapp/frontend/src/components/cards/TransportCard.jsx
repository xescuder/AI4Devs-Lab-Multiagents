export default function TransportCard({ option, selected, onSelect }) {
  return (
    <div onClick={onSelect}
      className={`cursor-pointer rounded-xl border-2 p-5 transition-all duration-200 hover:shadow-md ${
        selected ? "border-indigo-500 bg-indigo-50/60 shadow-md" : "border-gray-200 bg-white hover:border-gray-300"
      }`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <span className="text-lg font-bold text-gray-800">{option.company}</span>
          {option.recommended && (
            <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
              ⭐ Recomendado
            </span>
          )}
        </div>
        <Radio checked={selected} />
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm mb-3">
        <p className="text-gray-600">🚗 <strong>{option.category}</strong></p>
        <p className="text-gray-600">Modelo: {option.model}</p>
        <p className="text-gray-600">⛽ {option.fuel_policy}</p>
        <p className="text-gray-600">🛡️ {option.insurance}</p>
        {option.deposit && <p className="text-gray-600 col-span-2">💳 Depósito: {option.deposit}</p>}
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        <div>
          <span className="text-2xl font-bold text-indigo-600">{option.price_per_day}€</span>
          <span className="text-sm text-gray-500 ml-1">/día</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">Total: <strong>{option.price_total}€</strong></span>
          {(option.rentalcars_url || option.kayak_url) && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                window.open(option.rentalcars_url || option.kayak_url, "car_preview", "width=550,height=750,scrollbars=yes,resizable=yes");
              }}
              className="text-xs bg-sky-100 hover:bg-sky-200 text-sky-700 font-medium px-2.5 py-1 rounded-full transition">
              🔍 Ver en Rentalcars
            </button>
          )}
        </div>
      </div>

      {option.reason && <p className="text-xs text-gray-500 mt-2 italic">{option.reason}</p>}
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
