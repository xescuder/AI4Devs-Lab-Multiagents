import { useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";

function formatLogContent(text) {
  const trimmed = text.trim();
  const jsonStart = trimmed.indexOf("{");
  const jsonEnd = trimmed.lastIndexOf("}");

  if (jsonStart !== -1 && jsonEnd > jsonStart) {
    try {
      const before = trimmed.slice(0, jsonStart).trim();
      const jsonStr = trimmed.slice(jsonStart, jsonEnd + 1);
      const parsed = JSON.parse(jsonStr);
      const formatted = JSON.stringify(parsed, null, 2);
      const after = trimmed.slice(jsonEnd + 1).trim();
      return (before ? before + "\n" : "") + "```json\n" + formatted + "\n```" + (after ? "\n" + after : "");
    } catch {}
  }
  return text;
}

export default function ChatPanel({ messages, onSendFeedback, canSend }) {
  const [input, setInput] = useState("");
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (input.trim() && canSend) {
      onSendFeedback(input.trim());
      setInput("");
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 rounded-2xl shadow-lg border border-gray-700 overflow-hidden">
      <div className="bg-gray-800 px-4 py-2.5 flex-shrink-0 flex items-center gap-2 border-b border-gray-700">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <div className="w-3 h-3 rounded-full bg-yellow-500" />
          <div className="w-3 h-3 rounded-full bg-green-500" />
        </div>
        <span className="text-gray-400 text-xs font-mono ml-2">CrewAI — Live Console</span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-0.5 font-mono text-xs console-scroll">
        {messages.map((msg, i) => {
          if (msg.role === "log") {
            const formatted = formatLogContent(msg.content);
            const hasMarkdown = formatted !== msg.content;
            return (
              <div key={i} className="text-gray-400 leading-5 hover:text-gray-300 transition-colors">
                {hasMarkdown ? (
                  <div className="prose prose-sm prose-invert max-w-none text-gray-400 [&_pre]:bg-gray-800 [&_pre]:p-2 [&_pre]:rounded [&_pre]:text-[11px] [&_pre]:my-1 [&_code]:text-amber-300">
                    <Markdown>{formatted}</Markdown>
                  </div>
                ) : (
                  <span>{msg.content}</span>
                )}
              </div>
            );
          }

          if (msg.role === "user") {
            return (
              <div key={i} className="text-green-400 leading-5 py-1">
                <span className="text-green-600">❯ </span>{msg.content}
              </div>
            );
          }

          if (msg.role === "system") {
            return (
              <div key={i} className="text-indigo-400 leading-5 py-0.5 font-semibold">
                <div className="prose prose-sm prose-invert max-w-none text-indigo-400 [&_strong]:text-indigo-300">
                  <Markdown>{msg.content}</Markdown>
                </div>
              </div>
            );
          }

          if (msg.role === "agent") {
            const formatted = formatLogContent(msg.content);
            return (
              <div key={i} className="text-cyan-300 leading-5 py-1 border-l-2 border-cyan-800 pl-2 my-1">
                <div className="prose prose-sm prose-invert max-w-none text-cyan-200 [&_strong]:text-cyan-100 [&_p]:my-0.5 [&_pre]:bg-gray-800 [&_pre]:p-2 [&_pre]:rounded [&_pre]:text-[11px] [&_pre]:my-1 [&_code]:text-amber-300">
                  <Markdown>{formatted}</Markdown>
                </div>
              </div>
            );
          }

          return null;
        })}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-gray-700 p-2 flex gap-2 flex-shrink-0 bg-gray-800">
        <span className="text-green-500 font-mono text-sm self-center">❯</span>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder={canSend ? "'ok' para aprobar..." : "esperando..."}
          disabled={!canSend}
          className="flex-1 px-2 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm text-green-300 font-mono placeholder-gray-600 focus:ring-1 focus:ring-green-500 focus:border-green-500 disabled:opacity-40 transition"
        />
        <button
          onClick={handleSend}
          disabled={!canSend || !input.trim()}
          className="px-3 py-1.5 bg-green-700 text-green-100 rounded text-xs font-mono hover:bg-green-600 disabled:opacity-30 disabled:cursor-not-allowed transition"
        >
          SEND
        </button>
      </div>
    </div>
  );
}
