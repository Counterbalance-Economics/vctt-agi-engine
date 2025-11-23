
#!/bin/bash

# Demo script for VCTT-AGI Engine API

echo "================================================"
echo "VCTT-AGI Engine API Demo"
echo "================================================"
echo ""

BASE_URL="http://localhost:8000"

echo "1. Testing Root Endpoint..."
echo "   GET /"
curl -s "$BASE_URL/" | python3 -m json.tool
echo ""
echo "---"
echo ""

echo "2. Testing Health Check..."
echo "   GET /health"
curl -s "$BASE_URL/health" | python3 -m json.tool
echo ""
echo "---"
echo ""

echo "3. Testing System Metrics..."
echo "   GET /metrics"
curl -s "$BASE_URL/metrics" | python3 -m json.tool | head -30
echo "   ..."
echo ""
echo "---"
echo ""

echo "4. Testing Analysis Endpoint (will fail without valid OpenAI API key)..."
echo "   POST /api/v1/analyze"
curl -s -X POST "$BASE_URL/api/v1/analyze" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Renewable energy is important because it reduces carbon emissions. However, the initial costs are high and implementation is complex.",
    "user_id": "demo_user",
    "context": {"source": "demo"}
  }' | python3 -m json.tool | head -40

echo ""
echo "---"
echo ""

echo "5. List Sessions..."
echo "   GET /api/v1/sessions"
curl -s "$BASE_URL/api/v1/sessions?limit=5" | python3 -m json.tool

echo ""
echo "================================================"
echo "Demo Complete!"
echo ""
echo "Full API Documentation:"
echo "  - Swagger UI: http://localhost:8000/docs"
echo "  - ReDoc:      http://localhost:8000/redoc"
echo "================================================"
