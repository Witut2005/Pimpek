import httpx
import pytest
from fastapi.testclient import TestClient

from app import daily
from app import garmin_service as garmin
from app import open_wearables as ow
from app.config import settings
from app.main import app

client = TestClient(app)
TODAY = "2026-10-03"


class FakeGarmin:
    def __init__(self):
        self.summary_calls: list[str] = []

    def get_user_summary(self, day):
        self.summary_calls.append(day)
        return {"totalSteps": 9000, "restingHeartRate": 55}

    def get_sleep_data(self, day):
        return {"dailySleepDTO": {"sleepTimeSeconds": 27000, "sleepScores": {"overall": {"value": 81}}}}

    def get_activities_by_date(self, start, end):
        return [
            {"activityType": {"typeKey": "running"}, "startTimeLocal": f"{TODAY} 07:00:00", "distance": 5200},
            {"activityType": {"typeKey": "cycling"}, "startTimeLocal": f"{TODAY} 18:00:00", "distance": 20000},
        ]


def ow_connected(request: httpx.Request) -> httpx.Response:
    path = request.url.path
    if path == "/api/v1/users":
        return httpx.Response(201, json={"id": "ow-1"})
    if path.endswith("/connections"):
        return httpx.Response(200, json=[{"provider": "garmin", "status": "active", "created_at": "2026-10-01T10:00:00"}])
    if path.endswith("/summaries/activity"):
        return httpx.Response(200, json={"data": [{"date": TODAY, "steps": 4321}]})
    if path.endswith("/summaries/sleep"):
        return httpx.Response(200, json={"data": [{"date": TODAY, "duration_minutes": 450}]})
    if path.endswith("/timeseries"):
        return httpx.Response(200, json={"data": [{"timestamp": f"{TODAY}T06:00:00Z", "value": 52.4}]})
    if path.endswith("/events/workouts"):
        return httpx.Response(200, json={"data": [{"type": "running", "start_time": f"{TODAY}T07:00:00Z", "distance_meters": 3000}]})
    return httpx.Response(500)


def ow_not_connected(request: httpx.Request) -> httpx.Response:
    if request.url.path == "/api/v1/users":
        return httpx.Response(201, json={"id": "ow-1"})
    return httpx.Response(200, json=[])


@pytest.fixture(autouse=True)
def setup(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "user_map_file", tmp_path / "map.json")
    monkeypatch.setattr(settings, "cache_dir", tmp_path / "cache")
    monkeypatch.setattr(settings, "open_wearables_api_key", "key")
    monkeypatch.setattr(ow, "_transport", httpx.MockTransport(ow_not_connected))


@pytest.fixture
def fake_garmin(monkeypatch):
    fake = FakeGarmin()
    monkeypatch.setattr(garmin, "status", lambda user: {"connected": True, "connected_at": 1_700_000_000})
    monkeypatch.setattr(garmin, "client", lambda user: fake)
    return fake


def test_days_without_any_source_is_409():
    r = client.get("/api/days")
    assert r.status_code == 409
    assert client.get("/api/sources").json() == []


def test_days_from_garmin_connect(fake_garmin):
    r = client.get("/api/days", params={"count": 3, "today": TODAY})
    assert r.status_code == 200
    body = r.json()
    assert body["via"] == "garmin_connect"
    assert [d["date"] for d in body["days"]] == [TODAY, "2026-10-02", "2026-10-01"]
    today = body["days"][0]
    assert today == {
        "date": TODAY,
        "source": "garmin",
        "sleepHours": 7.5,
        "sleepScore": 81,
        "steps": 9000,
        "restingHr": 55,
        "runningKm": 5.2,
        "complete": False,
    }
    assert body["days"][1]["runningKm"] is None
    assert body["days"][1]["complete"] is True


def test_settled_days_are_cached(fake_garmin):
    client.get("/api/days", params={"count": 5, "today": TODAY})
    fake_garmin.summary_calls.clear()
    client.get("/api/days", params={"count": 5, "today": TODAY})
    # Today and yesterday may still change; older days come from the cache.
    assert sorted(fake_garmin.summary_calls) == ["2026-10-02", TODAY]


def test_open_wearables_wins_over_garmin_connect(fake_garmin, monkeypatch):
    monkeypatch.setattr(ow, "_transport", httpx.MockTransport(ow_connected))
    assert client.get("/api/sources").json()[0]["via"] == "open_wearables"
    body = client.get("/api/days", params={"count": 2, "today": TODAY}).json()
    assert body["via"] == "open_wearables"
    assert body["days"][0] == {
        "date": TODAY,
        "source": "garmin",
        "sleepHours": 7.5,
        "sleepScore": None,
        "steps": 4321,
        "restingHr": 52,
        "runningKm": 3.0,
        "complete": False,
    }
    assert fake_garmin.summary_calls == []


def test_open_wearables_down_falls_back_to_garmin(fake_garmin, monkeypatch):
    def down(request):
        raise httpx.ConnectError("refused")

    monkeypatch.setattr(ow, "_transport", httpx.MockTransport(down))
    assert client.get("/api/days", params={"count": 1, "today": TODAY}).json()["via"] == "garmin_connect"


def test_rejects_bad_today():
    assert client.get("/api/days", params={"today": "03-10-2026"}).status_code == 422
