import { useState } from "react";

function formatDuration(minutes) {
  if (minutes < 60) return `${minutes}min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

function TimeSlot({ time, duration }) {
  return (
    <div className="flex flex-col items-center w-14 flex-shrink-0">
      <span className="text-xs font-bold text-gray-700">{time}</span>
      <div className="w-px h-3 bg-gray-300" />
      <span className="text-[10px] text-gray-400">{formatDuration(duration)}</span>
    </div>
  );
}

function ActivityRow({ activity, type, checked, onToggle }) {
  const isFree = type === "free";
  return (
    <div className={`flex items-start gap-3 py-2.5 px-3 rounded-lg transition-all ${
      checked ? "" : "opacity-50"
    } ${isFree ? "bg-green-50/50" : "bg-amber-50/50"}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="mt-1 w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
      />
      {activity.image_url && (
        <div className="w-14 h-14 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100">
          <img src={activity.image_url} alt={activity.name} className="w-full h-full object-cover"
            onError={(e) => { e.target.onerror = null; e.target.parentElement.innerHTML = '<div class="w-full h-full flex items-center justify-center text-lg text-gray-300">📍</div>'; }} />
        </div>
      )}
      <TimeSlot time={activity.start_time} duration={activity.duration_minutes} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`font-medium text-sm ${checked ? "text-gray-800" : "text-gray-400 line-through"}`}>
            {activity.name}
          </span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
            isFree ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
          }`}>
            {isFree ? "Gratis" : `${activity.price_per_person}€/pers`}
          </span>
        </div>
        <p className="text-xs text-gray-500 mt-0.5">{activity.description}</p>
        {activity.tip && <p className="text-xs text-indigo-500 mt-0.5">💡 {activity.tip}</p>}
      </div>
    </div>
  );
}

function DayTimetable({ day, selections, onToggle }) {
  const allActivities = [
    ...(day.free_activities || []).map((a) => ({ ...a, _type: "free" })),
    ...(day.paid_activities || []).map((a) => ({ ...a, _type: "paid" })),
  ].sort((a, b) => (a.start_time || "").localeCompare(b.start_time || ""));

  const selectedActs = allActivities.filter((_, i) => selections[i] !== false);
  const totalMinutes = selectedActs.reduce((s, a) => s + (a.duration_minutes || 0), 0);
  const totalCost = selectedActs
    .filter((a) => a._type === "paid")
    .reduce((s, a) => s + (a.price_per_person || 0), 0);

  return (
    <div className={`rounded-xl border-2 overflow-hidden ${
      day.type === "rest" ? "border-green-200" : "border-gray-200"
    }`}>
      {/* Day header */}
      <div className={`px-4 py-2.5 flex items-center justify-between ${
        day.type === "rest" ? "bg-green-50" : "bg-gray-50"
      }`}>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold bg-indigo-100 text-indigo-700 px-2.5 py-0.5 rounded-full">
            Día {day.day}
          </span>
          <span className="font-semibold text-gray-800 text-sm">{day.title}</span>
          {day.type === "rest" && <span className="text-xs text-green-600">🌿 Descanso</span>}
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span>⏱ {formatDuration(totalMinutes)}</span>
          {totalCost > 0 && <span className="text-amber-600 font-medium">{totalCost}€/pers</span>}
        </div>
      </div>

      {/* Activities */}
      {allActivities.length > 0 ? (
        <div className="divide-y divide-gray-100 px-2 py-1">
          {allActivities.map((act, i) => (
            <ActivityRow
              key={i}
              activity={act}
              type={act._type}
              checked={selections[i] !== false}
              onToggle={() => onToggle(day.day, i)}
            />
          ))}
        </div>
      ) : (
        <div className="px-4 py-4 text-sm text-gray-500 italic">
          Día libre para explorar por tu cuenta
        </div>
      )}
    </div>
  );
}

export default function ActivitiesCard({ data, selections, onToggle }) {
  const [activeDay, setActiveDay] = useState(0);

  if (!data || !data.days) return null;

  const totalSelected = data.days.reduce((sum, day) => {
    const acts = [...(day.free_activities || []), ...(day.paid_activities || [])];
    const daySel = selections[day.day] || {};
    return sum + acts.filter((_, i) => daySel[i] !== false).length;
  }, 0);

  const totalPaidCost = data.days.reduce((sum, day) => {
    const free = day.free_activities || [];
    const paid = day.paid_activities || [];
    const all = [...free, ...paid];
    const daySel = selections[day.day] || {};
    return sum + all
      .filter((_, i) => daySel[i] !== false)
      .filter((a) => a.price_per_person > 0)
      .reduce((s, a) => s + a.price_per_person, 0);
  }, 0);

  return (
    <div className="space-y-3">
      {/* Summary bar */}
      <div className="flex items-center justify-between bg-indigo-50 rounded-lg px-4 py-2">
        <span className="text-sm text-indigo-700 font-medium">
          {totalSelected} actividades seleccionadas
        </span>
        <span className="text-sm font-bold text-indigo-700">
          {totalPaidCost}€/pers en actividades de pago
        </span>
      </div>

      {/* Day tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {data.days.map((day, i) => (
          <button key={i} onClick={() => setActiveDay(i)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
              activeDay === i
                ? "bg-indigo-100 text-indigo-700 border border-indigo-300"
                : day.type === "rest"
                ? "bg-green-50 text-green-600 hover:bg-green-100"
                : "bg-gray-100 text-gray-500 hover:bg-gray-200"
            }`}>
            Día {day.day}{day.type === "rest" ? " 🌿" : ""}
          </button>
        ))}
      </div>

      {/* Active day timetable */}
      {data.days[activeDay] && (
        <DayTimetable
          day={data.days[activeDay]}
          selections={selections[data.days[activeDay].day] || {}}
          onToggle={onToggle}
        />
      )}

      {/* Totals */}
      <div className="grid grid-cols-3 gap-2 text-center">
        {data.total_free_time_hours != null && (
          <div className="bg-green-50 rounded-lg py-2">
            <p className="text-xs text-green-600">Visitas gratis</p>
            <p className="font-bold text-green-700">{data.total_free_time_hours}h</p>
          </div>
        )}
        {data.total_paid_time_hours != null && (
          <div className="bg-amber-50 rounded-lg py-2">
            <p className="text-xs text-amber-600">Actividades pago</p>
            <p className="font-bold text-amber-700">{data.total_paid_time_hours}h</p>
          </div>
        )}
        {data.total_budget_per_person != null && (
          <div className="bg-indigo-50 rounded-lg py-2">
            <p className="text-xs text-indigo-600">Presupuesto total</p>
            <p className="font-bold text-indigo-700">{data.total_budget_per_person}€/pers</p>
          </div>
        )}
      </div>
    </div>
  );
}
