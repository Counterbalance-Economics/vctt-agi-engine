
#!/bin/bash

echo "=================================="
echo "Phase 2 Integration Tests"
echo "=================================="
echo ""

BASE_URL="http://localhost:8000"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Test counter
PASSED=0
FAILED=0

test_endpoint() {
    local name=$1
    local method=$2
    local endpoint=$3
    local data=$4
    
    echo -n "Testing: $name... "
    
    if [ "$method" == "POST" ]; then
        response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL$endpoint" \
            -H "Content-Type: application/json" \
            -d "$data")
    else
        response=$(curl -s -w "\n%{http_code}" "$BASE_URL$endpoint")
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" == "200" ] || [ "$http_code" == "201" ]; then
        echo -e "${GREEN}✓ PASSED${NC} (HTTP $http_code)"
        PASSED=$((PASSED + 1))
        return 0
    else
        echo -e "${RED}✗ FAILED${NC} (HTTP $http_code)"
        FAILED=$((FAILED + 1))
        return 1
    fi
}

echo "=== Health Check ==="
test_endpoint "Health endpoint" "GET" "/health"
echo ""

echo "=== Session Persistence ==="
# Create a test session
SESSION_RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/session/start" \
    -H "Content-Type: application/json" \
    -d '{"user_id":"test_phase2","input":"Testing Phase 2"}')

SESSION_ID=$(echo "$SESSION_RESPONSE" | jq -r '.session_id')

if [ ! -z "$SESSION_ID" ] && [ "$SESSION_ID" != "null" ]; then
    echo -e "${GREEN}✓ Session created: $SESSION_ID${NC}"
    PASSED=$((PASSED + 1))
    
    # Test session step
    test_endpoint "Session step" "POST" "/api/v1/session/step" "{\"session_id\":\"$SESSION_ID\",\"input\":\"Follow-up message\"}"
    
    # Test session retrieval
    test_endpoint "Get session" "GET" "/api/v1/session/$SESSION_ID"
else
    echo -e "${RED}✗ Failed to create session${NC}"
    FAILED=$((FAILED + 1))
fi
echo ""

echo "=== Analytics Endpoints ==="
test_endpoint "List sessions" "GET" "/analytics/sessions"
test_endpoint "Trust metrics" "GET" "/analytics/trust-metrics"
test_endpoint "Aggregate analytics" "GET" "/analytics/aggregate"
test_endpoint "Cross-session patterns" "GET" "/analytics/cross-session-patterns"

if [ ! -z "$SESSION_ID" ] && [ "$SESSION_ID" != "null" ]; then
    test_endpoint "Session history" "GET" "/analytics/sessions/$SESSION_ID/history"
fi
echo ""

echo "=================================="
echo "Test Results"
echo "=================================="
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo "Total: $((PASSED + FAILED))"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}✗ Some tests failed${NC}"
    exit 1
fi
