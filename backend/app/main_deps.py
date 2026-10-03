from fastapi import Header, HTTPException

from . import garmin_service as garmin


def current_user(x_user_id: str = Header(default="demo")) -> str:
    """Placeholder identity. Replace with real auth (JWT/session) before launch."""
    try:
        garmin._user_dir(x_user_id)
    except garmin.InvalidUserId as e:
        raise HTTPException(400, str(e))
    return x_user_id
