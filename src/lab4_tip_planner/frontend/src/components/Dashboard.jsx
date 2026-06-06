import { useState, useCallback } from "react";
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

export default function Dashboard({ stepStates, proposal, finalReport, error, phase, chatMessages, stepResults, tripConfig, onApprove, onFeedback, onNewTrip }) {
  const [consoleWidth, setConsoleWidth] = useState(420);
  const canSend = !!proposal;

  const handleChatFeedback = (msg) => {
    if (msg.toLowerCase() === "ok" || msg.toLowerCase() === "aprobado") {
      onApprove();
    } else {
      onFeedback(msg);
    }
  };

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
          <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            🌍 Planificando tu viaje
          </h1>
          {phase === "done" && (
            <button onClick={onNewTrip} className="text-sm px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg transition">
              🔄 Nuevo viaje
            </button>
          )}
        </div>

        {/* Step tabs */}
        <div className="flex gap-2">
          {STEPS.map((step, i) => (
            <div key={step.key}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all duration-300 ${STATE_STYLES[stepStates[i]]}`}
            >
              <span className="text-lg">{step.icon}</span>
              <span>{step.title}</span>
              {STATE_ICONS[stepStates[i]] && (
                <span className="text-xs">{STATE_ICONS[stepStates[i]]}</span>
              )}
            </div>
          ))}
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

        {/* RIGHT: Cards / Summary */}
        <div className="flex-1 flex flex-col min-h-0 bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
          {proposal && (
            <ProposalDetail proposal={proposal} tripConfig={tripConfig} onApprove={onApprove} onFeedback={onFeedback} />
          )}

          {!proposal && phase === "running" && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-gray-400">
                <div className="text-4xl mb-3 animate-bounce">⏳</div>
                <p className="text-lg font-medium">El agente está trabajando...</p>
                <p className="text-sm mt-1">Las opciones aparecerán aquí como cards seleccionables</p>
              </div>
            </div>
          )}

          {phase === "done" && finalReport && (
            <Summary content={finalReport} onNewTrip={onNewTrip} />
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
