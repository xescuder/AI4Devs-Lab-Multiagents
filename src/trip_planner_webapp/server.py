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
import shutil
import sys
import threading
import time
import traceback
import uuid
from pathlib import Path

PROJECT_DIR = Path(__file__).parent
REPO_ROOT = PROJECT_DIR.parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from dotenv import load_dotenv
from fastapi import FastAPI, File, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
load_dotenv(PROJECT_DIR / ".env")
load_dotenv()

app = FastAPI(title="Agencia de Viajes Inteligente")

STEPS = ["flight", "activities", "accommodation", "transport"]


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
# PDF upload
# ---------------------------------------------------------------------------

UPLOAD_DIR = PROJECT_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)


def _cleanup_old_uploads():
    cutoff = time.time() - 2 * 3600
    for f in UPLOAD_DIR.iterdir():
        if f.is_file() and f.stat().st_mtime < cutoff:
            f.unlink(missing_ok=True)


@app.post("/api/upload-pdfs")
async def upload_pdfs(files: list[UploadFile] = File(...)):
    _cleanup_old_uploads()
    saved = []
    for f in files:
        if not f.filename.lower().endswith(".pdf"):
            continue
        if f.size and f.size > 20 * 1024 * 1024:
            continue
        unique_name = f"{uuid.uuid4().hex}_{f.filename}"
        dest = UPLOAD_DIR / unique_name
        with open(dest, "wb") as out:
            shutil.copyfileobj(f.file, out)
        saved.append(str(dest))
    return {"files": saved, "count": len(saved)}


# ---------------------------------------------------------------------------
# Natural language trip parsing
# ---------------------------------------------------------------------------

PARSE_PROMPT = """Extract travel details from the user's description and return a JSON object.
If a field is not mentioned, use a reasonable default.

Required fields:
- pais_origen: origin city/country (default: "Madrid")
- pais_destino: destination city/country
- numero_adultos: number of adults (default: "2")
- numero_dias: number of days (calculate from dates if given)
- fecha_ida: departure date YYYY-MM-DD (default: 2 weeks from today)
- fecha_vuelta: return date YYYY-MM-DD
- flexibilidad_dias: date flexibility in days (default: "3")
- tipo_vuelo: "solo vuelos directos" or "vuelos directos o con máximo 1 escala"
- presupuesto_max_noche: max budget per night in EUR (default: "120")

Return ONLY valid JSON, no other text.

User description: {description}"""


@app.post("/api/parse-trip")
async def parse_trip(body: dict):
    description = body.get("description", "")
    if not description.strip():
        return {"error": "Descripción vacía"}

    try:
        from openai import OpenAI

        client = OpenAI()
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": PARSE_PROMPT.format(description=description)}],
            response_format={"type": "json_object"},
            temperature=0,
        )
        result = json.loads(response.choices[0].message.content)

        if "pais_destino" not in result or not result["pais_destino"]:
            return {"error": "No se pudo identificar el destino del viaje."}

        for key in ["numero_adultos", "numero_dias", "flexibilidad_dias", "presupuesto_max_noche"]:
            if key in result:
                result[key] = str(result[key])

        return result

    except Exception as e:
        return {"error": f"Error al interpretar: {str(e)}"}


# ---------------------------------------------------------------------------
# WebSocket HITL Provider
# ---------------------------------------------------------------------------

PREF_CLASSIFY_PROMPT = """El usuario ha dado este feedback sobre su planificación de viaje: "{feedback}"

¿Contiene una PREFERENCIA GENERAL reutilizable para futuros viajes?
Responde SOLO con JSON: {{"is_preference": true/false, "preference": "texto de la preferencia si aplica"}}

Ejemplos de preferencias generales: "prefiero vuelos matutinos", "no me gustan museos", "busco hoteles céntricos", "prefiero alojamientos con cocina"
Ejemplos que NO son preferencias (son cambios puntuales): "añade la Torre Eiffel", "cambia la fecha al 15", "pon 3 actividades el día 2", "quita el hotel X"
"""


