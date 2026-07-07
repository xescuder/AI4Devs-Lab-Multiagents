import { useState } from "react";
import PdfUploadArea from "./PdfUploadArea";

const EXAMPLES = [
  "Quiero ir a Islandia desde Barcelona, somos 2 adultos, la primera semana de septiembre, 7 días, máximo 120€/noche en alojamiento, vuelos directos si es posible",
  "Viaje romántico a París para 2 personas, 5 días en octubre, presupuesto ajustado máximo 100€/noche, con escala si sale más barato",
  "Vacaciones familiares a Japón, 4 adultos, 2 semanas en agosto, hasta 150€/noche, nos da igual hacer escala",
];

export default function NaturalLanguageForm({ onStart, connected }) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pdfPaths, setPdfPaths] = useState([]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/parse-trip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: text }),
      });

      if (!response.ok) throw new Error("Error al interpretar tu descripción");

      const inputs = await response.json();

      if (inputs.error) {
        setError(inputs.error);
        setLoading(false);
        return;
      }

      onStart({ ...inputs, pdf_file_paths: JSON.stringify(pdfPaths) });
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl p-8 space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-800">✨ Describe tu viaje ideal</h2>
        <p className="text-sm text-gray-500 mt-1">
          Escribe en lenguaje natural lo que quieres y la IA extraerá los detalles automáticamente
        </p>
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Ej: Quiero ir a Islandia desde Barcelona, somos 2 adultos, la primera semana de septiembre..."
        rows={5}
        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition resize-none text-gray-700"
      />

      {/* Examples */}
      <div>
        <p className="text-xs text-gray-400 font-medium mb-2">Ejemplos (haz clic para usar):</p>
        <div className="space-y-2">
          {EXAMPLES.map((ex, i) => (
            <button key={i} type="button" onClick={() => setText(ex)}
              className="w-full text-left text-xs text-gray-500 bg-gray-50 hover:bg-purple-50 hover:text-purple-700 px-3 py-2 rounded-lg border border-gray-100 transition">
              "{ex.slice(0, 80)}..."
            </button>
          ))}
        </div>
      </div>

      <PdfUploadArea onFilesChange={setPdfPaths} />

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <button type="submit" disabled={!text.trim() || loading || !connected}
        className="w-full py-3.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all text-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none">
        {loading ? "🔄 Interpretando tu viaje..." : "✨ Planificar con IA"}
      </button>
    </form>
  );
}
