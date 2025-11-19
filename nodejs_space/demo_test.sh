#!/bin/bash

echo "🧠 VCTT-AGI Coherence Kernel - Demo Test Script"
echo "================================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Health Check
echo -e "${BLUE}Test 1: Health Check${NC}"
curl -s http://localhost:8000/health | jq '.'
echo ""

# Test 2: Start a new session
echo -e "${BLUE}Test 2: Starting New Session${NC}"
SESSION_RESPONSE=$(curl -s -X POST http://localhost:8000/api/v1/session/start \
  -H "Content-Type: application/json" \
  -d '{"user_id":"demo_user","input":"Explain the concept of emergence in complex systems"}')

SESSION_ID=$(echo $SESSION_RESPONSE | jq -r '.session_id')
echo "Session ID: $SESSION_ID"
echo ""

# Test 3: Process a conversation step
echo -e "${BLUE}Test 3: Processing Conversation Step${NC}"
STEP_RESPONSE=$(curl -s -X POST http://localhost:8000/api/v1/session/step \
  -H "Content-Type: application/json" \
  -d "{\"session_id\":\"$SESSION_ID\",\"input\":\"How does this relate to consciousness?\"}")

echo "$STEP_RESPONSE" | jq '.'
echo ""

# Extract metrics
TRUST=$(echo "$STEP_RESPONSE" | jq -r '.internal_state.trust_tau')
TENSION=$(echo "$STEP_RESPONSE" | jq -r '.internal_state.sim.tension')
UNCERTAINTY=$(echo "$STEP_RESPONSE" | jq -r '.internal_state.sim.uncertainty')
CONTRADICTION=$(echo "$STEP_RESPONSE" | jq -r '.internal_state.contradiction')
REGULATION=$(echo "$STEP_RESPONSE" | jq -r '.internal_state.regulation')
REPAIRS=$(echo "$STEP_RESPONSE" | jq -r '.internal_state.repair_count')

echo -e "${YELLOW}=== System Metrics ===${NC}"
echo "Trust (τ):         $TRUST"
echo "Tension:           $TENSION"
echo "Uncertainty:       $UNCERTAINTY"
echo "Contradiction:     $CONTRADICTION"
echo "Regulation Mode:   $REGULATION"
echo "Repair Count:      $REPAIRS"
echo ""

# Test 4: Get full session details
echo -e "${BLUE}Test 4: Retrieving Full Session${NC}"
curl -s http://localhost:8000/api/v1/session/$SESSION_ID | jq '.'
echo ""

# Test 5: Create another session to test repair loop
echo -e "${BLUE}Test 5: Testing Contradiction Detection${NC}"
SESSION2_RESPONSE=$(curl -s -X POST http://localhost:8000/api/v1/session/start \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test_user_2","input":"The sky is blue"}')

SESSION2_ID=$(echo $SESSION2_RESPONSE | jq -r '.session_id')

# Send contradictory message
STEP2_RESPONSE=$(curl -s -X POST http://localhost:8000/api/v1/session/step \
  -H "Content-Type: application/json" \
  -d "{\"session_id\":\"$SESSION2_ID\",\"input\":\"No wait, the sky is not blue\"}")

echo "$STEP2_RESPONSE" | jq '.internal_state'
echo ""

echo -e "${GREEN}✅ Demo Complete!${NC}"
echo ""
echo "Access Swagger UI: http://localhost:8000/api"
echo "View logs: tail -f /tmp/vctt_agi.log"
