"""Garmin Connect access via the unofficial `garminconnect` library.

The user's password is used once to log in and is never stored. Only the
resulting session tokens are persisted, per user, under settings.token_dir.
"""
import json
import re
import secrets
import shutil
import threading
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from garminconnect import Garmin

from .config import settings

_USER_ID_RE = re.compile(r"^[A-Za-z0-9_-]{1,64}$")


class InvalidUserId(ValueError):
    pass


class MfaSessionNotFound(LookupError):
    pass


class NotConnected(LookupError):
    pass


def _user_dir(user_id: str) -> Path:
    if not _USER_ID_RE.fullmatch(user_id):
        raise InvalidUserId("user id must match [A-Za-z0-9_-]{1,64}")
    return settings.token_dir / user_id


def _meta_path(user_id: str) -> Path:
    return _user_dir(user_id) / "meta.json"


@dataclass
class _PendingMfa:
    user_id: str
    garmin: Garmin
    client_state: Any
    expires_at: float


_pending: dict[str, _PendingMfa] = {}
_pending_lock = threading.Lock()


def _purge_expired() -> None:
    now = time.time()
    for key in [k for k, v in _pending.items() if v.expires_at < now]:
        del _pending[key]


def _persist(user_id: str, garmin: Garmin) -> dict[str, Any]:
    directory = _user_dir(user_id)
    directory.mkdir(parents=True, exist_ok=True)
    directory.chmod(0o700)
    garmin.client.dump(str(directory))
    meta = {
        "display_name": getattr(garmin, "display_name", None),
        "full_name": getattr(garmin, "full_name", None),
        "connected_at": int(time.time()),
    }
    _meta_path(user_id).write_text(json.dumps(meta))
    return meta


def start_login(user_id: str, email: str, password: str) -> dict[str, Any]:
    """Log in with credentials. Returns {"status": "connected"} or MFA info."""
    _user_dir(user_id)  # validates id
    garmin = Garmin(email, password, return_on_mfa=True)
    mfa_status, client_state = garmin.login()
    if mfa_status == "needs_mfa":
        session_id = secrets.token_urlsafe(24)
        with _pending_lock:
            _purge_expired()
            _pending[session_id] = _PendingMfa(
                user_id=user_id,
                garmin=garmin,
                client_state=client_state,
                expires_at=time.time() + settings.mfa_ttl_seconds,
            )
        return {"status": "mfa_required", "mfa_session": session_id}
    meta = _persist(user_id, garmin)
    return {"status": "connected", **meta}


def finish_mfa(user_id: str, session_id: str, code: str) -> dict[str, Any]:
    with _pending_lock:
        _purge_expired()
        pending = _pending.get(session_id)
        if pending is None or pending.user_id != user_id:
            raise MfaSessionNotFound("MFA session expired or unknown")
    pending.garmin.resume_login(pending.client_state, code.strip())
    with _pending_lock:
        _pending.pop(session_id, None)
    meta = _persist(user_id, pending.garmin)
    return {"status": "connected", **meta}


def status(user_id: str) -> dict[str, Any]:
    meta_file = _meta_path(user_id)
    if not meta_file.exists():
        return {"connected": False}
    return {"connected": True, **json.loads(meta_file.read_text())}


def disconnect(user_id: str) -> None:
    directory = _user_dir(user_id)
    if directory.exists():
        shutil.rmtree(directory)


def _client(user_id: str) -> Garmin:
    directory = _user_dir(user_id)
    if not _meta_path(user_id).exists():
        raise NotConnected("Garmin is not connected for this user")
    garmin = Garmin()
    garmin.login(str(directory))
    # login() may refresh the access token; keep the store current
    garmin.client.dump(str(directory))
    return garmin


def client(user_id: str) -> Garmin:
    """A logged-in client, for callers that make several requests in a row."""
    return _client(user_id)


def list_activities(user_id: str, start: int, limit: int) -> Any:
    return _client(user_id).get_activities(start, limit)


def get_activity(user_id: str, activity_id: str) -> Any:
    return _client(user_id).get_activity(activity_id)
