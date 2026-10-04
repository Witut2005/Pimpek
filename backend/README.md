# Backend (FastAPI)

    python3 -m venv .venv && .venv/bin/pip install -r requirements.txt pytest
    cp .env.example .env
    .venv/bin/uvicorn app.main:app --reload --port 8001

The Angular dev server proxies `/api` here (`frontend/proxy.conf.json`). Docs: http://localhost:8001/docs.
Tests: `.venv/bin/pytest`.

Only `GET /api/health` is left. The app keeps its mood journal on the device and fetches no data from
external sources: the Garmin, Open Wearables, Fitatu and Gemini food-rating endpoints were removed.
