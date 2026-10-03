"""Rates one day of eating with Gemini, for Pimpek's nutrition need.

The instructions live in prompts/food_rating.md, so they can be tuned without touching
code. Meal names are user input: they only ever go into the user turn as JSON data,
never into the system instruction, and the prompt says to treat them as data.
"""
import json
import logging
import time
from pathlib import Path
from typing import Any

import httpx

from .config import settings

PROMPT_FILE = Path(__file__).parent / "prompts" / "food_rating.md"
MAX_POINTS = 3
# Gemini answers 503 ("high demand") when a model is overloaded, and now and then 500.
# Both usually pass within seconds: retry once, then try the fallback model.
RETRY_STATUSES = {500, 503}
RETRY_DELAY_SECONDS = 1.0

log = logging.getLogger("uvicorn.error")

# Gemini's structured output. Positives and improvements come before the score on purpose:
# the model writes its reasons first, and the score follows from them.
RESPONSE_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "positives": {"type": "ARRAY", "items": {"type": "STRING"}, "maxItems": MAX_POINTS},
        "improvements": {"type": "ARRAY", "items": {"type": "STRING"}, "maxItems": MAX_POINTS},
        "incomplete": {"type": "BOOLEAN"},
        "score": {"type": "INTEGER", "minimum": 0, "maximum": 100},
        "label": {"type": "STRING"},
        "summary": {"type": "STRING"},
    },
    "required": ["positives", "improvements", "incomplete", "score", "label", "summary"],
    "propertyOrdering": ["positives", "improvements", "incomplete", "score", "label", "summary"],
}

# Tests swap this for httpx.MockTransport.
_transport: httpx.BaseTransport | None = None


class NotConfigured(RuntimeError):
    pass


class RatingError(Exception):
    def __init__(self, status: int, detail: Any):
        self.status = status
        self.detail = detail
        super().__init__(f"Gemini returned {status}: {detail}")


class RatingUnavailable(Exception):
    pass


def is_configured() -> bool:
    return bool(settings.gemini_api_key)


def prompt() -> str:
    """Read on every rating, so edits to the prompt apply without restarting the backend."""
    return PROMPT_FILE.read_text(encoding="utf-8")


def _request(model: str, body: dict[str, Any]) -> httpx.Response:
    url = f"{settings.gemini_api_url.rstrip('/')}/models/{model}:generateContent"
    try:
        with httpx.Client(timeout=30, transport=_transport) as client:
            return client.post(url, json=body, headers={"x-goog-api-key": settings.gemini_api_key})
    except httpx.TransportError as e:
        raise RatingUnavailable(str(e)) from e


def _generate(body: dict[str, Any]) -> tuple[httpx.Response, str]:
    """The main model, retried once while overloaded; then the fallback model the same way."""
    models = [settings.gemini_model]
    if settings.gemini_fallback_model and settings.gemini_fallback_model != settings.gemini_model:
        models.append(settings.gemini_fallback_model)
    for model in models:
        resp = _request(model, body)
        if resp.status_code in RETRY_STATUSES:
            time.sleep(RETRY_DELAY_SECONDS)
            resp = _request(model, body)
        if resp.status_code not in RETRY_STATUSES:
            return resp, model
        next_step = "trying the fallback model" if model != models[-1] else "giving up"
        log.warning("Gemini %s is unavailable (%s), %s", model, resp.status_code, next_step)
    return resp, model


def _answer_text(data: dict[str, Any]) -> str:
    candidates = data.get("candidates") or []
    if not candidates:
        reason = (data.get("promptFeedback") or {}).get("blockReason", "no candidates")
        raise RatingError(502, f"no answer ({reason})")
    parts = (candidates[0].get("content") or {}).get("parts") or []
    return "".join(p.get("text", "") for p in parts if not p.get("thought"))


def _clean(raw: dict[str, Any]) -> dict[str, Any]:
    """Never trust the shape blindly: clamp the score and trim what the UI shows."""

    def points(key: str) -> list[str]:
        return [str(p).strip() for p in raw.get(key) or [] if str(p).strip()][:MAX_POINTS]

    return {
        "score": max(0, min(100, round(float(raw["score"])))),
        "label": str(raw.get("label") or "").strip(),
        "summary": str(raw.get("summary") or "").strip(),
        "positives": points("positives"),
        "improvements": points("improvements"),
        "incomplete": bool(raw.get("incomplete")),
    }


def rate(day: dict[str, Any]) -> dict[str, Any]:
    """`day` is `{date, meals: [{name, time?, items: [{name, amount?, source, kcal?, ...}]}]}`."""
    if not is_configured():
        raise NotConfigured("AI food rating is not configured: set GEMINI_API_KEY in backend/.env")
    body = {
        "systemInstruction": {"parts": [{"text": prompt()}]},
        "contents": [
            {
                "role": "user",
                "parts": [{"text": "Oceń jedzenie z tego dnia:\n" + json.dumps(day, ensure_ascii=False)}],
            }
        ],
        "generationConfig": {"responseMimeType": "application/json", "responseSchema": RESPONSE_SCHEMA},
    }
    resp, model = _generate(body)
    if resp.status_code >= 400:
        try:
            detail = resp.json().get("error", {}).get("message") or resp.text[:300]
        except ValueError:
            detail = resp.text[:300]
        raise RatingError(resp.status_code, detail)
    try:
        return {**_clean(json.loads(_answer_text(resp.json()))), "model": model}
    except (ValueError, KeyError, TypeError) as e:
        raise RatingError(502, f"unreadable answer: {e}") from e
