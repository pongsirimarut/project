import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

@pytest.mark.asyncio
async def test_forecast_endpoint():
    response = client.post("/forecast", json={
        "solar_intensity": 800,
        "temperature": 30,
        "cloud_cover": 20
    })
    assert response.status_code == 200
    assert "energy_output" in response.json()
    assert isinstance(response.json()["energy_output"], float)

@pytest.mark.asyncio
async def test_detect_anomaly_endpoint():
    response = client.post("/detect-anomaly", json={
        "energy_output": 5.0,
        "solar_intensity": 800
    })
    assert response.status_code == 200
    assert "status" in response.json()
    assert "recommendation" in response.json()

@pytest.mark.asyncio
async def test_panel_recommendation_endpoint():
    response = client.get("/panel-recommendation?energy_demand=20&solar_intensity=800")
    assert response.status_code == 200
    assert "num_panels" in response.json()
    assert isinstance(response.json()["num_panels"], int)

@pytest.mark.asyncio
async def test_weather_endpoint():
    response = client.get("/weather?city=Bangkok")
    assert response.status_code == 200
    assert "solar_intensity" in response.json() or "error" in response.json()