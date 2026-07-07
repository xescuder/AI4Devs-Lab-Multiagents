#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "$0")" && pwd)"

# --- Backend setup ---
if [ ! -f "$DIR/.env" ]; then
  echo "⚠️  .env no encontrado. Copiando .env.example → .env (rellena las API keys)"
  cp "$DIR/.env.example" "$DIR/.env"
fi

if [ ! -d "$DIR/.venv" ]; then
  echo "Creando virtualenv..."
  python3 -m venv "$DIR/.venv"
fi
source "$DIR/.venv/bin/activate"
pip install -q -r "$DIR/requirements.txt"

# --- Frontend setup ---
if [ ! -d "$DIR/frontend/node_modules" ]; then
  echo "Instalando dependencias frontend..."
  npm --prefix "$DIR/frontend" install
fi

# --- Launch both ---
echo "Arrancando backend (8000) y frontend (5173)..."
trap 'kill 0' EXIT
uvicorn trip_planner_webapp.server:app --reload --port 8000 --app-dir "$DIR/.." &
npm --prefix "$DIR/frontend" run dev &
wait
