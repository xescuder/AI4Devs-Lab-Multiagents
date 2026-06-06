#!/usr/bin/env python3
"""
Agencia de Viajes Inteligente — FastAPI + WebSocket backend.

WebSocket bidireccional:
  Client → Server: {type: "start", inputs: {...}} | {type: "feedback", message: "..."}
  Server → Client: {type: "working", step: N} | {type: "proposal", step: N, content: "..."}
                  | {type: "done", content: "..."} | {type: "error", message: "..."}
"""

import asyncio
import json
import os
import queue
import re
import sys
import threading
import traceback
from pathlib import Path

PROJECT_DIR = Path(__file__).parent
REPO_ROOT = PROJECT_DIR.parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
load_dotenv(PROJECT_DIR / ".env")
load_dotenv()

app = FastAPI(title="Agencia de Viajes Inteligente")

STEPS = ["flight", "transport", "activities", "accommodation"]


# ---------------------------------------------------------------------------
# Environment check
# ---------------------------------------------------------------------------

@app.get("/api/check-env")
def check_env():
    errors = []
    env_file = PROJECT_DIR / ".env"
    if not env_file.exists():
        errors.append("No se encontró .env. Copia .env.example como .env.")
    if not os.getenv("OPENAI_API_KEY") and not os.getenv("GEMINI_API_KEY"):
        errors.append("OPENAI_API_KEY o GEMINI_API_KEY requerida.")
    if not os.getenv("SERPER_API_KEY"):
        errors.append("SERPER_API_KEY no configurada — sin imágenes de alojamientos.")
    return {"errors": errors, "ok": len([e for e in errors if "API_KEY" not in e or "SERPER" in e]) == 0}


# ---------------------------------------------------------------------------
# WebSocket HITL Provider
# ---------------------------------------------------------------------------

class WebSocketHumanInputProvider:
    def __init__(self, send_fn, receive_fn):
        self._send = send_fn
        self._receive = receive_fn
        self._step_index = 0

    def setup_messages(self, context) -> bool:
        return False

    def post_setup_messages(self, context) -> None:
        pass

    def handle_feedback(self, formatted_answer, context, _is_retry=False):
        agent_output = self._get_output_string(formatted_answer)
        step_idx = min(self._step_index, len(STEPS) - 1)
        if not _is_retry:
            self._step_index += 1

        self._send({"type": "chat", "role": "system",
                    "content": f"📋 Propuesta lista del paso {step_idx + 1}/4 ({STEPS[step_idx]})"})
        self._send({"type": "proposal", "step": step_idx, "content": agent_output})
        feedback = self._receive()

        if not feedback.strip() or feedback.strip().lower() in ("ok", "aprobado", "sí", "si", "yes"):
            context.ask_for_human_input = False
            return formatted_answer

        self._send({"type": "chat", "role": "user", "content": feedback})
        self._send({"type": "working", "step": step_idx})

        context.messages.append(context._format_feedback_message(feedback))
        new_answer = context._invoke_loop()
        return self.handle_feedback(new_answer, context, _is_retry=True)

    async def handle_feedback_async(self, formatted_answer, context):
        return self.handle_feedback(formatted_answer, context)

    @staticmethod
    def _get_output_string(answer) -> str:
        if isinstance(answer.output, str):
            return answer.output
        return answer.output.model_dump_json()


# ---------------------------------------------------------------------------
# Crew runner in thread
# ---------------------------------------------------------------------------

AGENT_STEP_MAP = {
    "Especialista en Vuelos Internacionales": 0,
    "Coordinador de Logística y Transporte Terrestre": 1,
    "Planificador de Actividades y Experiencias Locales": 2,
    "Curador de Alojamientos y Estancias Locales": 3,
}


class ConsoleCapture:
    """Captures stdout writes and forwards each line to the WebSocket as a log message."""

    def __init__(self, send_fn, original):
        self._send = send_fn
        self._original = original
        self._buffer = ""

    _ANSI_RE = re.compile(r"\x1b\[[0-9;]*m")
    _BOX_CHARS = str.maketrans("─│╭╰╮╯┌┐└┘├┤┬┴┼", "               ")

    def write(self, text):
        self._original.write(text)
        self._buffer += text
        while "\n" in self._buffer:
            line, self._buffer = self._buffer.split("\n", 1)
            clean = self._ANSI_RE.sub("", line).translate(self._BOX_CHARS).strip()
            if not clean or set(clean) <= {"-", "+", "=", "|", " ", "*"}:
                continue
            self._send({"type": "log", "content": clean})

    def flush(self):
        self._original.flush()

    def isatty(self):
        return False

    @property
    def encoding(self):
        return self._original.encoding


def run_crew_thread(inputs: dict, send_fn, receive_fn, done_fn, error_fn):
    import sys

    original_stdout = sys.stdout
    original_stderr = sys.stderr
    sys.stdout = ConsoleCapture(send_fn, original_stdout)
    sys.stderr = ConsoleCapture(send_fn, original_stderr)

    try:
        from crewai.core.providers.human_input import set_provider
        from .crew import TripPlannerCrew

        provider = WebSocketHumanInputProvider(send_fn, receive_fn)
        set_provider(provider)

        send_fn({"type": "working", "step": 0})

        numero_dias = int(inputs.get("numero_dias", 7))
        crew_obj = TripPlannerCrew().crew(numero_dias=numero_dias)
        result = crew_obj.kickoff(inputs=inputs)
        done_fn(result.raw)
    except Exception as e:
        error_fn(f"{e}\n\n{traceback.format_exc()}")
    finally:
        sys.stdout = original_stdout
        sys.stderr = original_stderr


# ---------------------------------------------------------------------------
# WebSocket endpoint
# ---------------------------------------------------------------------------

@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()

    loop = asyncio.get_event_loop()
    feedback_queue = queue.Queue()

    def send_sync(msg: dict):
        asyncio.run_coroutine_threadsafe(ws.send_json(msg), loop)

    def receive_sync() -> str:
        return feedback_queue.get()

    def on_done(content: str):
        asyncio.run_coroutine_threadsafe(
            ws.send_json({"type": "done", "content": content}), loop
        )

    def on_error(message: str):
        asyncio.run_coroutine_threadsafe(
            ws.send_json({"type": "error", "message": message}), loop
        )

    try:
        while True:
            data = await ws.receive_json()

            if data["type"] == "start":
                while not feedback_queue.empty():
                    feedback_queue.get_nowait()
                inputs = data["inputs"]
                threading.Thread(
                    target=run_crew_thread,
                    args=(inputs, send_sync, receive_sync, on_done, on_error),
                    daemon=True,
                ).start()

            elif data["type"] == "feedback":
                feedback_queue.put(data.get("message", ""))

    except WebSocketDisconnect:
        pass
    except Exception:
        pass


# ---------------------------------------------------------------------------
# Serve frontend
# ---------------------------------------------------------------------------

FRONTEND_DIR = PROJECT_DIR / "frontend" / "dist"

if FRONTEND_DIR.exists():
    @app.get("/")
    async def serve_index():
        return FileResponse(FRONTEND_DIR / "index.html")

    app.mount("/", StaticFiles(directory=str(FRONTEND_DIR)), name="frontend")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "src.lab4_tip_planner.server:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )
