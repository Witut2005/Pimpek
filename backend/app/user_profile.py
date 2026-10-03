"""Pimpek's read of the last two weeks: what keeps coming back and the one need to work on first.

Nothing is stored here. The check-ins live in the browser (localStorage) and the recent ones
come with every request. The instructions live in prompts/profile_summary.md. Notes are user
input: like meal names they only go into the user turn as JSON data, never into the system
instruction.
"""
import json
from pathlib import Path
from typing import Any

from .food_rating import RatingError, ask_json

PROMPT_FILE = Path(__file__).parent / "prompts" / "profile_summary.md"
# Pimpek's needs, the same keys as the frontend's StatKey.
NEEDS = ["energy", "nutrition", "fitness", "mood", "screen"]
MAX_POINTS = 3

# Observations come first on purpose: the model names what it saw, then picks the focus from it.
RESPONSE_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "observations": {"type": "ARRAY", "items": {"type": "STRING"}, "maxItems": MAX_POINTS},
        "focus": {"type": "STRING", "enum": NEEDS},
        "headline": {"type": "STRING"},
        "summary": {"type": "STRING"},
        "tips": {"type": "ARRAY", "items": {"type": "STRING"}, "maxItems": MAX_POINTS},
    },
    "required": ["observations", "focus", "headline", "summary", "tips"],
    "propertyOrdering": ["observations", "focus", "headline", "summary", "tips"],
}


def prompt() -> str:
    """Read on every summary, so edits to the prompt apply without restarting the backend."""
    return PROMPT_FILE.read_text(encoding="utf-8")


def _clean(raw: dict[str, Any], fallback_focus: str | None) -> dict[str, Any]:
    """Never trust the shape blindly: a focus outside the needs falls back to the rules' pick."""

    def points(key: str) -> list[str]:
        return [str(p).strip() for p in raw.get(key) or [] if str(p).strip()][:MAX_POINTS]

    summary = str(raw["summary"]).strip()
    if not summary:
        raise ValueError("empty summary")
    focus = raw.get("focus")
    return {
        "focus": focus if focus in NEEDS else fallback_focus,
        "headline": str(raw.get("headline") or "").strip(),
        "summary": summary,
        "observations": points("observations"),
        "tips": points("tips"),
    }


def summarize(profile: dict[str, Any]) -> dict[str, Any]:
    """`profile` is `{today, goals, patterns: [{need, label, streak, badDays, days}], days: [...]}`.

    `patterns` are what the frontend's rules already found; the model can agree or not.
    """
    user_text = "Podsumuj ostatnie dni:\n" + json.dumps(profile, ensure_ascii=False)
    raw, model = ask_json(prompt(), user_text, RESPONSE_SCHEMA, "AI profile summary")
    patterns = profile.get("patterns") or []
    try:
        return {**_clean(raw, patterns[0]["need"] if patterns else None), "model": model}
    except (ValueError, KeyError, TypeError, AttributeError) as e:
        raise RatingError(502, f"unreadable answer: {e}") from e
