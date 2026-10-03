# Backend (FastAPI + Garmin Connect)

    python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
    cp .env.example .env
    .venv/bin/uvicorn app.main:app --reload --port 8000

Docs: http://localhost:8000/docs

## Garmin onboarding flow
1. `POST /api/garmin/connect` `{email, password}` -> `{status:"connected"}` or `{status:"mfa_required", mfa_session}`
2. If MFA: `POST /api/garmin/mfa` `{mfa_session, code}` -> `{status:"connected"}`
3. `GET /api/garmin/status`, `POST /api/garmin/disconnect`
4. `GET /api/garmin/activities?start=0&limit=10`, `GET /api/garmin/activities/{id}`

The password is never stored, only Garmin session tokens (`data/tokens/<user>/`).
Identity is the `X-User-Id` header (default `demo`), which is a placeholder for real auth.
This uses the unofficial `garminconnect` library, which is not covered by Garmin's official API terms.
