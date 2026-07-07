import { useState, useRef } from "react";

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function PdfUploadArea({ onFilesChange }) {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  const uploadFiles = async (fileList) => {
    const pdfs = Array.from(fileList).filter((f) => f.name.toLowerCase().endsWith(".pdf"));
    if (!pdfs.length) return;

    setUploading(true);
    try {
      const formData = new FormData();
      pdfs.forEach((f) => formData.append("files", f));

      const res = await fetch("/api/upload-pdfs", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");

      const data = await res.json();
      const newFiles = pdfs.map((f, i) => ({
        name: f.name,
        size: f.size,
        serverPath: data.files[i],
      }));

      setFiles((prev) => {
        const updated = [...prev, ...newFiles];
        onFilesChange(updated.map((f) => f.serverPath));
        return updated;
      });
    } catch (err) {
      console.error("PDF upload error:", err);
    } finally {
      setUploading(false);
    }
  };

  const removeFile = (idx) => {
    setFiles((prev) => {
      const updated = prev.filter((_, i) => i !== idx);
      onFilesChange(updated.map((f) => f.serverPath));
      return updated;
    });
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    uploadFiles(e.dataTransfer.files);
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        📄 PDFs de itinerarios (opcional)
      </label>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl px-4 py-5 text-center cursor-pointer transition-all ${
          dragOver
            ? "border-indigo-500 bg-indigo-50"
            : "border-gray-300 hover:border-gray-400 bg-gray-50/50"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf"
          multiple
          className="hidden"
          onChange={(e) => { uploadFiles(e.target.files); e.target.value = ""; }}
        />
        {uploading ? (
          <p className="text-sm text-indigo-600">Subiendo...</p>
        ) : (
          <p className="text-sm text-gray-500">
            Arrastra PDFs aqui o haz clic para seleccionar
          </p>
        )}
        <p className="text-xs text-gray-400 mt-1">
          Guias de viaje, folletos, itinerarios guardados
        </p>
      </div>

      {files.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {files.map((f, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs px-2.5 py-1.5 rounded-lg">
              📄 {f.name}
              <span className="text-indigo-400">({formatSize(f.size)})</span>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                className="ml-0.5 text-indigo-400 hover:text-red-500 transition"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
