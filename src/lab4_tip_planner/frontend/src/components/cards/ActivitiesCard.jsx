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
      <TimeSlot time={activity.start_time} duration={activity.duration_minutes} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`font-medium text-sm ${checked ? "text-gray-800" : "text-gray-400 line-through"}`}>
            {activity.name}
          </span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
            isFree ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
          }`}>
            {isFree ? "Gratis" : `${activity.price_per_person}€/pers`}
          </span>
          {activity.scoring && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
              activity.scoring.total_score >= 40 ? "bg-yellow-100 text-yellow-700" :
              activity.scoring.total_score >= 30 ? "bg-blue-100 text-blue-700" :
              "bg-gray-100 text-gray-500"
            }`}>
              ⭐ {activity.scoring.total_score}/50
            </span>
          )}
          {activity.must_see && (
            <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-medium">
              🔥 Imprescindible
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-0.5">{activity.description}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {activity.lat && activity.lng ? (
            <button onClick={(e) => {
                e.stopPropagation();
                window.open(`https://www.google.com/maps?q=${activity.lat},${activity.lng}`, "map_preview", "width=600,height=500,scrollbars=yes,resizable=yes");
              }}
              className="text-[10px] text-blue-600 hover:text-blue-800 hover:underline cursor-pointer">
              📍 {activity.location || "Ver en mapa"}
            </button>
          ) : activity.location ? (
            <span className="text-[10px] text-gray-400">📍 {activity.location}</span>
          ) : null}
          {activity.walking_time_minutes > 0 && (
            <span className="text-[10px] text-teal-600">🚶 {activity.walking_time_minutes}min caminando</span>
          )}
        </div>
        {activity.tip && <p className="text-xs text-indigo-500 mt-0.5">💡 {activity.tip}</p>}
        {activity.booking_url && checked && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              window.open(activity.booking_url, "booking_preview", "width=600,height=750,scrollbars=yes,resizable=yes");
            }}
            title={activity.booking_url}
            className="text-[10px] bg-amber-100 hover:bg-amber-200 text-amber-700 font-medium px-2 py-0.5 rounded-full transition mt-1 inline-block">
            🎟️ Comprar entrada
          </button>
        )}
        {activity.free_alternative && !checked && (
          <div className="mt-1 bg-green-50 border border-green-200 rounded-lg px-2 py-1">
            <p className="text-[10px] text-green-700 font-medium">🔄 Alternativa gratuita:</p>
            <p className="text-[10px] text-green-600">{activity.free_alternative.name} — {activity.free_alternative.description}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function DriveSegment({ drive }) {
  const mapsUrl = drive.from_lat && drive.to_lat
    ? `https://www.google.com/maps/dir/${drive.from_lat},${drive.from_lng}/${drive.to_lat},${drive.to_lng}`
    : null;

  return (
    <div className="flex items-center gap-2 py-2 px-3 bg-blue-50 rounded-lg border border-blue-100">
      <span className="text-lg">🚗</span>
      <TimeSlot time={drive.start_time} duration={drive.duration_minutes} />
      <div className="flex-1 min-w-0">
        {mapsUrl ? (
          <button onClick={() => window.open(mapsUrl, "drive_map", "width=700,height=500,scrollbars=yes,resizable=yes")}
            className="text-xs font-medium text-blue-700 hover:text-blue-900 hover:underline cursor-pointer text-left">
            {drive.from} → {drive.to} 🗺️
          </button>
        ) : (
          <p className="text-xs font-medium text-blue-700">{drive.from} → {drive.to}</p>
        )}
        <p className="text-[10px] text-blue-500">
          {drive.distance_km} km · {formatDuration(drive.duration_minutes)} en coche
        </p>
      </div>
    </div>
  );
}

function getDayDate(startDate, dayNum) {
  if (!startDate) return null;
  try {
    const d = new Date(startDate);
    d.setDate(d.getDate() + dayNum - 1);
    return d.toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" });
  } catch { return null; }
}

function DayTimetable({ day, selections, onToggle, startDate }) {
  const drives = day.drives || [];
  const allActivities = [
    ...(day.free_activities || []).map((a) => ({ ...a, _type: "free" })),
    ...(day.paid_activities || []).map((a) => ({ ...a, _type: "paid" })),
  ].sort((a, b) => (a.start_time || "").localeCompare(b.start_time || ""));

  const totalDriving = drives.reduce((s, d) => s + (d.duration_minutes || 0), 0);

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
            {startDate ? getDayDate(startDate, day.day) : `Día ${day.day}`}
          </span>
          <span className="font-semibold text-gray-800 text-sm">{day.title}</span>
          {day.type === "rest" && <span className="text-xs text-green-600">🌿 Descanso</span>}
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          {totalDriving > 0 && <span>🚗 {formatDuration(totalDriving)}</span>}
          <span>⏱ {formatDuration(totalMinutes)}</span>
          {totalCost > 0 && <span className="text-amber-600 font-medium">{totalCost}€/pers</span>}
        </div>
      </div>

      {/* Drives + Activities interleaved by start_time */}
      {(allActivities.length > 0 || drives.length > 0) ? (
        <div className="space-y-1 px-2 py-1">
          {(() => {
            const timeline = [
              ...drives.map((d) => ({ ...d, _kind: "drive", _time: d.start_time || "" })),
              ...allActivities.map((a, i) => ({ ...a, _kind: "activity", _idx: i, _time: a.start_time || "" })),
            ].sort((a, b) => a._time.localeCompare(b._time));

            return timeline.map((item, ti) => {
              if (item._kind === "drive") {
                return <DriveSegment key={`drive-${ti}`} drive={item} />;
              }
              return (
                <ActivityRow
                  key={`act-${ti}`}
                  activity={item}
                  type={item._type}
                  checked={selections[item._idx] !== false}
                  onToggle={() => onToggle(day.day, item._idx)}
                />
              );
            });
          })()}
        </div>
      ) : (
        <div className="px-4 py-4 text-sm text-gray-500 italic">
          Día libre para explorar por tu cuenta
        </div>
      )}

      {/* Overnight location — at the end of the day */}
      {(day.overnight_zone || day.end_city) && (
        <div className="mx-3 mb-3 mt-2 flex items-center gap-2 bg-indigo-900 text-white rounded-lg px-4 py-2.5">
          <span className="text-lg">🌙</span>
          <div>
            <span className="text-sm font-medium">
              Pernocta en {day.overnight_zone || day.end_city}
            </span>
            {day.start_city && day.end_city && day.start_city !== day.end_city && (
              <span className="text-xs text-indigo-300 block">
                Ruta del día: {day.start_city} → {day.end_city}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ActivitiesCard({ data, selections, onToggle, startDate }) {
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
            {startDate ? getDayDate(startDate, day.day) : `Día ${day.day}`}{day.type === "rest" ? " 🌿" : ""}
          </button>
        ))}
      </div>

      {/* Active day timetable */}
      {data.days[activeDay] && (
        <DayTimetable
          day={data.days[activeDay]}
          selections={selections[data.days[activeDay].day] || {}}
          onToggle={onToggle}
          startDate={startDate}
        />
      )}

      {/* Source blogs */}
      {data.source_blogs && data.source_blogs.length > 0 && (
        <div className="bg-gray-50 rounded-lg px-4 py-2 text-xs text-gray-500">
          <span className="font-medium">📚 Basado en: </span>
          {data.source_blogs.map((url, i) => (
            <span key={i}>
              <button
                onClick={() => window.open(url, "blog_preview", "width=700,height=800,scrollbars=yes,resizable=yes")}
                title={url}
                className="text-indigo-500 hover:text-indigo-700 hover:underline cursor-pointer">
                Blog {i + 1}
              </button>
              {i < data.source_blogs.length - 1 && ", "}
            </span>
          ))}
        </div>
      )}

      {/* Totals */}
      {(() => {
        const t = data.totals || {};
        return (
          <div className="grid grid-cols-5 gap-2 text-center">
            {t.driving_hours != null && (
              <div className="bg-blue-50 rounded-lg py-2">
                <p className="text-xs text-blue-600">🚗 Conducción</p>
                <p className="font-bold text-blue-700">{t.driving_hours}h</p>
              </div>
            )}
            {t.walking_hours != null && (
              <div className="bg-teal-50 rounded-lg py-2">
                <p className="text-xs text-teal-600">🚶 Caminando</p>
                <p className="font-bold text-teal-700">{t.walking_hours}h</p>
              </div>
            )}
            {(t.free_time_hours != null || data.total_free_time_hours != null) && (
              <div className="bg-green-50 rounded-lg py-2">
                <p className="text-xs text-green-600">Gratis</p>
                <p className="font-bold text-green-700">{t.free_time_hours || data.total_free_time_hours}h</p>
              </div>
            )}
            {(t.paid_time_hours != null || data.total_paid_time_hours != null) && (
              <div className="bg-amber-50 rounded-lg py-2">
                <p className="text-xs text-amber-600">De pago</p>
                <p className="font-bold text-amber-700">{t.paid_time_hours || data.total_paid_time_hours}h</p>
              </div>
            )}
            {(t.budget_per_person != null || data.total_budget_per_person != null) && (
              <div className="bg-indigo-50 rounded-lg py-2">
                <p className="text-xs text-indigo-600">Presupuesto</p>
                <p className="font-bold text-indigo-700">{t.budget_per_person || data.total_budget_per_person}€</p>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
