import { useState, useEffect } from "react";
import PdfUploadArea from "./PdfUploadArea";

const STORAGE_KEY = "trip_planner_form";

function loadSaved() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return null;
}

export default function ConfigForm({ onStart }) {
  const today = new Date();
  const defaultStart = new Date(today.getTime() + 14 * 86400000).toISOString().slice(0, 10);
  const defaultEnd = new Date(today.getTime() + 20 * 86400000).toISOString().slice(0, 10);

  const defaults = {
    pais_origen: "",
    pais_destino: "",
    numero_adultos: "2",
    fecha_ida: defaultStart,
    fecha_vuelta: defaultEnd,
    flexibilidad_dias: "3",
    tipo_vuelo: "solo vuelos directos",
    hora_max_salida: "12:00",
    presupuesto_max_noche: "120",
    alojamiento_bano_privado: true,
    alojamiento_cocina: true,
  };

  const [form, setForm] = useState(() => ({ ...defaults, ...loadSaved() }));
  const [pdfPaths, setPdfPaths] = useState([]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(form));
  }, [form]);

  const update = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const handleSubmit = (e) => {
    e.preventDefault();
    const d1 = new Date(form.fecha_ida);
    const d2 = new Date(form.fecha_vuelta);
    const noches = Math.ceil((d2 - d1) / 86400000);
    const dias = noches + 1;
    const horaNum = parseInt(form.hora_max_salida.split(":")[0]) || 0;
    onStart({ ...form, numero_dias: String(dias), numero_noches: String(noches), hora_max_salida_num: String(horaNum), pdf_file_paths: JSON.stringify(pdfPaths) });
  };

  return (
    <div className="max-w-2xl mx-auto">
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl p-8 space-y-6">
        <h2 className="text-xl font-semibold text-gray-800">⚙️ Configura tu viaje</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Origen</label>
            <input type="text" required placeholder="Ej: Barcelona, España"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
              value={form.pais_origen} onChange={(e) => update("pais_origen", e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Destino</label>
            <input type="text" required placeholder="Ej: Islandia"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
              value={form.pais_destino} onChange={(e) => update("pais_destino", e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Adultos</label>
            <input type="number" min="1" max="10"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 transition"
              value={form.numero_adultos} onChange={(e) => update("numero_adultos", e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">📅 Fecha ida</label>
            <input type="date"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 transition"
              value={form.fecha_ida} onChange={(e) => update("fecha_ida", e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">📅 Fecha vuelta</label>
            <input type="date"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 transition"
              value={form.fecha_vuelta} onChange={(e) => update("fecha_vuelta", e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Flexibilidad: ±{form.flexibilidad_dias} días
            </label>
            <input type="range" min="0" max="30"
              className="w-full accent-indigo-600"
              value={form.flexibilidad_dias} onChange={(e) => update("flexibilidad_dias", e.target.value)} />
            <div className="flex justify-between text-xs text-gray-400">
              <span>Exacto</span><span>±30 días</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Presupuesto máx/noche (€)</label>
            <input type="number" min="10" max="1000" step="5"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 transition"
              value={form.presupuesto_max_noche} onChange={(e) => update("presupuesto_max_noche", e.target.value)} />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de vuelo</label>
          <div className="flex gap-4">
            {[["solo vuelos directos", "Directo"], ["vuelos directos o con máximo 1 escala", "Hasta 1 escala"]].map(([val, label]) => (
              <label key={val} className={`flex-1 cursor-pointer px-4 py-3 rounded-lg border-2 text-center transition ${
                form.tipo_vuelo === val ? "border-indigo-500 bg-indigo-50 text-indigo-700 font-medium" : "border-gray-200 hover:border-gray-300"
              }`}>
                <input type="radio" className="hidden" name="tipo_vuelo" value={val} checked={form.tipo_vuelo === val}
                  onChange={(e) => update("tipo_vuelo", e.target.value)} />
                {label}
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            🕐 Hora máxima de salida (ida)
          </label>
          <input type="time"
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 transition"
            value={form.hora_max_salida} onChange={(e) => update("hora_max_salida", e.target.value)} />
          <p className="text-xs text-gray-400 mt-1">Solo vuelos de ida que salgan antes de esta hora</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">🏠 Requisitos del alojamiento</label>
          <div className="flex gap-4">
            <label className={`flex-1 cursor-pointer flex items-center gap-2 px-4 py-3 rounded-lg border-2 transition ${
              form.alojamiento_bano_privado ? "border-indigo-500 bg-indigo-50" : "border-gray-200"
            }`}>
              <input type="checkbox" checked={form.alojamiento_bano_privado}
                onChange={(e) => update("alojamiento_bano_privado", e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600" />
              <span className="text-sm">🚿 Baño privado</span>
            </label>
            <label className={`flex-1 cursor-pointer flex items-center gap-2 px-4 py-3 rounded-lg border-2 transition ${
              form.alojamiento_cocina ? "border-indigo-500 bg-indigo-50" : "border-gray-200"
            }`}>
              <input type="checkbox" checked={form.alojamiento_cocina}
                onChange={(e) => update("alojamiento_cocina", e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600" />
              <span className="text-sm">🍳 Cocina</span>
            </label>
          </div>
        </div>

        <PdfUploadArea onFilesChange={setPdfPaths} />

        <button type="submit"
          className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all text-lg">
          🚀 Planificar viaje
        </button>
      </form>
    </div>
  );
}
