
"""Pytest configuration and fixtures"""
import pytest
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from vctt_agi.core.database import Base
from vctt_agi.core.models import Session, AnalysisResult, ModuleMetric, AgentLog


# Use in-memory SQLite for tests
TEST_DATABASE_URL = "sqlite:///:memory:"


@pytest.fixture(scope="function")
def test_db():
    """Create a test database for each test"""
    engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    # Create tables
    Base.metadata.create_all(bind=engine)
    
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="session")
def mock_openai_key():
    """Mock OpenAI API key for tests"""
    return "sk-test-mock-key-for-testing-purposes"


@pytest.fixture(scope="session", autouse=True)
def setup_test_env():
    """Setup test environment variables"""
    os.environ["OPENAI_API_KEY"] = "sk-test-mock-key"
    os.environ["DATABASE_URL"] = TEST_DATABASE_URL
    os.environ["ENVIRONMENT"] = "testing"
