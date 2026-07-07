import { useState, useMemo } from "react";
import Markdown from "react-markdown";
import { STEPS } from "../hooks/useWebSocket";
import FlightCard from "./cards/FlightCard";
import TransportCard from "./cards/TransportCard";
import ActivitiesCard from "./cards/ActivitiesCard";
import AccommodationCard from "./cards/AccommodationCard";

function tryParseJSON(content) {
  if (!content) return null;
  let text = content.trim();

  // Remove all markdown code fences (handles ```json ... ``` anywhere)
  text = text.replace(/```[\w]*\s*\n?/gi, "").replace(/```/g, "");
  // Strip leading non-JSON prose (anything before the first { or [)
  text = text.replace(/^[^[{]*(?=[{[])/, "");
  text = text.trim();

  // Try direct parse
  try { return JSON.parse(text); } catch {}

  // Try finding JSON object (first { to last })
  const objStart = text.indexOf("{");
  const objEnd = text.lastIndexOf("}");
  if (objStart !== -1 && objEnd > objStart) {
    try { return JSON.parse(text.slice(objStart, objEnd + 1)); } catch {}
  }

  // Try finding JSON array
  const arrStart = text.indexOf("[");
  const arrEnd = text.lastIndexOf("]");
  if (arrStart !== -1 && arrEnd > arrStart) {
    try { return JSON.parse(text.slice(arrStart, arrEnd + 1)); } catch {}
  }

  // Repair truncated JSON: find the longest parseable prefix
  const start = objStart !== -1 ? objStart : (text.indexOf("[") !== -1 ? text.indexOf("[") : -1);
  if (start !== -1) {
    let partial = text.slice(start);

    // Strategy 1: try closing brackets progressively from the last valid point
    const lastComplete = Math.max(
      partial.lastIndexOf("},"),
      partial.lastIndexOf("}]"),
      partial.lastIndexOf("]}")
    );
    if (lastComplete > 0) {
      let attempt = partial.slice(0, lastComplete + 1);
      const openBraces = (attempt.match(/{/g) || []).length;
      const closeBraces = (attempt.match(/}/g) || []).length;
      const openBrackets = (attempt.match(/\[/g) || []).length;
      const closeBrackets = (attempt.match(/\]/g) || []).length;
      for (let i = 0; i < openBrackets - closeBrackets; i++) attempt += "]";
      for (let i = 0; i < openBraces - closeBraces; i++) attempt += "}";
      try { return JSON.parse(attempt); } catch {}
    }

    // Strategy 2: trim trailing incomplete values/objects, then close brackets
    partial = partial.replace(/,\s*"[^"]*"?\s*:?\s*[^,}\]]*$/, "");
    partial = partial.replace(/,\s*{[^}]*$/, "");
    partial = partial.replace(/,\s*\[[^\]]*$/, "");

    const ob = (partial.match(/{/g) || []).length;
    const cb = (partial.match(/}/g) || []).length;
    const oq = (partial.match(/\[/g) || []).length;
    const cq = (partial.match(/\]/g) || []).length;
    for (let i = 0; i < oq - cq; i++) partial += "]";
    for (let i = 0; i < ob - cb; i++) partial += "}";
    try { return JSON.parse(partial); } catch {}

    // Strategy 3: try trimming from the last complete object/array entry
    const cuts = [...partial.matchAll(/\}\s*,|\]\s*,|\}\s*\]|\]\s*\}/g)];
    for (let i = cuts.length - 1; i >= Math.max(0, cuts.length - 10); i--) {
      let attempt = partial.slice(0, cuts[i].index + 1);
      const bo2 = (attempt.match(/{/g) || []).length - (attempt.match(/}/g) || []).length;
      const bq2 = (attempt.match(/\[/g) || []).length - (attempt.match(/\]/g) || []).length;
      for (let j = 0; j < bq2; j++) attempt += "]";
      for (let j = 0; j < bo2; j++) attempt += "}";
      try { return JSON.parse(attempt); } catch {}
    }
  }

  return null;
}

function looksLikeDayArray(arr) {
  return arr.length > 0 && arr[0] && (arr[0].day != null || arr[0].title);
}

