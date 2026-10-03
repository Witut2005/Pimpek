"""Thin client for a self-hosted Open Wearables instance (https://openwearables.io).

Open Wearables owns the provider OAuth (Garmin, Polar, Suunto, Apple...), webhooks
and data normalisation. We only map our users onto its users and proxy reads, so
the API key never reaches the browser.
"""
import json
import threading
from datetime import date, timedelta
from typing import Any
from urllib.parse import urlparse

import httpx

from .config import settings

_map_lock = threading.Lock()


class OpenWearablesError(Exception):
    def __init__(self, status: int, detail: Any):
        self.status = status
        self.detail = detail
        super().__init__(f"Open Wearables returned {status}: {detail}")


class OpenWearablesUnavailable(Exception):
    pass


def _http() -> httpx.Client:
    return httpx.Client(
        base_url=settings.open_wearables_url.rstrip("/") + "/api/v1",
        headers={"X-Open-Wearables-API-Key": settings.open_wearables_api_key},
        timeout=20,
        transport=_transport,
    )


# Tests swap this for httpx.MockTransport.
_transport: httpx.BaseTransport | None = None


def _request(method: str, path: str, **kwargs) -> Any:
    try:
        with _http() as client:
            resp = client.request(method, path, **kwargs)
    except httpx.TransportError as e:
        raise OpenWearablesUnavailable(str(e)) from e
    if resp.status_code >= 400:
        try:
            detail = resp.json()
        except ValueError:
            detail = resp.text[:300]
        raise OpenWearablesError(resp.status_code, detail)
    return resp.json() if resp.content else None


def _load_map() -> dict[str, str]:
    path = settings.user_map_file
    return json.loads(path.read_text()) if path.exists() else {}


def ow_user_id(app_user_id: str) -> str:
    """Return the Open Wearables user id for our user, creating it on first use."""
    with _map_lock:
        mapping = _load_map()
        if app_user_id in mapping:
            return mapping[app_user_id]
        created = _request(
            "POST",
            "/users",
            json={"external_user_id": app_user_id},
        )
        mapping[app_user_id] = created["id"]
        settings.user_map_file.parent.mkdir(parents=True, exist_ok=True)
        settings.user_map_file.write_text(json.dumps(mapping))
        return created["id"]


def redirect_allowed(redirect_uri: str) -> bool:
    """Only send users back to our own frontend origins (no open redirect)."""
    parsed = urlparse(redirect_uri)
    origin = f"{parsed.scheme}://{parsed.netloc}"
    return origin in settings.cors_origin_list


def providers() -> Any:
    return _request("GET", "/oauth/providers", params={"enabled_only": "true"})


def authorize_url(app_user_id: str, provider: str, redirect_uri: str) -> Any:
    return _request(
        "GET",
        f"/oauth/{provider}/authorize",
        params={"user_id": ow_user_id(app_user_id), "redirect_uri": redirect_uri},
    )


def connections(app_user_id: str) -> Any:
    return _request("GET", f"/users/{ow_user_id(app_user_id)}/connections")


def _date_range(start_date: str | None, end_date: str | None) -> dict[str, str]:
    """Open Wearables requires both dates; default to the last 30 days (end is inclusive-ish)."""
    return {
        "start_date": start_date or (date.today() - timedelta(days=30)).isoformat(),
        "end_date": end_date or (date.today() + timedelta(days=1)).isoformat(),
    }


def workouts(app_user_id: str, start_date: str | None, end_date: str | None) -> Any:
    return _request(
        "GET",
        f"/users/{ow_user_id(app_user_id)}/events/workouts",
        params=_date_range(start_date, end_date),
    )


def sleep(app_user_id: str, start_date: str | None, end_date: str | None) -> Any:
    return _request(
        "GET",
        f"/users/{ow_user_id(app_user_id)}/events/sleep",
        params=_date_range(start_date, end_date),
    )


def timeseries(
    app_user_id: str, start_time: str | None, end_time: str | None, types: list[str]
) -> Any:
    params: list[tuple[str, str]] = [("types", t) for t in types]
    if start_time:
        params.append(("start_time", start_time))
    if end_time:
        params.append(("end_time", end_time))
    return _request("GET", f"/users/{ow_user_id(app_user_id)}/timeseries", params=params)


def is_configured() -> bool:
    return bool(settings.open_wearables_api_key)


def active_connection(app_user_id: str, provider: str) -> dict[str, Any] | None:
    """The user's active connection to `provider`, or None."""
    for conn in connections(app_user_id) or []:
        if conn.get("provider") == provider and conn.get("status") == "active":
            return conn
    return None


def disconnect(app_user_id: str, provider: str) -> None:
    _request("DELETE", f"/users/{ow_user_id(app_user_id)}/connections/{provider}")


def _page(path: str, params: dict[str, Any]) -> list[dict[str, Any]]:
    return (_request("GET", path, params={**params, "limit": 100}) or {}).get("data", [])


def activity_summaries(app_user_id: str, start_date: str, end_date: str) -> list[dict[str, Any]]:
    return _page(
        f"/users/{ow_user_id(app_user_id)}/summaries/activity",
        {"start_date": start_date, "end_date": end_date},
    )


def sleep_summaries(app_user_id: str, start_date: str, end_date: str) -> list[dict[str, Any]]:
    return _page(
        f"/users/{ow_user_id(app_user_id)}/summaries/sleep",
        {"start_date": start_date, "end_date": end_date},
    )


def workout_events(app_user_id: str, start_date: str, end_date: str) -> list[dict[str, Any]]:
    return _page(
        f"/users/{ow_user_id(app_user_id)}/events/workouts",
        {"start_date": start_date, "end_date": end_date},
    )


def resting_hr_samples(app_user_id: str, start_date: str, end_date: str) -> list[dict[str, Any]]:
    return _page(
        f"/users/{ow_user_id(app_user_id)}/timeseries",
        {"types": "resting_heart_rate", "start_time": start_date, "end_time": end_date},
    )


def garmin_backfill(app_user_id: str) -> Any:
    return _request(
        "POST", f"/providers/garmin/users/{ow_user_id(app_user_id)}/sync/historical"
    )


def sync(app_user_id: str, provider: str) -> Any:
    return _request("POST", f"/providers/{provider}/users/{ow_user_id(app_user_id)}/sync")
