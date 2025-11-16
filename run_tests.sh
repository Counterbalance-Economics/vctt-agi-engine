
#!/bin/bash

# Run tests for VCTT-AGI Engine

echo "Running VCTT-AGI Engine Tests..."
echo "================================"

# Set testing environment
export ENVIRONMENT=testing
export DATABASE_URL=sqlite:///:memory:
export OPENAI_API_KEY=sk-test-mock-key
export DEBUG=False

# Run pytest
pytest tests/ -v --tb=short --color=yes

echo ""
echo "================================"
echo "Tests completed!"
