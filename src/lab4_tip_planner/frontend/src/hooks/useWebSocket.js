import { useCallback, useEffect, useRef, useState } from "react";

const STEPS = [
  { key: "flight", icon: "✈️", title: "Vuelos" },
  { key: "activities", icon: "🗺️", title: "Itinerario" },
  { key: "accommodation", icon: "🏠", title: "Alojamientos" },
  { key: "transport", icon: "🚗", title: "Transporte" },
];

export { STEPS };

export function useWebSocket() {
  const ws = useRef(null);
  const [connected, setConnected] = useState(false);
  const [phase, setPhase] = useState("config");
  const [currentStep, setCurrentStep] = useState(-1);
  const [stepStates, setStepStates] = useState(["pending", "pending", "pending", "pending"]);
  const [proposal, setProposal] = useState(null);
  const [finalReport, setFinalReport] = useState("");
  const [error, setError] = useState("");
  const [chatMessages, setChatMessages] = useState([]);
  const [stepResults, setStepResults] = useState(["", "", "", ""]);
  const [stepTimes, setStepTimes] = useState([null, null, null, null]);
  const stepStartRef = useRef([0, 0, 0, 0]);
  const [tripConfig, setTripConfig] = useState({});
  const proposalRef = useRef(null);

  const addChat = useCallback((role, content) => {
    setChatMessages((prev) => [...prev, { role, content, ts: Date.now() }]);
  }, []);

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${protocol}//${window.location.host}/ws`;
    const socket = new WebSocket(url);

    socket.onopen = () => setConnected(true);
    socket.onclose = () => setConnected(false);
    socket.onerror = () => setConnected(false);

    socket.onmessage = (event) => {
      const msg = JSON.parse(event.data);

      if (msg.type === "working") {
        setPhase("running");
        setCurrentStep(msg.step);
        stepStartRef.current[msg.step] = Date.now();
        setStepStates((prev) => {
          const next = [...prev];
          next[msg.step] = "working";
          return next;
        });
        addChat("system", `⏳ ${STEPS[msg.step].icon} ${STEPS[msg.step].title}: procesando...`);

      } else if (msg.type === "proposal") {
        const elapsed = stepStartRef.current[msg.step]
          ? Math.round((Date.now() - stepStartRef.current[msg.step]) / 1000)
          : null;
        setStepTimes((prev) => {
          const next = [...prev];
          next[msg.step] = elapsed;
          return next;
        });
        setCurrentStep(msg.step);
        const newProposal = { step: msg.step, content: msg.content };
        setProposal(newProposal);
        proposalRef.current = newProposal;
        setStepStates((prev) => {
          const next = [...prev];
          for (let i = 0; i < msg.step; i++) next[i] = "done";
          next[msg.step] = "review";
          return next;
        });
        addChat("agent", msg.content);

      } else if (msg.type === "chat") {
        addChat(msg.role, msg.content);

      } else if (msg.type === "log") {
        addChat("log", msg.content);

      } else if (msg.type === "done") {
        setPhase("done");
        setFinalReport(msg.content);
        setStepStates(["done", "done", "done", "done"]);
        setProposal(null);
        addChat("system", "✅ ¡Planificación completada!");

      } else if (msg.type === "error") {
        setPhase("error");
        setError(msg.message);
        addChat("system", `❌ Error: ${msg.message.split("\n")[0]}`);
      }
    };

    ws.current = socket;
    return () => socket.close();
  }, [addChat]);

  const startPlanning = useCallback((inputs) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      setPhase("running");
      setCurrentStep(0);
      setStepStates(["working", "pending", "pending", "pending", "pending"]);
      setProposal(null);
      setFinalReport("");
      setError("");
      setStepResults(["", "", "", ""]);
      setStepTimes([null, null, null, null]);
      stepStartRef.current = [0, 0, 0, 0];
      setTripConfig(inputs);
      setChatMessages([{ role: "system", content: `🚀 Iniciando planificación: ${inputs.pais_origen} → ${inputs.pais_destino}`, ts: Date.now() }]);
      ws.current.send(JSON.stringify({ type: "start", inputs }));
    }
  }, []);

  const sendFeedback = useCallback((message) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ type: "feedback", message }));
      addChat("user", message);

      const currentProposal = proposalRef.current;
      if (!message.trim() || ["ok", "aprobado", "sí", "si", "yes"].includes(message.trim().toLowerCase())) {
        if (currentProposal) {
          setStepResults((prev) => {
            const next = [...prev];
            next[currentProposal.step] = currentProposal.content;
            return next;
          });
        }
        setStepStates((prev) => {
          const next = [...prev];
          if (currentProposal) {
            next[currentProposal.step] = "done";
            if (currentProposal.step + 1 < 4) next[currentProposal.step + 1] = "working";
          }
          return next;
        });
        setProposal(null);
        proposalRef.current = null;
      }
    }
  }, [addChat]);

  return {
    connected, phase, currentStep, stepStates, proposal,
    finalReport, error, chatMessages, stepResults, stepTimes,
    tripConfig, startPlanning, sendFeedback,
  };
}
