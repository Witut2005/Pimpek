# Backend (FastAPI + Garmin Connect + Open Wearables)

    python3 -m venv .venv && .venv/bin/pip install -r requirements.txt pytest
    cp .env.example .env
    .venv/bin/uvicorn app.main:app --reload --port 8001

Port 8001, because Open Wearables uses 8000. The Angular dev server proxies `/api` here
(`frontend/proxy.conf.json`). Docs: http://localhost:8001/docs. Tests: `.venv/bin/pytest`.

## What the frontend uses
- `GET /api/sources`: connected wearables, `[{id:"garmin", via:"open_wearables"|"garmin_connect", connectedAt}]`
- `DELETE /api/sources/garmin`: disconnect, whichever way it was connected
- `GET /api/days?count=28&today=YYYY-MM-DD`: one row per day, newest first:
  `{date, source, sleepHours, sleepScore, steps, restingHr, runningKm, complete}`. Missing values are `null`.
  Returns 409 when nothing is connected.

`/api/days` reads from Open Wearables when it has an active Garmin connection for the user,
and from the direct Garmin login otherwise. If OW is down, it falls back to the direct login. Days older
than yesterday are cached in `data/cache/<user>.json`, so only the first sync is slow.

## Connecting Garmin
**Direct login** (works today):
1. `POST /api/garmin/connect` `{email, password}` -> `{status:"connected"}` or `{status:"mfa_required", mfa_session}`
2. If MFA: `POST /api/garmin/mfa` `{mfa_session, code}` -> `{status:"connected"}`

The password is never stored, only Garmin session tokens (`data/tokens/<user>/`).
This uses the unofficial `garminconnect` library, which is not covered by Garmin's official API terms.

Open Wearables lives in `open-wearables/` as a git submodule: clone with `git clone --recursive`,
or run `git submodule update --init` in an existing checkout. Its `backend/config/.env` is not in git.

**Official OAuth via Open Wearables**: `POST /api/wearables/connect/garmin` `{redirect_uri}` -> `{authorization_url}`.
This needs real `GARMIN_CLIENT_ID`/`GARMIN_CLIENT_SECRET` in `open-wearables/backend/config/.env`
(Garmin Connect Developer Program), plus OW reachable from the internet (e.g. `ngrok http 8000`) with
`https://<public-url>/api/v1/garmin/webhooks/push` registered in the Garmin portal. Garmin only pushes data.

Identity is the `X-User-Id` header (defaults to the hardcoded UUID `82b25836-a99e-4f59-8c7b-34d451ddcd90`), which is a placeholder for real auth.
