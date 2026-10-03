import base64
import json
import time

import httpx
import pytest
from fastapi.testclient import TestClient

from app import fitatu_service as fitatu
from app.config import settings
from app.main import app

client = TestClient(app)
DAY = "2026-10-03"


def jwt(expires_in: int, **claims) -> str:
    def part(data):
        return base64.urlsafe_b64encode(json.dumps(data).encode()).rstrip(b"=").decode()

    return f"{part({'alg': 'none'})}.{part({'id': 777, 'exp': int(time.time()) + expires_in, **claims})}.sig"


DAY_PLAN = {
    "dietPlan": {
        "breakfast": {
            "mealName": "Śniadanie",
            "mealTime": "08:00",
            "items": [
                {"planDayDietItemId": "a1b2", "name": "Owsianka", "measureQuantity": "1.5",
                 "measureName": "porcja", "energy": "350.4",
                 "protein": 12, "fat": 8, "carbohydrate": 55, "fiber": 7, "sugars": 9, "eaten": True},
                {"name": "Kawa", "weight": 250, "energy": 5, "deletedAt": "2026-10-03 08:10:00"},
            ],
        },
        "second_breakfast": {"mealName": None, "items": []},
        "supper": {
            "items": [
                {"name": "Kanapka", "brand": "Domowa", "weight": 180, "energy": 420, "protein": 20, "fat": 15,
                 "carbohydrate": 45},
                {"name": "Jogurt", "energy": 150, "protein": 10, "eaten": False},
            ],
        },
    }
}


class FakeFitatu:
    """Fitatu's login, rotating refresh tokens and planner day, in memory."""

    def __init__(self):
        self.access = jwt(3600)
        self.refresh = "refresh-1"
        self.requests: list[httpx.Request] = []

    def calls(self, path: str) -> int:
        return sum(1 for r in self.requests if r.url.path == path)

    def __call__(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        path = request.url.path
        if request.headers.get("API-Secret") != settings.fitatu_api_secret:
            return httpx.Response(403)
        if path == "/api/login":
            if json.loads(request.content) != {"_username": "ola@example.com", "_password": "tajne"}:
                return httpx.Response(401, json={"code": 401, "message": "Invalid credentials."})
            return httpx.Response(200, json={"token": self.access, "refresh_token": self.refresh})
        if path == "/api/token/refresh":
            if json.loads(request.content).get("refresh_token") != self.refresh:
                return httpx.Response(401, json={"code": 401, "message": "Invalid JWT Refresh Token"})
            self.refresh += "+"
            self.access = jwt(3600, n=len(self.refresh))
            return httpx.Response(200, json={"token": self.access, "refresh_token": self.refresh})
        if request.headers.get("Authorization") != f"Bearer {self.access}":
            return httpx.Response(401, json={"code": 401, "message": "Expired JWT Token"})
        if path == f"/api/diet-and-activity-plan/777/day/{DAY}":
            return httpx.Response(200, json=DAY_PLAN)
        return httpx.Response(404)


@pytest.fixture(autouse=True)
def setup(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "fitatu_token_dir", tmp_path / "fitatu")
    monkeypatch.setattr(settings, "token_dir", tmp_path / "tokens")
    monkeypatch.setattr(settings, "open_wearables_api_key", "")


@pytest.fixture
def fake(monkeypatch):
    fake = FakeFitatu()
    monkeypatch.setattr(fitatu, "_transport", httpx.MockTransport(fake))
    return fake


def connect(password="tajne"):
    return client.post("/api/fitatu/connect", json={"email": "ola@example.com", "password": password})


def token_file():
    (path,) = settings.fitatu_token_dir.iterdir()
    return path


def stored() -> dict:
    return json.loads(token_file().read_text())


def test_connect_keeps_tokens_not_password(fake):
    r = connect()
    assert r.status_code == 200
    assert r.json() == {"status": "connected"}
    session = stored()
    assert session["fitatu_user_id"] == "777"
    assert "tajne" not in json.dumps(session)
    assert [s["id"] for s in client.get("/api/sources").json()] == ["fitatu"]


def test_wrong_password_is_401(fake):
    assert connect(password="zle").status_code == 401
    assert client.get("/api/sources").json() == []


def test_meals_are_normalised(fake):
    connect()
    r = client.get("/api/meals", params={"date": DAY})
    assert r.status_code == 200
    body = r.json()
    assert body["date"] == DAY and body["source"] == "fitatu"
    breakfast, supper = body["meals"]  # the empty second breakfast is dropped
    assert breakfast["name"] == "Śniadanie" and breakfast["time"] == "08:00"
    assert [i["name"] for i in breakfast["items"]] == ["Owsianka"]  # deleted coffee is gone
    assert breakfast["items"][0]["amount"] == "1.5 porcja"
    assert breakfast["items"][0]["id"] == "a1b2"
    assert breakfast["kcal"] == 350
    assert supper["name"] == "Kolacja"
    assert supper["items"][0]["amount"] == "180 g"
    assert supper["kcal"] == 570  # the yoghurt counts although Fitatu says eaten: false
    assert body["totals"] == {"kcal": 920, "protein": 42.0, "fat": 23.0, "carbs": 100.0, "fiber": 7.0, "sugars": 9.0}


def test_expired_token_is_refreshed_and_rotation_saved(fake):
    connect()
    token_file().write_text(json.dumps({**stored(), "token": jwt(-10)}))
    assert client.get("/api/meals", params={"date": DAY}).status_code == 200
    assert fake.calls("/api/token/refresh") == 1
    assert stored()["refresh_token"] == "refresh-1+"


def test_rejected_token_is_refreshed_once_and_retried(fake):
    connect()
    fake.access = jwt(3600, n=99)  # Fitatu revoked the token we hold
    assert client.get("/api/meals", params={"date": DAY}).status_code == 200
    assert fake.calls("/api/token/refresh") == 1


def test_dead_refresh_token_disconnects(fake):
    connect()
    fake.access, fake.refresh = "revoked", "revoked"
    assert client.get("/api/meals", params={"date": DAY}).status_code == 409
    assert client.get("/api/sources").json() == []


def test_meals_without_connection_is_409(fake):
    assert client.get("/api/meals", params={"date": DAY}).status_code == 409


def test_disconnect(fake):
    connect()
    assert client.delete("/api/sources/fitatu").status_code == 200
    assert client.get("/api/sources").json() == []


def test_unreachable_is_502(monkeypatch):
    def down(request):
        raise httpx.ConnectError("down")

    monkeypatch.setattr(fitatu, "_transport", httpx.MockTransport(down))
    assert connect().status_code == 502


def test_upstream_error_is_502_and_logged(monkeypatch, caplog):
    rejected = httpx.Response(403, json={"message": "Invalid API secret"})
    monkeypatch.setattr(fitatu, "_transport", httpx.MockTransport(lambda request: rejected))
    r = connect()
    assert r.status_code == 502
    assert "Invalid API secret" in r.json()["detail"]
    assert "Invalid API secret" in caplog.text
    assert "tajne" not in caplog.text


def test_rejects_bad_date(fake):
    assert client.get("/api/meals", params={"date": "03.10.2026"}).status_code == 422
