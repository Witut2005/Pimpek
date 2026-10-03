"""One normalised day of wearable data, whichever watch it comes from.

Open Wearables wins when the user has any active wearable connection there (Garmin,
Polar, Fitbit, Oura, Whoop, Withings… via official OAuth): it already normalises every
provider into the same summaries. Otherwise we fall back to the direct Garmin Connect
login. The frontend only ever sees `/api/days`, so a new watch needs no frontend change
beyond its source card.

A day is keyed by local calendar date; sleep belongs to the day you woke up.
"""
import json
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta
from typing import Any

from garminconnect import GarminConnectConnectionError

from . import garmin_service as garmin
from . import open_wearables as ow
from .config import settings

PROVIDER = "garmin"
# Open Wearables providers that measure sleep and/or steps — the ones that can feed Pimpek's day.
# Pull-based ones are polled by OW; Garmin is webhook-only.
OW_WEARABLES = ("garmin", "polar", "fitbit", "oura", "whoop", "withings", "suunto", "google_health", "ultrahuman")
OW_PULL = set(OW_WEARABLES) - {"garmin"}
# Ask OW to poll a pull provider at most this often when the app reads the days.
OW_SYNC_EVERY_S = 15 * 60
RUN_TYPES = {"running", "trail_running", "treadmill_running", "track_running", "indoor_running", "street_running", "virtual_run", "ultra_run"}
# Days older than this are final and safe to cache: the watch has synced, sleep is scored.
SETTLED_AFTER_DAYS = 2
GARMIN_WORKERS = 4

_last_ow_sync: dict[tuple[str, str], float] = {}


class NoSource(LookupError):
    pass


def _iso(ts: float | None) -> str | None:
    return datetime.fromtimestamp(ts).isoformat() if ts else None


def _ow_connections(user_id: str) -> list[dict[str, Any]]:
    """Active OW wearable connections, oldest first; empty if OW is off, down or nothing is linked."""
    if not ow.is_configured():
        return []
    try:
        active = [
            c
            for c in ow.connections(user_id) or []
            if c.get("provider") in OW_WEARABLES and c.get("status") == "active"
        ]
    except (ow.OpenWearablesError, ow.OpenWearablesUnavailable):
        return []
    return sorted(active, key=lambda c: c.get("created_at") or "")


def _ow_connection(user_id: str) -> dict[str, Any] | None:
    """The wearable whose data leads (the first one linked), or None."""
    conns = _ow_connections(user_id)
    return conns[0] if conns else None


def connectable() -> list[str]:
    """OW providers the team has real OAuth credentials for (OPEN_WEARABLES_PROVIDERS)."""
    if not ow.is_configured():
        return []
    return [p for p in settings.open_wearables_provider_list if p in OW_WEARABLES or p == "strava"]


def sources(user_id: str) -> list[dict[str, Any]]:
    result = [
        {"id": c["provider"], "via": "open_wearables", "connectedAt": c.get("created_at")}
        for c in _ow_connections(user_id)
    ]
    status = garmin.status(user_id)
    if status.get("connected") and not any(r["id"] == PROVIDER for r in result):
        result.append(
            {
                "id": PROVIDER,
                "via": "garmin_connect",
                "connectedAt": _iso(status.get("connected_at")),
                "name": status.get("full_name") or status.get("display_name"),
            }
        )
    return result


def disconnect(user_id: str, provider: str = PROVIDER) -> None:
    if any(c["provider"] == provider for c in _ow_connections(user_id)):
        ow.disconnect(user_id, provider)
    if provider == PROVIDER:
        garmin.disconnect(user_id)
    _cache_path(user_id).unlink(missing_ok=True)


def _nudge_ow_sync(user_id: str, provider: str) -> None:
    """Pull providers only refresh when OW polls them; ask for a poll now and then. Never fails the read."""
    if provider not in OW_PULL:
        return
    key = (user_id, provider)
    if time.time() - _last_ow_sync.get(key, 0) < OW_SYNC_EVERY_S:
        return
    _last_ow_sync[key] = time.time()
    try:
        ow.sync(user_id, provider)
    except (ow.OpenWearablesError, ow.OpenWearablesUnavailable):
        pass


def _blank(day: str, today: str, source: str = PROVIDER) -> dict[str, Any]:
    return {
        "date": day,
        "source": source,
        "sleepHours": None,
        "sleepScore": None,
        "steps": None,
        "restingHr": None,
        "runningKm": None,
        "complete": day < today,
    }


METRICS = ("sleepHours", "sleepScore", "steps", "restingHr", "runningKm")


def _has_data(entry: dict[str, Any]) -> bool:
    """A day with nothing measured must not be cached: the watch may still sync it later."""
    return any(entry.get(k) is not None for k in METRICS)


def _round(value: float | None, digits: int = 2) -> float | None:
    return round(value, digits) if value is not None else None


