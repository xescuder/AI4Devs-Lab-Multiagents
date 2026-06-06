import ConfigForm from "./components/ConfigForm";
import Dashboard from "./components/Dashboard";
import { useWebSocket } from "./hooks/useWebSocket";

export default function App() {
  const {
    connected, phase, stepStates, proposal,
    finalReport, error, chatMessages, stepResults, tripConfig,
    startPlanning, sendFeedback,
  } = useWebSocket();

  const handleApprove = () => sendFeedback("ok");
  const handleFeedback = (msg) => sendFeedback(msg);
  const handleNewTrip = () => window.location.reload();

  if (phase === "config") {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="w-full">
          {!connected && (
            <div className="max-w-2xl mx-auto mb-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-center text-sm text-yellow-800">
              ⏳ Conectando con el servidor...
            </div>
          )}
          <ConfigForm onStart={startPlanning} />
        </div>
      </div>
    );
  }

  return (
    <Dashboard
      stepStates={stepStates}
      stepResults={stepResults}
      proposal={proposal}
      finalReport={finalReport}
      error={error}
      phase={phase}
      chatMessages={chatMessages}
      tripConfig={tripConfig}
      onApprove={handleApprove}
      onFeedback={handleFeedback}
      onNewTrip={handleNewTrip}
    />
  );
}