function findDays(obj) {
  if (!obj || typeof obj !== "object") return null;
  if (Array.isArray(obj)) {
    if (looksLikeDayArray(obj)) return { days: obj };
    return null;
  }
  for (const key of ["days", "itinerary", "schedule", "itinerario", "dias", "jornadas", "plan"]) {
    if (Array.isArray(obj[key]) && looksLikeDayArray(obj[key])) {
      return { ...obj, days: obj[key] };
    }
  }
  for (const val of Object.values(obj)) {
    if (Array.isArray(val) && looksLikeDayArray(val)) {
      return { ...obj, days: val };
    }
    if (val && typeof val === "object" && !Array.isArray(val)) {
      const found = findDays(val);
      if (found) return found;
    }
  }
  return null;
}

export default function ProposalDetail({ proposal, tripConfig = {}, onApprove, onFeedback, readOnly = false }) {
  const [selected, setSelected] = useState(0);
  const [accSelected, setAccSelected] = useState({});
  const [actSelections, setActSelections] = useState({});
  const [feedback, setFeedback] = useState("");
  const step = STEPS[proposal.step];

  const parsed = useMemo(() => tryParseJSON(proposal.content), [proposal.content]);

  const handleFeedback = () => {
    if (feedback.trim()) {
      onFeedback(feedback.trim());
      setFeedback("");
    }
  };

  const renderContent = () => {
    if (!parsed) {
      return (
        <div className="prose prose-sm max-w-none">
          <Markdown>{proposal.content}</Markdown>
        </div>
      );
    }

    if (proposal.step === 0 && parsed.options) {
      return (
        <div className="space-y-3">
          {parsed.notes && <p className="text-sm text-gray-600 bg-amber-50 rounded-lg p-3">ℹ️ {parsed.notes}</p>}
          <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Selecciona tu vuelo:</p>
          {parsed.options.map((opt, i) => (
            <FlightCard key={i} option={opt} selected={selected === i} onSelect={() => setSelected(i)}
              preferredDates={{ outbound: tripConfig.fecha_ida, return: tripConfig.fecha_vuelta }} />
          ))}
        </div>
      );
    }

    if (proposal.step === 1) {
      const activitiesData = findDays(parsed);
      if (activitiesData) {
        const handleToggle = (dayNum, actIdx) => {
          setActSelections((prev) => {
            const daySel = { ...(prev[dayNum] || {}) };
            daySel[actIdx] = daySel[actIdx] === false ? true : false;
            return { ...prev, [dayNum]: daySel };
          });
        };
        return <ActivitiesCard data={activitiesData} selections={actSelections} onToggle={handleToggle} startDate={tripConfig.fecha_ida} />;
      }
    }

    if (proposal.step === 2 && (parsed.nights || parsed.total_nights)) {
      const totalNights = parseInt(tripConfig.numero_dias) || parsed.total_nights || parsed.nights?.length || 1;
      return (
        <AccommodationCard
          data={parsed}
          totalNights={totalNights}
          selected={accSelected}
          onSelect={(night, opt) => setAccSelected((prev) => ({ ...prev, [night]: opt }))}
          startDate={tripConfig.fecha_ida}
        />
      );
    }

    if (proposal.step === 3 && parsed.options) {
      return (
        <div className="space-y-3">
          {parsed.notes && <p className="text-sm text-gray-600 bg-amber-50 rounded-lg p-3">ℹ️ {parsed.notes}</p>}
          <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Selecciona tu vehículo:</p>
          {parsed.options.map((opt, i) => (
            <TransportCard key={i} option={opt} selected={selected === i} onSelect={() => setSelected(i)} />
          ))}
        </div>
      );
    }

    return (
      <div className="prose prose-sm max-w-none">
        <Markdown>{proposal.content}</Markdown>
      </div>
    );
  };

  if (readOnly) {
    return (
      <div className="flex-1 overflow-y-auto p-5">
        {renderContent()}
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full">
      <div className="bg-gradient-to-r from-indigo-500 to-purple-500 px-5 py-3 flex-shrink-0">
        <h3 className="text-white font-semibold">{step.icon} {step.title}</h3>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-5">
        {renderContent()}
      </div>

      <div className="border-t border-gray-200 bg-gray-50 p-4 flex-shrink-0">
        <div className="flex gap-3">
          <input type="text" value={feedback} onChange={(e) => setFeedback(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleFeedback()}
            placeholder="Pedir cambios..."
            className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition" />
          <button onClick={handleFeedback} disabled={!feedback.trim()}
            className="px-4 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-sm font-medium transition disabled:opacity-40">
            💬 Cambios
          </button>
          <button onClick={() => onApprove()}
            className="px-6 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-lg font-semibold shadow-md hover:shadow-lg transition-all text-sm">
            ✅ Aprobar
          </button>
        </div>
      </div>
    </div>
  );
}