class WebSocketHumanInputProvider:
    def __init__(self, send_fn, receive_fn, memory=None):
        self._send = send_fn
        self._receive = receive_fn
        self._memory = memory
        self._step_index = 0

    def setup_messages(self, context) -> bool:
        return False

    def post_setup_messages(self, context) -> None:
        pass

    def _maybe_save_preference(self, feedback, step_idx):
        if not self._memory:
            return
        try:
            from openai import OpenAI
            client = OpenAI()
            resp = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": PREF_CLASSIFY_PROMPT.format(feedback=feedback)}],
                response_format={"type": "json_object"},
                temperature=0,
            )
            result = json.loads(resp.choices[0].message.content)
            if result.get("is_preference") and result.get("preference"):
                step_name = STEPS[step_idx] if step_idx < len(STEPS) else "general"
                self._memory.remember(
                    content=result["preference"],
                    scope=f"preference_{step_name}",
                    categories=["user_preference", step_name],
                    importance=0.8,
                )
                self._send({
                    "type": "log",
                    "content": f"🧠 Preferencia guardada: {result['preference']}",
                })
        except Exception:
            pass

    def _recall_preferences(self, step_idx):
        if not self._memory:
            return
        try:
            step_name = STEPS[step_idx] if step_idx < len(STEPS) else "general"
            prefs = self._memory.recall(
                f"preferencias del usuario para {step_name}",
                scope=f"preference_{step_name}",
                limit=5,
            )
            if prefs:
                pref_text = "\n".join(f"  • {p.record.content}" for p in prefs)
                self._send({
                    "type": "log",
                    "content": f"🧠 Preferencias recordadas:\n{pref_text}",
                })
        except Exception:
            pass

    def handle_feedback(self, formatted_answer, context, _is_retry=False):
        agent_output = self._get_output_string(formatted_answer)
        step_idx = min(self._step_index, len(STEPS) - 1)
        if not _is_retry:
            self._step_index += 1

        self._recall_preferences(step_idx)
        self._send({"type": "chat", "role": "system",
                    "content": f"📋 Propuesta lista del paso {step_idx + 1}/4 ({STEPS[step_idx]})"})
        self._send({"type": "proposal", "step": step_idx, "content": agent_output})
        feedback = self._receive()

        if not feedback.strip() or feedback.strip().lower() in ("ok", "aprobado", "sí", "si", "yes"):
            context.ask_for_human_input = False
            next_step = min(step_idx + 1, len(STEPS) - 1)
            if step_idx < len(STEPS) - 1:
                self._send({"type": "working", "step": next_step})
            return formatted_answer

        self._maybe_save_preference(feedback, step_idx)
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
    "Investigador de Itinerarios de Viaje": 1,
    "Curador de Experiencias Imprescindibles": 1,
    "Planificador de Rutas con Timetable y Mapa": 1,
    "Curador de Alojamientos y Estancias Locales": 2,
    "Coordinador de Logística y Transporte Terrestre": 3,
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
        from .crew import TripPlannerCrew, user_memory

        provider = WebSocketHumanInputProvider(send_fn, receive_fn, memory=user_memory)
        set_provider(provider)

        send_fn({"type": "working", "step": 0})

        crew_obj = TripPlannerCrew().crew()
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
                inputs.setdefault("pdf_file_paths", "[]")
                inputs.setdefault("hora_max_salida", "12:00")
                inputs.setdefault("hora_max_salida_num", "12")
                inputs.setdefault("alojamiento_bano_privado", "Sí")
                inputs.setdefault("alojamiento_cocina", "Preferible")
                inputs.setdefault("numero_noches", str(max(1, int(inputs.get("numero_dias", "7")) - 1)))
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
        "trip_planner_webapp.server:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )
