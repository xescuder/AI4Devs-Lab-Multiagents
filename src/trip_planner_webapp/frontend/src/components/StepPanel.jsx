const STATE_STYLES = {
  pending: "border-gray-200 opacity-50",
  working: "border-indigo-500 animate-pulse-glow",
  review: "border-indigo-500 bg-gradient-to-b from-indigo-50 to-white shadow-lg",
  done: "border-green-500 bg-green-50/50",
};

const STATE_LABELS = {
  pending: { text: "Pendiente", color: "text-gray-400" },
  working: { text: "⏳ Procesando...", color: "text-indigo-600" },
  review: { text: "🔍 Revisión", color: "text-indigo-700" },
  done: { text: "✓ Aprobado", color: "text-green-600" },
};

export default function StepPanel({ icon, title, state }) {
  const style = STATE_STYLES[state] || STATE_STYLES.pending;
  const label = STATE_LABELS[state] || STATE_LABELS.pending;

  return (
    <div className={`border-2 rounded-xl p-6 text-center transition-all duration-500 ${style}`}>
      <div className="text-4xl mb-2">
        {state === "done" ? "✓" : state === "working" ? (
          <span className="inline-block animate-spin-slow">{icon}</span>
        ) : icon}
      </div>
      <div className={`font-semibold text-lg ${state === "done" ? "text-green-700" : state === "review" || state === "working" ? "text-indigo-700" : "text-gray-600"}`}>
        {title}
      </div>
      <div className={`text-sm mt-1 ${label.color}`}>{label.text}</div>
    </div>
  );
}
