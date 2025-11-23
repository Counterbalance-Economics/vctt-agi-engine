#!/bin/bash

BACKEND_URL="https://vctt-agi-backend.onrender.com"

echo "=========================================="
echo "🧪 Testing Phase 2 Backend Features"
echo "=========================================="
echo ""

echo "1️⃣ Testing Health Endpoint (should show database: connected)..."
curl -s "${BACKEND_URL}/health" | jq '.'
echo ""

echo "2️⃣ Testing API Documentation (Phase 2 has more endpoints)..."
echo "Open in browser: ${BACKEND_URL}/api-docs"
echo ""

echo "3️⃣ Creating a test session..."
SESSION_RESPONSE=$(curl -s -X POST "${BACKEND_URL}/api/v1/session/start" \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test_phase2","input":"Test Phase 2 features"}')
echo "$SESSION_RESPONSE" | jq '.'
SESSION_ID=$(echo "$SESSION_RESPONSE" | jq -r '.session_id')
echo "Session ID: $SESSION_ID"
echo ""

echo "4️⃣ Testing Session History (NEW in Phase 2)..."
curl -s "${BACKEND_URL}/api/v1/session/${SESSION_ID}/history" | jq '.'
echo ""

echo "5️⃣ Testing Analytics - Session Stats (NEW in Phase 2)..."
curl -s "${BACKEND_URL}/api/v1/analytics/sessions/stats" | jq '.'
echo ""

echo "6️⃣ Testing Analytics - Trust Evolution (NEW in Phase 2)..."
curl -s "${BACKEND_URL}/api/v1/analytics/trust/evolution" | jq '.'
echo ""

echo "=========================================="
echo "✅ Phase 2 Features Tested!"
echo "=========================================="
