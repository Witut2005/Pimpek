from fastapi.testclient import TestClient

from app.main import app


def test_health():
    assert TestClient(app).get("/api/health").json() == {"ok": True}


def test_integration_endpoints_are_gone():
    client = TestClient(app)
    for path in ("/api/sources", "/api/days", "/api/meals", "/api/garmin/status"):
        assert client.get(path).status_code == 404
