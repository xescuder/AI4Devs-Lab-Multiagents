import { useState, useMemo } from "react";

function tryParse(content) {
  try {
    const s = content.trim();
    const i = s.indexOf("{");
    const j = s.lastIndexOf("}");
    if (i !== -1 && j > i) return JSON.parse(s.slice(i, j + 1));
  } catch {}
  return null;
}

function FlightSummary({ data }) {
  const rec = data.options?.find((o) => o.recommended) || data.options?.[0];
  if (!rec) return null;
  return (
    <div className="flex items-center gap-3">
      <span className="text-lg">✈️</span>
      <div className="text-xs">
        <p className="font-semibold text-gray-700">{rec.airline}</p>
        <p className="text-gray-500">{rec.outbound?.route} · {rec.outbound?.date}</p>
        <p className="text-indigo-600 font-bold">{rec.price_per_person}€/pers</p>
      </div>
    </div>
  );
}

function TransportSummary({ data }) {
  const rec = data.options?.find((o) => o.recommended) || data.options?.[0];
  if (!rec) return null;
  return (
    <div className="flex items-center gap-3">
      <span className="text-lg">🚗</span>
      <div className="text-xs">
        <p className="font-semibold text-gray-700">{rec.company} · {rec.category}</p>
        <p className="text-indigo-600 font-bold">{rec.price_per_day}€/día · Total {rec.price_total}€</p>
      </div>
    </div>
  );
}

function ActivitiesSummary({ data }) {
  if (!data.days) return null;
  const active = data.days.filter((d) => d.type !== "rest").length;
  const totalFree = data.days.reduce((s, d) => s + (d.free_activities?.length || 0), 0);
  const totalPaid = data.days.reduce((s, d) => s + (d.paid_activities?.length || 0), 0);
  return (
    <div className="flex items-center gap-3">
      <span className="text-lg">🎯</span>
      <div className="text-xs">
        <p className="font-semibold text-gray-700">{data.days.length} días · {totalFree} gratis · {totalPaid} de pago</p>
        {data.total_budget_per_person && (
          <p className="text-indigo-600 font-bold">{data.total_budget_per_person}€/pers</p>
        )}
      </div>
    </div>
  );
}

function AccommodationSummary({ data }) {
  if (!data.nights) return null;
  return (
    <div className="flex items-center gap-3">
      <span className="text-lg">🏠</span>
      <div className="text-xs">
        <p className="font-semibold text-gray-700">{data.nights.length} noches</p>
        {data.price_range && (
          <p className="text-indigo-600 font-bold">{data.price_range.min}–{data.price_range.max}€/noche</p>
        )}
      </div>
    </div>
  );
}

const STEP_LABELS = ["Vuelos", "Itinerario", "Alojamiento", "Transporte"];
const STEP_ICONS = ["✈️", "🗺️", "🏠", "🚗"];
const RENDERERS = [FlightSummary, ActivitiesSummary, AccommodationSummary, TransportSummary];

export default function TripSummaryBar({ stepResults, stepStates }) {
  const [expanded, setExpanded] = useState(false);

  const completedCount = stepStates.filter((s) => s === "done").length;
  if (completedCount === 0) return null;

  const parsedResults = stepResults.map((r) => (r ? tryParse(r) : null));

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm flex-shrink-0 overflow-hidden transition-all">
      {/* Toggle bar */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 transition"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-700">📋 Tu plan</span>
          <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
            {completedCount}/4 completado
          </span>
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-gray-100 px-4 py-3 grid grid-cols-2 gap-3">
          {STEP_LABELS.map((label, i) => {
            const isDone = stepStates[i] === "done";
            const Renderer = RENDERERS[i];
            const data = parsedResults[i];

            return (
              <div key={i} className={`rounded-lg p-2.5 ${isDone ? "bg-green-50 border border-green-200" : "bg-gray-50 border border-gray-100"}`}>
                {isDone && data && Renderer ? (
                  <Renderer data={data} />
                ) : isDone ? (
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{STEP_ICONS[i]}</span>
                    <span className="text-xs font-medium text-green-700">✓ {label} aprobado</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 opacity-40">
                    <span className="text-lg">{STEP_ICONS[i]}</span>
                    <span className="text-xs text-gray-500">{label} pendiente</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
