
# VCTT-AGI Engine Testing Guide

## Test Suite Overview

The VCTT-AGI Engine includes comprehensive tests for all components.

## Test Structure

```
tests/
├── conftest.py              # Pytest configuration and fixtures
├── test_agents/             # Agent tests (future)
├── test_modules/            # VCTT module tests
│   ├── test_sim.py          # Situational Interpretation Module (5 tests)
│   ├── test_cam.py          # Contradiction Analysis Module (4 tests)
│   ├── test_sre.py          # Self-Regulation Engine (4 tests)
│   └── test_ctm.py          # Contextual Trust Module (4 tests)
├── test_orchestrator/       # Orchestrator tests (future)
└── test_api/                # API endpoint tests
    └── test_health.py       # Health/metrics endpoints (3 tests)
```

## Running Tests

### All Tests
```bash
cd /home/ubuntu/vctt_agi_engine
pytest tests/ -v
```

### Module Tests Only
```bash
pytest tests/test_modules/ -v
```

### API Tests Only
```bash
pytest tests/test_api/ -v
```

### Specific Test File
```bash
pytest tests/test_modules/test_sim.py -v
```

### With Coverage
```bash
pytest tests/ -v --cov=vctt_agi --cov-report=html
```

## Current Test Results

### Module Tests (18 tests)
✅ **SIM Tests** (5/5 passing)
- test_sim_initialization
- test_sim_tension_detection
- test_sim_uncertainty_detection
- test_sim_emotional_intensity
- test_sim_neutral_text

✅ **CAM Tests** (4/4 passing)
- test_cam_initialization
- test_cam_text_contradiction_detection
- test_cam_logical_contradiction
- test_cam_no_contradictions

✅ **SRE Tests** (5/5 passing)
- test_sre_initialization
- test_sre_normal_mode
- test_sre_clarify_mode
- test_sre_slow_down_mode
- test_sre_mode_history

✅ **CTM Tests** (4/4 passing)
- test_ctm_initialization
- test_ctm_calculate_trust
- test_ctm_trust_with_contradictions
- test_ctm_trust_evolution

### API Tests (3 tests)
✅ **Health Tests** (3/3 passing)
- test_health_check
- test_metrics_endpoint
- test_root_endpoint

## Test Coverage

Current test coverage focuses on:
1. **Module Logic**: All VCTT modules thoroughly tested
2. **API Endpoints**: Health and metrics endpoints verified
3. **Database Models**: Models tested via fixtures

## Manual Testing

### Test the API with curl

1. **Health Check**
```bash
curl http://localhost:8000/health
```

2. **System Metrics**
```bash
curl http://localhost:8000/metrics
```

3. **Analyze Text** (requires valid OpenAI API key)
```bash
curl -X POST http://localhost:8000/api/v1/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Your text here...",
    "user_id": "test_user"
  }'
```

### Test via Swagger UI
1. Open http://localhost:8000/docs
2. Click on any endpoint
3. Click "Try it out"
4. Fill in parameters
5. Click "Execute"

## Test Fixtures

The test suite includes fixtures for:
- **test_db**: In-memory SQLite database for each test
- **mock_openai_key**: Mock API key for testing
- **setup_test_env**: Test environment variables

## Adding New Tests

### Module Test Template
```python
def test_module_feature():
    """Test description"""
    module = YourModule()
    result = module.method()
    
    assert result is not None
    assert "expected_key" in result
```

### API Test Template
```python
def test_api_endpoint():
    """Test description"""
    response = client.get("/endpoint")
    
    assert response.status_code == 200
    data = response.json()
    assert "expected_key" in data
```

## Best Practices

1. **Run tests before committing**: `pytest tests/ -v`
2. **Add tests for new features**: Maintain >80% coverage
3. **Use descriptive test names**: `test_module_specific_behavior`
4. **Test edge cases**: Invalid inputs, empty data, etc.
5. **Mock external services**: Don't call real APIs in tests

## Continuous Testing

### Quick test script
```bash
#!/bin/bash
cd /home/ubuntu/vctt_agi_engine
pytest tests/ -v --tb=short
```

### Watch mode (requires pytest-watch)
```bash
ptw tests/ -- -v
```

## Performance Testing

For performance testing (future):
```bash
# Load testing with locust
locust -f load_tests.py --host=http://localhost:8000
```

## Integration Testing

Full pipeline integration tests (future):
```python
async def test_full_pipeline():
    """Test complete analysis pipeline"""
    orchestrator = VCTTOrchestrator(api_key="test")
    result = await orchestrator.process("Test text")
    
    assert result["status"] == "success"
    assert "analyst_output" in result["data"]["analysis"]
```

## Test Maintenance

- Review and update tests when API changes
- Add tests for bug fixes
- Keep test data realistic but minimal
- Document complex test scenarios

## Summary

✅ 21 tests implemented and passing  
✅ Module-level test coverage complete  
✅ API endpoint testing functional  
✅ Test fixtures and configuration ready  
✅ Manual testing procedures documented  

The testing infrastructure is solid and ready for expansion as new features are added.
