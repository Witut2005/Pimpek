from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from . import open_wearables as ow
from .config import settings
from .main_deps import current_user

router = APIRouter(prefix="/api/wearables", tags=["wearables"])

# Every Open Wearables provider with a cloud API (Apple/Samsung/Health Connect need the mobile SDK).
Provider = Literal[
    "garmin", "polar", "suunto", "whoop", "oura", "fitbit", "withings", "strava", "google_health", "ultrahuman"
]
# Pull-based providers: OW polls them, so "sync now" means asking for a poll. Garmin only pushes.
PullProvider = Literal[
    "polar", "suunto", "whoop", "oura", "fitbit", "withings", "strava", "google_health", "ultrahuman"
]


def _call(fn, *args):
    try:
        return fn(*args)
    except ow.OpenWearablesError as e:
        # Upstream 4xx/5xx is reported as 502 (except not-found), never leaking the API key.
        raise HTTPException(404 if e.status == 404 else 502, f"Open Wearables: {e.detail}")
    except ow.OpenWearablesUnavailable:
        raise HTTPException(503, "Open Wearables is not reachable")


class ConnectBody(BaseModel):
    redirect_uri: str


@router.get("/providers")
def providers(user: str = Depends(current_user)):
    return _call(ow.providers)


@router.post("/connect/{provider}")
def connect(provider: Provider, body: ConnectBody, user: str = Depends(current_user)):
    """Step 3 'Connect'. Returns {authorization_url, state}; the frontend redirects there."""
    if not ow.redirect_allowed(body.redirect_uri):
        raise HTTPException(400, "redirect_uri origin is not allowed")
    # Without real client credentials the provider's login page would just reject the user.
    if provider not in settings.open_wearables_provider_list:
        raise HTTPException(409, f"{provider} has no OAuth credentials configured in Open Wearables")
    return _call(ow.authorize_url, user, provider, body.redirect_uri)


@router.get("/connections")
def connections(user: str = Depends(current_user)):
    return _call(ow.connections, user)


@router.post("/garmin/backfill")
def garmin_backfill(user: str = Depends(current_user)):
    """Ask Garmin to push up to 30 days of history to the Open Wearables webhook."""
    return _call(ow.garmin_backfill, user)


@router.post("/{provider}/sync")
def sync(provider: PullProvider, user: str = Depends(current_user)):
    """Pull-style sync. Garmin has no polling, it is webhook-only."""
    return _call(ow.sync, user, provider)


@router.get("/workouts")
def workouts(
    start_date: str | None = None,
    end_date: str | None = None,
    user: str = Depends(current_user),
):
    return _call(ow.workouts, user, start_date, end_date)


@router.get("/sleep")
def sleep(
    start_date: str | None = None,
    end_date: str | None = None,
    user: str = Depends(current_user),
):
    return _call(ow.sleep, user, start_date, end_date)


@router.get("/timeseries")
def timeseries(
    types: list[str] = Query(default=[]),
    start_time: str | None = None,
    end_time: str | None = None,
    user: str = Depends(current_user),
):
    return _call(ow.timeseries, user, start_time, end_time, types)