# --- Garmin Connect (direct login) ------------------------------------------------


def _cache_path(user_id: str):
    return settings.cache_dir / f"{user_id}.json"


def _read_cache(user_id: str) -> dict[str, dict[str, Any]]:
    path = _cache_path(user_id)
    try:
        return json.loads(path.read_text()) if path.exists() else {}
    except ValueError:
        return {}


def _write_cache(user_id: str, cache: dict[str, dict[str, Any]]) -> None:
    path = _cache_path(user_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(cache))


def _garmin_day(client, day: str, today: str) -> dict[str, Any]:
    out = _blank(day, today)
    summary = client.get_user_summary(day) or {}
    out["steps"] = summary.get("totalSteps")
    out["restingHr"] = summary.get("restingHeartRate")
    sleep = (client.get_sleep_data(day) or {}).get("dailySleepDTO") or {}
    seconds = sleep.get("sleepTimeSeconds")
    out["sleepHours"] = _round(seconds / 3600) if seconds else None
    out["sleepScore"] = ((sleep.get("sleepScores") or {}).get("overall") or {}).get("value")
    return out


def _garmin_runs(client, start: str, end: str) -> dict[str, float]:
    km: dict[str, float] = {}
    for activity in client.get_activities_by_date(start, end) or []:
        if (activity.get("activityType") or {}).get("typeKey") not in RUN_TYPES:
            continue
        day = (activity.get("startTimeLocal") or "")[:10]
        km[day] = km.get(day, 0) + (activity.get("distance") or 0) / 1000
    return km


def _from_garmin(user_id: str, days: list[str], today: str) -> list[dict[str, Any]]:
    client = garmin.client(user_id)
    cache = _read_cache(user_id)
    settled = (date.fromisoformat(today) - timedelta(days=SETTLED_AFTER_DAYS)).isoformat()
    missing = [d for d in days if d not in cache or d > settled or not _has_data(cache[d])]

    def fetch(day: str) -> dict[str, Any] | None:
        try:
            return _garmin_day(client, day, today)
        except GarminConnectConnectionError:
            return None  # one bad day must not sink the sync; retried next time

    with ThreadPoolExecutor(GARMIN_WORKERS) as pool:
        fetched = dict(zip(missing, pool.map(fetch, missing)))
    runs = _garmin_runs(client, days[-1], days[0])

    result = []
    for day in days:
        entry = fetched.get(day) or cache.get(day) or _blank(day, today)
        entry = {**entry, "runningKm": _round(runs.get(day))}
        if day in fetched and fetched[day] and day <= settled and _has_data(entry):
            cache[day] = entry
        result.append(entry)
    _write_cache(user_id, cache)
    return result


# --- Open Wearables -------------------------------------------------------------


def _from_ow(user_id: str, days: list[str], today: str, source: str = PROVIDER) -> list[dict[str, Any]]:
    start, end = days[-1], (date.fromisoformat(days[0]) + timedelta(days=1)).isoformat()
    by_day = {d: _blank(d, today, source) for d in days}

    for row in ow.activity_summaries(user_id, start, end):
        if (day := str(row.get("date"))) in by_day:
            by_day[day]["steps"] = row.get("steps")
    for row in ow.sleep_summaries(user_id, start, end):
        if (day := str(row.get("date"))) in by_day and row.get("duration_minutes"):
            by_day[day]["sleepHours"] = _round(row["duration_minutes"] / 60)
    for row in ow.resting_hr_samples(user_id, start, end):
        if (day := str(row.get("timestamp", ""))[:10]) in by_day:
            by_day[day]["restingHr"] = round(row["value"])
    for row in ow.workout_events(user_id, start, end):
        day = str(row.get("start_time", ""))[:10]
        if day in by_day and row.get("type") in RUN_TYPES and row.get("distance_meters"):
            by_day[day]["runningKm"] = _round((by_day[day]["runningKm"] or 0) + row["distance_meters"] / 1000)
    return [by_day[d] for d in days]


# --- Public ---------------------------------------------------------------------


def days(user_id: str, count: int, today: str | None = None) -> dict[str, Any]:
    """`count` days ending at `today`, newest first."""
    today = today or date.today().isoformat()
    end = date.fromisoformat(today)
    keys = [(end - timedelta(days=i)).isoformat() for i in range(count)]
    started = time.time()
    source = PROVIDER
    if conn := _ow_connection(user_id):
        source = conn["provider"]
        _nudge_ow_sync(user_id, source)
        via, data = "open_wearables", _from_ow(user_id, keys, today, source)
    elif garmin.status(user_id).get("connected"):
        via, data = "garmin_connect", _from_garmin(user_id, keys, today)
    else:
        raise NoSource("No wearable is connected for this user")
    return {
        "source": source,
        "via": via,
        "syncedAt": datetime.now().isoformat(timespec="seconds"),
        "tookMs": int((time.time() - started) * 1000),
        "days": data,
    }
