import { useState } from "react";

export default function ConfigForm({ onStart }) {
  const today = new Date();
  const defaultStart = new Date(today.getTime() + 14 * 86400000).toISOString().slice(0, 10);
  const defaultEnd = new Date(today.getTime() + 20 * 86400000).toISOString().slice(0, 10);

  const [form, setForm] = useState({
    pais_origen: "",
    pais_destino: "",
    numero_adultos: "2",
    fecha_ida: defaultStart,
    fecha_vuelta: defaultEnd,
    flexibilidad_dias: "3",
    tipo_vuelo: "solo vuelos directos",
    presupuesto_max_noche: "120",
  });

  const update = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const handleSubmit = (e) => {
    e.preventDefault();
    const d1 = new Date(form.fecha_ida);
    const d2 = new Date(form.fecha_vuelta);
    const dias = Math.ceil((d2 - d1) / 86400000) + 1;
    onStart({ ...form, numero_dias: String(dias) });
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
          🌍 Agencia de Viajes Inteligente
        </h1>
        <p className="text-gray-500 mt-2">4 agentes de IA especializados planifican tu viaje perfecto</p>
      </div>

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

        <button type="submit"
          className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all text-lg">
          🚀 Planificar viaje
        </button>
      </form>
    </div>
  );
}
