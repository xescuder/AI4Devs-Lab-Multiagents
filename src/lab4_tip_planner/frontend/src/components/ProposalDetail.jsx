import { useState, useMemo } from "react";
import Markdown from "react-markdown";
import { STEPS } from "../hooks/useWebSocket";
import FlightCard from "./cards/FlightCard";
import TransportCard from "./cards/TransportCard";
import ActivitiesCard from "./cards/ActivitiesCard";
import AccommodationCard from "./cards/AccommodationCard";

function tryParseJSON(content) {
  try {
    const trimmed = content.trim();
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start !== -1 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
  } catch {}
  return null;
}

export default function ProposalDetail({ proposal, tripConfig = {}, onApprove, onFeedback }) {
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
            <FlightCard key={i} option={opt} selected={selected === i} onSelect={() => setSelected(i)} />
          ))}
        </div>
      );
    }

    if (proposal.step === 1 && parsed.options) {
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

    if (proposal.step === 2 && parsed.days) {
      const handleToggle = (dayNum, actIdx) => {
        setActSelections((prev) => {
          const daySel = { ...(prev[dayNum] || {}) };
          daySel[actIdx] = daySel[actIdx] === false ? true : false;
          return { ...prev, [dayNum]: daySel };
        });
      };
      return <ActivitiesCard data={parsed} selections={actSelections} onToggle={handleToggle} />;
    }

    if (proposal.step === 3 && (parsed.nights || parsed.total_nights)) {
      const totalNights = parseInt(tripConfig.numero_dias) || parsed.total_nights || parsed.nights?.length || 1;
      return (
        <AccommodationCard
          data={parsed}
          totalNights={totalNights}
          selected={accSelected}
          onSelect={(night, opt) => setAccSelected((prev) => ({ ...prev, [night]: opt }))}
        />
      );
    }

    return (
      <div className="prose prose-sm max-w-none">
        <Markdown>{proposal.content}</Markdown>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="bg-gradient-to-r from-indigo-500 to-purple-500 px-5 py-3 flex-shrink-0">
        <h3 className="text-white font-semibold">{step.icon} {step.title}</h3>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
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
