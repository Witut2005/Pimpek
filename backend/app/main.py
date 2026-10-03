import logging

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from garminconnect import (
    GarminConnectAuthenticationError,
    GarminConnectConnectionError,
    GarminConnectTooManyRequestsError,
)
from pydantic import BaseModel, Field

from . import daily
from . import fitatu_service as fitatu
from . import garmin_service as garmin
from . import nutrition
from . import open_wearables as ow
from .config import settings
from .main_deps import current_user
from .wearables_router import router as wearables_router

app = FastAPI(title="HackYeah API")
# uvicorn's own logger, so warnings land in the same terminal with the same format.
log = logging.getLogger("uvicorn.error")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _map_garmin_errors(fn, *args):
    try:
        return fn(*args)
    except garmin.NotConnected as e:
        raise HTTPException(409, str(e))
    except garmin.MfaSessionNotFound as e:
        raise HTTPException(410, str(e))
    except daily.NoSource as e:
        raise HTTPException(409, str(e))
    except ow.OpenWearablesError as e:
        raise HTTPException(404 if e.status == 404 else 502, f"Open Wearables: {e.detail}")
    except ow.OpenWearablesUnavailable:
        raise HTTPException(503, "Open Wearables is not reachable")
    except GarminConnectAuthenticationError:
        raise HTTPException(401, "Garmin rejected the credentials or the session expired")
    except GarminConnectTooManyRequestsError:
        raise HTTPException(429, "Garmin is rate limiting us, try again later")
    except GarminConnectConnectionError:
        raise HTTPException(502, "Could not reach Garmin")


def _map_fitatu_errors(fn, *args):
    try:
        return fn(*args)
    except fitatu.NotConnected as e:
        raise HTTPException(409, str(e))
    except fitatu.InvalidCredentials as e:
        raise HTTPException(401, str(e))
    except fitatu.FitatuError as e:
        # Fitatu's API is unofficial: when it changes, its answer here is the first clue.
        log.warning("Fitatu returned %s: %s", e.status, e.detail)
        if e.status == 429:
            raise HTTPException(429, "Fitatu is rate limiting us, try again later")
        raise HTTPException(502, f"Fitatu: {e.detail}")
    except fitatu.FitatuUnavailable as e:
        log.warning("Could not reach Fitatu: %s", e)
        raise HTTPException(502, "Could not reach Fitatu")

app.include_router(wearables_router)


class ConnectBody(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=1, max_length=256)


class MfaBody(BaseModel):
    mfa_session: str
    code: str = Field(min_length=4, max_length=12)


@app.get("/api/health")
def health():
    return {"ok": True}


@app.post("/api/garmin/connect")
def connect(body: ConnectBody, user: str = Depends(current_user)):
    return _map_garmin_errors(garmin.start_login, user, body.email, body.password)


@app.post("/api/garmin/mfa")
def mfa(body: MfaBody, user: str = Depends(current_user)):
    return _map_garmin_errors(garmin.finish_mfa, user, body.mfa_session, body.code)


@app.get("/api/garmin/status")
def garmin_status(user: str = Depends(current_user)):
    return garmin.status(user)


@app.post("/api/garmin/disconnect")
def disconnect(user: str = Depends(current_user)):
    garmin.disconnect(user)
    return {"connected": False}


@app.get("/api/garmin/activities")
def activities(
    start: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
    user: str = Depends(current_user),
):
    return _map_garmin_errors(garmin.list_activities, user, start, limit)


@app.get("/api/garmin/activities/{activity_id}")
def activity(activity_id: str, user: str = Depends(current_user)):
    if not activity_id.isdigit():
        raise HTTPException(400, "activity id must be numeric")
    return _map_garmin_errors(garmin.get_activity, user, activity_id)


# --- Unified wearable data for the frontend -------------------------------------


@app.get("/api/sources")
def sources(user: str = Depends(current_user)):
    """Connected sources: [{id, via: open_wearables|garmin_connect|fitatu, connectedAt}]."""
    return daily.sources(user) + nutrition.sources(user)


@app.delete("/api/sources/garmin")
def disconnect_source(user: str = Depends(current_user)):
    _map_garmin_errors(daily.disconnect, user)
    return {"connected": False}


@app.delete("/api/sources/fitatu")
def disconnect_fitatu(user: str = Depends(current_user)):
    fitatu.disconnect(user)
    return {"connected": False}


@app.get("/api/days")
def days(
    count: int = Query(28, ge=1, le=60),
    today: str | None = Query(None, pattern=r"^\d{4}-\d{2}-\d{2}$"),
    user: str = Depends(current_user),
):
    """Sleep, steps, resting HR and running km per day, newest first."""
    return _map_garmin_errors(daily.days, user, count, today)


# --- Meals (Fitatu) ---------------------------------------------------------------


@app.post("/api/fitatu/connect")
def fitatu_connect(body: ConnectBody, user: str = Depends(current_user)):
    return _map_fitatu_errors(fitatu.login, user, body.email, body.password)


@app.get("/api/meals")
def meals(
    date: str | None = Query(None, pattern=r"^\d{4}-\d{2}-\d{2}$"),
    user: str = Depends(current_user),
):
    """One day's meals with their items, and the day's kcal/macro totals."""
    return _map_fitatu_errors(nutrition.meals, user, date)
