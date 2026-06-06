import { useCallback, useRef } from "react";

export default function ResizeDivider({ onResize }) {
  const dragging = useRef(false);

  const onMouseDown = useCallback((e) => {
    e.preventDefault();
    dragging.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const onMouseMove = (e) => {
      if (dragging.current) onResize(e.clientX);
    };

    const onMouseUp = () => {
      dragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, [onResize]);

  return (
    <div
      onMouseDown={onMouseDown}
      className="w-2 flex-shrink-0 cursor-col-resize group flex items-center justify-center hover:bg-indigo-100 transition rounded"
    >
      <div className="w-0.5 h-8 bg-gray-300 group-hover:bg-indigo-400 rounded-full transition" />
    </div>
  );
}
