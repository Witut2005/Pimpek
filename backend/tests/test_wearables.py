import httpx
import pytest
from fastapi.testclient import TestClient

from app import open_wearables as ow
from app.config import settings
from app.main import app

client = TestClient(app)
calls: list[httpx.Request] = []


def fake_ow(request: httpx.Request) -> httpx.Response:
    calls.append(request)
    path = request.url.path
    if path == "/api/v1/users" and request.method == "POST":
        return httpx.Response(201, json={"id": "ow-123"})
    if path == "/api/v1/oauth/garmin/authorize":
        return httpx.Response(200, json={"authorization_url": "https://connect.garmin.com/x", "state": "s"})
    if path.endswith("/events/workouts"):
        return httpx.Response(200, json={"data": [{"id": "w1"}]})
    if path.endswith("/connections"):
        return httpx.Response(404, json={"detail": "nope"})
    return httpx.Response(500, text="boom")


@pytest.fixture(autouse=True)
def setup(tmp_path, monkeypatch):
    calls.clear()
    monkeypatch.setattr(settings, "user_map_file", tmp_path / "map.json")
    monkeypatch.setattr(settings, "open_wearables_api_key", "secret-key")
    monkeypatch.setattr(ow, "_transport", httpx.MockTransport(fake_ow))


def test_connect_creates_user_once_and_returns_url():
    body = {"redirect_uri": "http://localhost:4200/onboarding/done"}
    r = client.post("/api/wearables/connect/garmin", json=body, headers={"X-User-Id": "alice"})
    assert r.status_code == 200
    assert r.json()["authorization_url"].startswith("https://connect.garmin.com")
    client.post("/api/wearables/connect/garmin", json=body, headers={"X-User-Id": "alice"})
    assert sum(1 for c in calls if c.method == "POST" and c.url.path == "/api/v1/users") == 1
    auth = [c for c in calls if c.url.path.endswith("/authorize")][0]
    assert auth.url.params["user_id"] == "ow-123"
    assert auth.headers["X-Open-Wearables-API-Key"] == "secret-key"


def test_redirect_to_foreign_origin_rejected():
    r = client.post("/api/wearables/connect/garmin", json={"redirect_uri": "https://evil.example/x"})
    assert r.status_code == 400
    assert not calls


def test_workouts_proxy_and_date_params():
    r = client.get("/api/wearables/workouts?start_date=2026-09-01&end_date=2026-09-30")
    assert r.json() == {"data": [{"id": "w1"}]}
    wk = [c for c in calls if c.url.path.endswith("/workouts")][0]
    assert wk.url.params["start_date"] == "2026-09-01"


def test_upstream_errors_mapped():
    assert client.get("/api/wearables/connections").status_code == 404
    assert client.get("/api/wearables/sleep").status_code == 502


def test_unreachable_is_503(monkeypatch):
    def boom(request):
        raise httpx.ConnectError("down")
    monkeypatch.setattr(ow, "_transport", httpx.MockTransport(boom))
    assert client.get("/api/wearables/workouts").status_code == 503


def test_dates_default_to_last_30_days():
    client.get("/api/wearables/workouts")
    wk = [c for c in calls if c.url.path.endswith("/workouts")][0]
    assert "start_date" in wk.url.params and "end_date" in wk.url.params
