import { useState } from "react";
import ConfigForm from "./components/ConfigForm";
import NaturalLanguageForm from "./components/NaturalLanguageForm";
import Dashboard from "./components/Dashboard";
import { useWebSocket } from "./hooks/useWebSocket";

export default function App() {
  const {
    connected, phase, stepStates, proposal,
    finalReport, error, chatMessages, stepResults, stepTimes,
    tripConfig, startPlanning, sendFeedback,
  } = useWebSocket();

  const [mode, setMode] = useState(null); // null = choosing, "simple" | "advanced"

  const handleApprove = () => sendFeedback("ok");
  const handleFeedback = (msg) => sendFeedback(msg);
  const handleNewTrip = () => window.location.reload();

  if (phase !== "config") {
    return (
      <Dashboard
        stepStates={stepStates}
        stepResults={stepResults}
        proposal={proposal}
        finalReport={finalReport}
        error={error}
        phase={phase}
        chatMessages={chatMessages}
        stepTimes={stepTimes}
        tripConfig={tripConfig}
        onApprove={handleApprove}
        onFeedback={handleFeedback}
        onNewTrip={handleNewTrip}
      />
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        {!connected && (
          <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-center text-sm text-yellow-800">
            ⏳ Conectando con el servidor...
          </div>
        )}

        {/* Header — always visible */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            🌍 Agencia de Viajes Inteligente
          </h1>
          <p className="text-gray-500 mt-2">4 agentes de IA especializados planifican tu viaje perfecto</p>
        </div>

        {/* Mode selector */}
        {mode === null && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button onClick={() => setMode("simple")}
              className="bg-white rounded-2xl shadow-lg border-2 border-gray-200 hover:border-indigo-400 hover:shadow-xl p-8 transition-all group text-left">
              <div className="text-3xl mb-3">📋</div>
              <h3 className="text-lg font-bold text-gray-800 group-hover:text-indigo-700 transition">Modo Simple</h3>
              <p className="text-sm text-gray-500 mt-2">
                Completa un formulario con los datos de tu viaje: origen, destino, fechas, presupuesto.
              </p>
              <div className="mt-4 text-xs text-indigo-600 font-medium">
                Ideal si ya sabes lo que quieres →
              </div>
            </button>

            <button onClick={() => setMode("advanced")}
              className="bg-white rounded-2xl shadow-lg border-2 border-gray-200 hover:border-purple-400 hover:shadow-xl p-8 transition-all group text-left">
              <div className="text-3xl mb-3">✨</div>
              <h3 className="text-lg font-bold text-gray-800 group-hover:text-purple-700 transition">Modo Avanzado</h3>
              <p className="text-sm text-gray-500 mt-2">
                Describe tu viaje en lenguaje natural y la IA interpretará automáticamente todos los detalles.
              </p>
              <div className="mt-4 text-xs text-purple-600 font-medium">
                Ideal si quieres explorar opciones →
              </div>
            </button>
          </div>
        )}

        {/* Simple mode */}
        {mode === "simple" && (
          <div>
            <button onClick={() => setMode(null)}
              className="mb-4 text-sm text-gray-500 hover:text-gray-700 transition">
              ← Volver a elegir modo
            </button>
            <ConfigForm onStart={startPlanning} />
          </div>
        )}

        {/* Advanced mode */}
        {mode === "advanced" && (
          <div>
            <button onClick={() => setMode(null)}
              className="mb-4 text-sm text-gray-500 hover:text-gray-700 transition">
              ← Volver a elegir modo
            </button>
            <NaturalLanguageForm onStart={startPlanning} connected={connected} />
          </div>
        )}
      </div>
    </div>
  );
}
