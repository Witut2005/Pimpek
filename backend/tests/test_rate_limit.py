from fastapi.testclient import TestClient

from app.config import settings
from app.main import app
from app.rate_limit import RateLimiter

client = TestClient(app)

CHECK = {"name": "jabłko"}


def test_limiter_frees_a_slot_when_the_window_passes(monkeypatch):
    now = [1000.0]
    monkeypatch.setattr("app.rate_limit.time.monotonic", lambda: now[0])
    limiter = RateLimiter(window_seconds=60)
    assert limiter.hit("k", 2) is None
    assert limiter.hit("k", 2) is None
    assert limiter.hit("k", 2) == 60
    assert limiter.hit("other", 2) is None
    now[0] += 60
    assert limiter.hit("k", 2) is None


def test_ai_endpoint_answers_429_per_user(monkeypatch):
    # No Gemini key: under the limit the endpoint answers 503 without calling Gemini.
    monkeypatch.setattr(settings, "gemini_api_key", "")
    monkeypatch.setattr(settings, "ai_rate_limit_per_user", 2)
    headers = {"X-User-Id": "user-a"}
    assert client.post("/api/food/check", json=CHECK, headers=headers).status_code == 503
    assert client.post("/api/food/check", json=CHECK, headers=headers).status_code == 503
    r = client.post("/api/food/check", json=CHECK, headers=headers)
    assert r.status_code == 429
    assert int(r.headers["Retry-After"]) > 0
    # Another user, and the same user on another endpoint, have their own budget.
    assert client.post("/api/food/check", json=CHECK, headers={"X-User-Id": "user-b"}).status_code == 503
    assert client.post("/api/food/rating", json={"date": "2026-10-04", "meals": []}, headers=headers).status_code == 422


def test_ai_endpoint_answers_429_per_ip(monkeypatch):
    monkeypatch.setattr(settings, "gemini_api_key", "")
    monkeypatch.setattr(settings, "ai_rate_limit_per_ip", 2)
    for user in ("u1", "u2"):
        assert client.post("/api/food/check", json=CHECK, headers={"X-User-Id": user}).status_code == 503
    # New user ids don't get around the IP limit.
    assert client.post("/api/food/check", json=CHECK, headers={"X-User-Id": "u3"}).status_code == 429
