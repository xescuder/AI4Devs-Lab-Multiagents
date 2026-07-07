import { useMemo } from "react";
import * as XLSX from "xlsx";

function tryParse(content) {
  if (!content) return null;
  try {
    let text = content.trim();
    text = text.replace(/```[\w]*\s*\n?/gi, "").replace(/```/g, "");
    const i = text.indexOf("{");
    const j = text.lastIndexOf("}");
    if (i !== -1 && j > i) return JSON.parse(text.slice(i, j + 1));
  } catch {}
  return null;
}

function findDaysInObj(obj) {
  if (!obj || typeof obj !== "object") return null;
  for (const key of ["days", "itinerary", "schedule", "dias"]) {
    if (Array.isArray(obj[key]) && obj[key].length > 0) return obj[key];
  }
  for (const val of Object.values(obj)) {
    if (Array.isArray(val) && val.length > 0 && val[0]?.day != null) return val;
    if (val && typeof val === "object" && !Array.isArray(val)) {
      const found = findDaysInObj(val);
      if (found) return found;
    }
  }
  return null;
}

function BudgetCard({ budget }) {
  if (!budget) return null;
  const items = [
    { label: "Vuelos", value: budget.flights, icon: "✈️", color: "bg-blue-50 text-blue-700" },
    { label: "Transporte", value: budget.transport, icon: "🚗", color: "bg-teal-50 text-teal-700" },
    { label: "Actividades", value: budget.activities, icon: "🎯", color: "bg-amber-50 text-amber-700" },
    { label: "Alojamiento", value: budget.accommodation, icon: "🏠", color: "bg-purple-50 text-purple-700" },
  ].filter(i => i.value != null);

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Presupuesto</h4>
      <div className="grid grid-cols-2 gap-2">
        {items.map(i => (
          <div key={i.label} className={`rounded-lg px-3 py-2.5 ${i.color}`}>
            <p className="text-xs opacity-70">{i.icon} {i.label}</p>
            <p className="text-lg font-bold">{i.value}€</p>
          </div>
        ))}
      </div>
      {budget.total != null && (
        <div className="bg-indigo-600 text-white rounded-lg px-4 py-3 flex items-center justify-between">
          <span className="font-medium">Total</span>
          <div className="text-right">
            <span className="text-2xl font-bold">{budget.total}€</span>
            {budget.per_person != null && (
              <span className="text-indigo-200 text-sm ml-2">({budget.per_person}€/pers)</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ItineraryOverview({ days }) {
  if (!days || days.length === 0) return null;
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Itinerario</h4>
      <div className="space-y-1">
        {days.map((day, i) => {
          const actCount = (day.free_activities?.length || 0) + (day.paid_activities?.length || 0);
          const typeIcon = day.type === "arrival" ? "🛬" : day.type === "departure" ? "🛫" : day.type === "rest" ? "🌿" : "📍";
          return (
            <div key={i} className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg text-sm">
              <span className="text-xs font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full w-14 text-center">
                Día {day.day || i + 1}
              </span>
              <span>{typeIcon}</span>
              <span className="flex-1 font-medium text-gray-700 truncate">{day.title || "—"}</span>
              {day.overnight_zone && (
                <span className="text-xs text-gray-400 truncate max-w-32">🌙 {day.overnight_zone}</span>
              )}
              {actCount > 0 && (
                <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">{actCount} act.</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FlightSummary({ data }) {
  const rec = data?.options?.find(o => o.recommended) || data?.options?.[0];
  if (!rec) return null;
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Vuelo seleccionado</h4>
      <div className="bg-blue-50 rounded-lg px-4 py-3">
        <p className="font-semibold text-blue-800">{rec.airline}</p>
        <div className="grid grid-cols-2 gap-2 mt-1 text-xs text-blue-600">
          <span>Ida: {rec.outbound?.date} {rec.outbound?.departure}→{rec.outbound?.arrival}</span>
          <span>Vuelta: {rec.return?.date} {rec.return?.departure}→{rec.return?.arrival}</span>
        </div>
        <p className="text-sm font-bold text-blue-700 mt-1">{rec.price_per_person}€/pers · {rec.price_total}€ total</p>
      </div>
    </div>
  );
}

function TransportSummary({ data }) {
  const rec = data?.options?.find(o => o.recommended) || data?.options?.[0];
  if (!rec) return null;
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Vehículo seleccionado</h4>
      <div className="bg-teal-50 rounded-lg px-4 py-3">
        <p className="font-semibold text-teal-800">{rec.company} · {rec.category}</p>
        <p className="text-xs text-teal-600">{rec.model} · {rec.fuel_policy}</p>
        <p className="text-sm font-bold text-teal-700 mt-1">{rec.price_per_day}€/día · {rec.price_total}€ total</p>
      </div>
    </div>
  );
}

function AccommodationOverview({ data }) {
  if (!data?.nights) return null;
  const zones = [...new Set(data.nights.map(n => n.zone))];
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Alojamientos</h4>
      <div className="bg-purple-50 rounded-lg px-4 py-3">
        <p className="text-sm text-purple-700">{data.nights.length} noches · {zones.length} zonas</p>
        <p className="text-xs text-purple-500 mt-1">{zones.join(" → ")}</p>
        {data.price_range && (
          <p className="text-sm font-bold text-purple-700 mt-1">{data.price_range.min}–{data.price_range.max}€/noche</p>
        )}
      </div>
    </div>
  );
}

function buildXlsWorkbook(stepData, report, tripConfig) {
  const wb = XLSX.utils.book_new();

  const summaryRows = [
    ["Plan de Viaje"],
    ["Origen", tripConfig?.pais_origen || report?.trip_summary?.origin || ""],
    ["Destino", tripConfig?.pais_destino || report?.trip_summary?.destination || ""],
    ["Fecha ida", tripConfig?.fecha_ida || report?.trip_summary?.dates?.departure || ""],
    ["Fecha vuelta", tripConfig?.fecha_vuelta || report?.trip_summary?.dates?.return || ""],
    ["Viajeros", tripConfig?.numero_adultos || report?.trip_summary?.travelers || ""],
    [],
    ["Presupuesto"],
    ["Concepto", "Importe (€)"],
  ];
  if (report?.budget) {
    for (const [k, v] of Object.entries(report.budget)) {
      if (typeof v === "number") summaryRows.push([k.charAt(0).toUpperCase() + k.slice(1), v]);
    }
  }
  if (report?.highlights?.length) {
    summaryRows.push([], ["Highlights"]);
    report.highlights.forEach((h, i) => summaryRows.push([`${i + 1}`, h]));
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryRows), "Resumen");

  const days = stepData.itinerary ? findDaysInObj(stepData.itinerary) : null;
  if (days) {
    const header = ["Día", "Título", "Hora", "Actividad", "Tipo", "Duración (min)", "Precio/pers (€)", "Ubicación", "Lat", "Lng"];
    const rows = [header];
    for (const day of days) {
      const allActs = [
        ...(day.free_activities || []).map(a => ({ ...a, _type: "Gratis" })),
        ...(day.paid_activities || []).map(a => ({ ...a, _type: "Pago" })),
      ].sort((a, b) => (a.start_time || "").localeCompare(b.start_time || ""));
      if (allActs.length === 0) {
        rows.push([day.day, day.title, "", "", day.type || "", "", "", day.overnight_zone || ""]);
      }
      for (const a of allActs) {
        rows.push([day.day, day.title, a.start_time || "", a.name, a._type, a.duration_minutes || "", a.price_per_person || 0, a.location || "", a.lat || "", a.lng || ""]);
      }
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "Itinerario");
  }

  if (stepData.accommodation?.nights) {
    const header = ["Noche", "Ciudad", "Zona", "Nombre", "Precio (€)", "Rating", "Superhost", "URL"];
    const rows = [header];
    for (const n of stepData.accommodation.nights) {
      for (const o of (n.options || [])) {
        rows.push([n.night, n.city, n.zone, o.name, o.price || "", o.rating || "", o.superhost ? "Sí" : "No", o.listing_url || ""]);
      }
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "Alojamientos");
  }

  const flight = stepData.flights;
  if (flight?.options) {
    const header = ["Aerolínea", "Ida Fecha", "Ida Salida", "Ida Llegada", "Ida Ruta", "Ida Escalas", "Vuelta Fecha", "Vuelta Salida", "Vuelta Llegada", "Precio/pers", "Precio total", "Equipaje"];
    const rows = [header];
    for (const o of flight.options) {
      rows.push([o.airline, o.outbound?.date, o.outbound?.departure, o.outbound?.arrival, o.outbound?.route, o.outbound?.stops, o.return?.date, o.return?.departure, o.return?.arrival, o.price_per_person, o.price_total, o.baggage]);
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "Vuelos");
  }

  const transport = stepData.transport;
  if (transport?.options) {
    const header = ["Empresa", "Categoría", "Modelo", "Combustible", "Seguro", "Precio/día", "Precio total"];
    const rows = [header];
    for (const o of transport.options) {
      rows.push([o.company, o.category, o.model, o.fuel_policy, o.insurance, o.price_per_day, o.price_total]);
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "Transporte");
  }

  return wb;
}

export default function Summary({ content, stepResults = [], tripConfig = {}, onNewTrip }) {
  const report = useMemo(() => tryParse(content), [content]);
  const stepData = useMemo(() => ({
    flights: tryParse(stepResults[0]),
    itinerary: tryParse(stepResults[1]),
    accommodation: tryParse(stepResults[2]),
    transport: tryParse(stepResults[3]),
  }), [stepResults]);

  const days = useMemo(() => stepData.itinerary ? findDaysInObj(stepData.itinerary) : null, [stepData.itinerary]);

  const handleDownloadXls = () => {
    const wb = buildXlsWorkbook(stepData, report, tripConfig);
    const dest = tripConfig?.pais_destino || "viaje";
    XLSX.writeFile(wb, `viaje_${dest.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="bg-gradient-to-r from-green-500 to-emerald-500 px-6 py-4 flex-shrink-0">
        <h3 className="text-white font-semibold text-lg">
          🎉 ¡Tu viaje a {tripConfig?.pais_destino || "destino"} está planificado!
        </h3>
        {tripConfig?.fecha_ida && (
          <p className="text-green-100 text-sm mt-0.5">
            {tripConfig.fecha_ida} → {tripConfig.fecha_vuelta} · {tripConfig.numero_adultos} viajero(s)
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {report?.warnings?.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
            <p className="text-sm font-semibold text-amber-800 mb-1">⚠️ Advertencias</p>
            <ul className="text-sm text-amber-700 space-y-0.5">
              {report.warnings.map((w, i) => <li key={i}>• {w}</li>)}
            </ul>
          </div>
        )}

        {report?.highlights?.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Momentos destacados</h4>
            <div className="grid grid-cols-1 gap-2">
              {report.highlights.map((h, i) => (
                <div key={i} className="flex items-start gap-2 bg-yellow-50 rounded-lg px-3 py-2">
                  <span className="text-lg">⭐</span>
                  <span className="text-sm text-gray-700">{h}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <BudgetCard budget={report?.budget} />
          <div className="space-y-6">
            <FlightSummary data={stepData.flights} />
            <TransportSummary data={stepData.transport} />
            <AccommodationOverview data={stepData.accommodation} />
          </div>
        </div>

        <ItineraryOverview days={days} />
      </div>

      <div className="border-t border-gray-100 bg-gray-50 p-4 flex gap-3 flex-shrink-0">
        <button onClick={handleDownloadXls}
          className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition">
          📥 Descargar Excel
        </button>
        <button onClick={onNewTrip}
          className="px-6 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium transition">
          🔄 Nuevo viaje
        </button>
      </div>
    </div>
  );
}
