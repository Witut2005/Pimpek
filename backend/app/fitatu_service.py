"""Fitatu meal diary via the unofficial API of its mobile app.

Fitatu has no public API. The endpoints and client headers below are the ones its app
uses, as documented by community clients (github.com/Jezue/fitatu_library,
github.com/MaciejWiatr/fitatu-mcp), so they may change without notice.

Like Garmin, the password is used once to log in and is never stored. Only the JWT and
the refresh token are kept, per user, under settings.fitatu_token_dir. Fitatu rotates
the refresh token on every refresh, so the new pair is always written back.
"""
import base64
import json
import threading
import time
from pathlib import Path
from typing import Any, Callable

import httpx

from .config import settings

# Refresh this long before the access token expires, so a request never races the expiry.
EXPIRY_SKEW_SECONDS = 60

# One refresh at a time: two parallel refreshes would spend the same rotating refresh token.
_refresh_lock = threading.Lock()

# Tests swap this for httpx.MockTransport.
_transport: httpx.BaseTransport | None = None


class NotConnected(LookupError):
    pass


class InvalidCredentials(ValueError):
    pass


class FitatuError(Exception):
    def __init__(self, status: int, detail: Any):
        self.status = status
        self.detail = detail
        super().__init__(f"Fitatu returned {status}: {detail}")


class FitatuUnavailable(Exception):
    pass


def _http() -> httpx.Client:
    return httpx.Client(
        base_url=settings.fitatu_api_url.rstrip("/"),
        headers={
            "API-Key": settings.fitatu_api_key,
            "API-Secret": settings.fitatu_api_secret,
            "Accept": "application/json",
        },
        timeout=20,
        transport=_transport,
    )


def _request(method: str, path: str, token: str | None = None, **kwargs) -> httpx.Response:
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    try:
        with _http() as client:
            return client.request(method, path, headers=headers, **kwargs)
    except httpx.TransportError as e:
        raise FitatuUnavailable(str(e)) from e


def _raise_for(resp: httpx.Response) -> None:
    if resp.status_code >= 400:
        try:
            detail = resp.json()
        except ValueError:
            detail = resp.text[:300]
        raise FitatuError(resp.status_code, detail)


def _claims(token: str) -> dict[str, Any]:
    """The JWT payload, unverified: we only read our own user id and the expiry from it."""
    try:
        payload = token.split(".")[1]
        return json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)))
    except (IndexError, ValueError):
        return {}


def _token_path(user_id: str) -> Path:
    return settings.fitatu_token_dir / f"{user_id}.json"


def _load(user_id: str) -> dict[str, Any] | None:
    path = _token_path(user_id)
    try:
        return json.loads(path.read_text()) if path.exists() else None
    except ValueError:
        return None


def _save(user_id: str, session: dict[str, Any]) -> None:
    directory = settings.fitatu_token_dir
    directory.mkdir(parents=True, exist_ok=True)
    directory.chmod(0o700)
    _token_path(user_id).write_text(json.dumps(session))


def login(user_id: str, email: str, password: str) -> dict[str, Any]:
    resp = _request("POST", "/login", json={"_username": email, "_password": password})
    if resp.status_code in (400, 401):
        raise InvalidCredentials("Fitatu rejected the e-mail or password")
    _raise_for(resp)
    data = resp.json()
    token = data.get("token") or data.get("access_token")
    claims = _claims(token or "")
    fitatu_id = next((claims[k] for k in ("user_id", "uid", "id", "sub") if claims.get(k)), None)
    if not token or not fitatu_id:
        raise FitatuError(resp.status_code, "login response had no usable token")
    _save(
        user_id,
        {
            "token": token,
            "refresh_token": data.get("refresh_token") or data.get("refreshToken"),
            "fitatu_user_id": str(fitatu_id),
            "connected_at": int(time.time()),
        },
    )
    return {"status": "connected"}


def status(user_id: str) -> dict[str, Any]:
    session = _load(user_id)
    if session is None:
        return {"connected": False}
    return {"connected": True, "connected_at": session.get("connected_at")}


def disconnect(user_id: str) -> None:
    _token_path(user_id).unlink(missing_ok=True)


def _refresh(user_id: str, session: dict[str, Any]) -> dict[str, Any]:
    if not session.get("refresh_token"):
        disconnect(user_id)
        raise NotConnected("Fitatu session expired, log in again")
    resp = _request("POST", "/token/refresh", json={"refresh_token": session["refresh_token"]})
    if resp.status_code in (400, 401):
        # The refresh token was already used or revoked: only a new login helps.
        disconnect(user_id)
        raise NotConnected("Fitatu session expired, log in again")
    _raise_for(resp)
    data = resp.json()
    token = data.get("token") or data.get("access_token")
    if not token:
        raise FitatuError(resp.status_code, "refresh response had no token")
    session = {
        **session,
        "token": token,
        "refresh_token": data.get("refresh_token") or data.get("refreshToken") or session["refresh_token"],
    }
    _save(user_id, session)
    return session


def _session(user_id: str, rejected_token: str | None = None) -> dict[str, Any]:
    """The stored session, refreshed first if its token expired or Fitatu just rejected it."""
    with _refresh_lock:
        session = _load(user_id)
        if session is None:
            raise NotConnected("Fitatu is not connected for this user")
        expires = _claims(session["token"]).get("exp")
        # Compare tokens: if another request already refreshed, use its result instead.
        if session["token"] == rejected_token or (expires and expires - EXPIRY_SKEW_SECONDS < time.time()):
            session = _refresh(user_id, session)
        return session


def _get(user_id: str, path_for: Callable[[str], str]) -> Any:
    session = _session(user_id)
    path = path_for(session["fitatu_user_id"])
    resp = _request("GET", path, session["token"])
    if resp.status_code == 401:
        session = _session(user_id, rejected_token=session["token"])
        resp = _request("GET", path, session["token"])
    _raise_for(resp)
    return resp.json() if resp.content else None


def day_plan(user_id: str, day: str) -> dict[str, Any]:
    """Fitatu's planner day: `{"dietPlan": {meal_key: {mealName, mealTime, items}}, ...}`."""
    return _get(user_id, lambda fitatu_id: f"/diet-and-activity-plan/{fitatu_id}/day/{day}") or {}
