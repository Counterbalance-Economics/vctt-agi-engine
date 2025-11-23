
"""Tests for health and metrics endpoints"""
import pytest
from fastapi.testclient import TestClient
from vctt_agi.api.main import app

client = TestClient(app)


def test_health_check():
    """Test health check endpoint"""
    response = client.get("/health")
    
    assert response.status_code == 200
    data = response.json()
    
    assert "status" in data
    assert "service" in data
    assert data["service"] == "VCTT-AGI Engine"


def test_metrics_endpoint():
    """Test metrics endpoint"""
    response = client.get("/metrics")
    
    assert response.status_code == 200
    data = response.json()
    
    assert "service" in data
    assert "system" in data
    assert "uptime_seconds" in data["service"]
    assert "cpu_percent" in data["system"]


def test_root_endpoint():
    """Test root endpoint"""
    response = client.get("/")
    
    assert response.status_code == 200
    data = response.json()
    
    assert data["service"] == "VCTT-AGI Engine"
    assert "version" in data
    assert "status" in data
