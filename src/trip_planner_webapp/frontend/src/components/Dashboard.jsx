import { useState, useCallback, useEffect } from "react";
import ProposalDetail from "./ProposalDetail";
import Summary from "./Summary";
import ChatPanel from "./ChatPanel";
import ResizeDivider from "./ResizeDivider";
import TripSummaryBar from "./TripSummaryBar";
import { STEPS } from "../hooks/useWebSocket";

const STATE_STYLES = {
  pending: "bg-gray-100 text-gray-400 border-gray-200",
  working: "bg-indigo-50 text-indigo-600 border-indigo-300 animate-pulse",
  review: "bg-indigo-100 text-indigo-700 border-indigo-500 ring-2 ring-indigo-300",
  done: "bg-green-50 text-green-700 border-green-400",
};

const STATE_ICONS = {
  pending: "",
  working: "⏳",
  review: "🔍",
  done: "✓",
};

export default function Dashboard({ stepStates, proposal, finalReport, error, phase, chatMessages, stepResults, stepTimes, tripConfig, onApprove, onFeedback, onNewTrip }) {
  const [consoleWidth, setConsoleWidth] = useState(420);
  const [viewingStep, setViewingStep] = useState(null);
  const canSend = !!proposal;

  useEffect(() => {
    if (proposal) setViewingStep(null);
  }, [proposal]);

  const handleChatFeedback = (msg) => {
    if (msg.toLowerCase() === "ok" || msg.toLowerCase() === "aprobado") {
      onApprove();
    } else {
      onFeedback(msg);
    }
  };

  const realDates = (() => {
    let ida = tripConfig.fecha_ida;
    let vuelta = tripConfig.fecha_vuelta;
    if (stepResults[0]) {
      try {
        const raw = stepResults[0];
        // Try JSON parsing
        const start = raw.indexOf("{");
        const end = raw.lastIndexOf("}");
        if (start >= 0 && end > start) {
          const json = JSON.parse(raw.slice(start, end + 1));
          const opt = json.options?.[0] || json.options?.find(o => o.recommended);
          if (opt?.outbound?.date) ida = opt.outbound.date;
          if (opt?.return?.date) vuelta = opt.return.date;
        }
      } catch {}
      // Fallback: regex for dates in the raw text
      if (ida === tripConfig.fecha_ida) {
        const dates = stepResults[0].match(/\d{4}-\d{2}-\d{2}/g);
        if (dates && dates.length >= 2) {
          ida = dates[0];
          vuelta = dates[1];
        }
      }
    }
    return { ida, vuelta };
  })();

  const handleResize = useCallback((clientX) => {
    const maxWidth = Math.round(window.innerWidth * 2 / 3);
    const newWidth = Math.max(280, Math.min(clientX - 16, maxWidth));
    setConsoleWidth(newWidth);
  }, []);

  return (
    <div className="h-screen flex flex-col p-4 gap-3">
      {/* Header + Step Tabs */}
      <div className="flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              🌍 Planificando tu viaje
            </h1>
            {tripConfig.fecha_ida && (
              <p className="text-xs text-gray-500 mt-0.5">
                📅 {(() => {
                  const d1 = new Date(realDates.ida);
                  const d2 = new Date(realDates.vuelta);
                  const noches = Math.round((d2 - d1) / 86400000);
                  return `${realDates.ida} → ${realDates.vuelta} · ${noches + 1} días / ${noches} noches`;
                })()} · {tripConfig.pais_origen} → {tripConfig.pais_destino}
              </p>
            )}
          </div>
          {phase === "done" && (
            <button onClick={onNewTrip} className="text-sm px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg transition">
              🔄 Nuevo viaje
            </button>
          )}
        </div>

        {/* Step tabs — clickable when done */}
        <div className="flex gap-2">
          {STEPS.map((step, i) => {
            const isDone = stepStates[i] === "done";
            const isActive = stepStates[i] === "review" || stepStates[i] === "working";
            const isViewing = viewingStep === i;
            const isCurrentView = isViewing || (viewingStep === null && isActive);
            return (
              <button key={step.key}
                onClick={() => {
                  if (isDone) setViewingStep(isViewing ? null : i);
                  else if (isActive) setViewingStep(null);
                }}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all duration-300 ${
                  isViewing ? "ring-2 ring-indigo-500 bg-indigo-100 text-indigo-700 border-indigo-400"
                  : isCurrentView ? STATE_STYLES[stepStates[i]]
                  : STATE_STYLES[stepStates[i]]
                } ${isDone || isActive ? "cursor-pointer hover:opacity-80" : ""}`}
              >
                <span className="text-lg">{step.icon}</span>
                <span>{step.title}</span>
                {stepTimes && stepTimes[i] != null && (
                  <span className="text-[10px] bg-white/60 text-gray-500 px-1.5 py-0.5 rounded-full">
                    {stepTimes[i] >= 60 ? `${Math.floor(stepTimes[i]/60)}m ${stepTimes[i]%60}s` : `${stepTimes[i]}s`}
                  </span>
                )}
                {isViewing && <span className="text-xs">👁️</span>}
                {!isViewing && STATE_ICONS[stepStates[i]] && (
                  <span className="text-xs">{STATE_ICONS[stepStates[i]]}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Trip summary bar (colapsable) */}
      <TripSummaryBar stepResults={stepResults} stepStates={stepStates} />

      {/* Main split layout with draggable divider */}
      <div className="flex-1 flex min-h-0">
        {/* LEFT: Console */}
        <div style={{ width: consoleWidth }} className="flex-shrink-0 h-full">
          <ChatPanel messages={chatMessages} onSendFeedback={handleChatFeedback} canSend={canSend} />
        </div>

        {/* Divider */}
        <ResizeDivider onResize={handleResize} />

        {/* RIGHT: Cards / Summary / Step Review */}
        <div className="flex-1 flex flex-col min-h-0 bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">

          {/* Viewing a completed step */}
          {viewingStep !== null && stepResults[viewingStep] && (
            <div className="flex flex-col h-full min-h-0">
              <div className="bg-gradient-to-r from-green-500 to-emerald-500 px-5 py-3 flex-shrink-0 flex items-center justify-between">
                <h3 className="text-white font-semibold">
                  {STEPS[viewingStep].icon} {STEPS[viewingStep].title} — Aprobado
                </h3>
                <button onClick={() => setViewingStep(null)}
                  className="text-white/80 hover:text-white text-sm transition">
                  ✕ Cerrar
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-5">
                <ProposalDetail
                  proposal={{ step: viewingStep, content: stepResults[viewingStep] }}
                  tripConfig={{ ...tripConfig, fecha_ida: realDates.ida, fecha_vuelta: realDates.vuelta }}
                  onApprove={() => setViewingStep(null)}
                  onFeedback={() => {}}
                  readOnly
                />
              </div>
            </div>
          )}

          {/* Active proposal */}
          {viewingStep === null && proposal && (
            <ProposalDetail proposal={proposal} tripConfig={{ ...tripConfig, fecha_ida: realDates.ida, fecha_vuelta: realDates.vuelta }} onApprove={onApprove} onFeedback={onFeedback} />
          )}

          {/* Waiting */}
          {viewingStep === null && !proposal && phase === "running" && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-gray-400">
                <div className="text-4xl mb-3 animate-bounce">⏳</div>
                <p className="text-lg font-medium">El agente está trabajando...</p>
                <p className="text-sm mt-1">Las opciones aparecerán aquí como cards seleccionables</p>
              </div>
            </div>
          )}

          {/* Done */}
          {viewingStep === null && phase === "done" && finalReport && (
            <Summary content={finalReport} stepResults={stepResults} tripConfig={tripConfig} onNewTrip={onNewTrip} />
          )}

          {phase === "error" && error && (
            <div className="bg-red-50 border-2 border-red-200 rounded-xl p-6">
              <h3 className="text-red-800 font-semibold mb-2">❌ Error</h3>
              <pre className="text-sm text-red-700 whitespace-pre-wrap overflow-x-auto">{error}</pre>
              <button onClick={onNewTrip}
                className="mt-4 px-5 py-2 bg-red-100 hover:bg-red-200 text-red-800 rounded-lg font-medium transition">
                Reintentar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
