import Markdown from "react-markdown";

export default function Summary({ content, onNewTrip }) {
  const handleDownload = () => {
    const blob = new Blob([content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `viaje_${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
      <div className="bg-gradient-to-r from-green-500 to-emerald-500 px-6 py-4">
        <h3 className="text-white font-semibold text-lg">🎉 ¡Tu viaje está planificado!</h3>
      </div>

      <div className="p-6 prose max-w-none">
        <Markdown>{content}</Markdown>
      </div>

      <div className="border-t border-gray-100 bg-gray-50 p-4 flex gap-3">
        <button onClick={handleDownload}
          className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition">
          📥 Descargar Markdown
        </button>
        <button onClick={onNewTrip}
          className="px-6 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium transition">
          🔄 Nuevo viaje
        </button>
      </div>
    </div>
  );
}
