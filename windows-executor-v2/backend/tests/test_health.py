from backend.main import app


def test_health_endpoint():
    from fastapi.testclient import TestClient

    client = TestClient(app)
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
