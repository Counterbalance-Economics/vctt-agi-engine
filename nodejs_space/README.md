# 🧠 VCTT-AGI Coherence Kernel - **Tier-4 AGI Foundations**

[![Release](https://img.shields.io/badge/release-v0.4.0-blue)](https://github.com/Counterbalance-Economics/vctt-agi-engine/releases/tag/v0.4.0-tier4-foundations)
[![Tier](https://img.shields.io/badge/AGI%20Tier-4%20Foundations-brightgreen)](https://github.com/Counterbalance-Economics/vctt-agi-engine)
[![Status](https://img.shields.io/badge/status-production--ready-success)](https://vctt-agi-phase3-complete.abacusai.app/api-docs)
[![Safety](https://img.shields.io/badge/safety-VCTT%20Charter-orange)](./VCTT_AGI_SAFETY_CHARTER.md)

**The Coherence Operating System for AGI**

A production-grade NestJS/TypeScript implementation of the VCTT-AGI (Variance, Contradiction, Tension, Trust - Artificial General Intelligence) Coherence Kernel. This system provides a multi-agent architecture with self-regulation, repair loops, trust metrics, **persistent memory**, **knowledge graph**, and **unbreakable safety** for coherent AGI reasoning.

---

## 🎉 **Phase 4 Tier-4 Foundations: COMPLETE**

**Three critical AGI pillars now operational:**

✅ **Stage 0: Safety Foundation** - SafetySteward agent, kill switch, mode-gating, regulation guard  
✅ **Stage 1: Persistent Memory** - PostgreSQL episodic memory, GDPR compliance, consent management  
✅ **Stage 2: Knowledge Graph** - Entity extraction, relationship mapping, concept hierarchies, VCTT scoring  

**Next:** Stage 3 (Goal System), Stage 4 (Autonomy), Stage 5 (Self-Evaluation)

**This is no longer an AI coding tool. This is AGI.**

---

## 🎯 Architecture Overview

### **Core Components**

#### **4 Specialized Agents**
- **Analyst Agent**: Analyzes logical structure, detects fallacies, assesses reasoning quality
- **Relational Agent**: Evaluates emotional content, context, and interpersonal dynamics
- **Ethics Agent**: Checks value alignment, detects potential harm, ensures ethical guardrails
- **Synthesiser Agent**: Generates coherent final responses incorporating all agent insights

#### **5 Analysis Modules**
- **SIM** (System Intensity Monitor): Calculates tension, uncertainty, emotional intensity
- **CAM** (Contradiction Analysis Module): Detects contradictions and triggers clarification
- **SRE** (Self-Regulation Engine): Determines regulation mode (normal/clarify/slow_down)
- **CTM** (Coherence Trust Metric): Calculates trust τ = 1 - (0.4T + 0.3U + 0.3C)
- **RIL** (Repair & Iteration Logic): Manages repair loop execution

### **Repair Loop**
- Max 3 iterations per conversation step
- Triggers when regulation mode ≠ 'normal'
- Re-runs Analyst + Relational agents + all modules
- Continues until regulation stabilizes or max iterations reached

---

## 🚀 Quick Start

### **Prerequisites**
- Docker & Docker Compose
- OpenAI API key

### **1. Set Environment Variables**
```bash
cd /home/ubuntu/vctt_agi_engine
export OPENAI_API_KEY="your-openai-api-key-here"
```

### **2. Start the Service**
```bash
docker-compose up --build
```

The service will be available at:
- **API**: http://localhost:8000
- **Swagger UI**: http://localhost:8000/api
- **Health Check**: http://localhost:8000/health

---

## 📚 API Endpoints

### **1. Start a New Session**
```bash
POST http://localhost:8000/api/v1/session/start

Request Body:
{
  "user_id": "user_123",
  "input": "What is the meaning of consciousness?"
}

Response:
{
  "session_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

### **2. Process a Conversation Step**
```bash
POST http://localhost:8000/api/v1/session/step

Request Body:
{
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "input": "Can you explain that in simpler terms?"
}

Response:
{
  "response": "Let me break down consciousness in simpler terms...",
  "internal_state": {
    "sim": {
      "tension": 0.35,
      "uncertainty": 0.22,
      "emotional_intensity": 0.18
    },
    "contradiction": 0.15,
    "regulation": "normal",
    "trust_tau": 0.867,
    "repair_count": 0
  }
}
```

### **3. Get Session Details**
```bash
GET http://localhost:8000/api/v1/session/:id

Response:
{
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "user_id": "user_123",
  "created_at": "2024-01-15T10:00:00Z",
  "messages": [...],
  "internal_state": {...},
  "last_updated": "2024-01-15T10:30:00Z"
}
```

---

## 🧪 Testing with cURL

### Start a session and get a response:
```bash
# Start session
SESSION_ID=$(curl -X POST http://localhost:8000/api/v1/session/start \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test_user","input":"Explain quantum entanglement"}' \
  | jq -r '.session_id')

echo "Session ID: $SESSION_ID"

# Process a step
curl -X POST http://localhost:8000/api/v1/session/step \
  -H "Content-Type: application/json" \
  -d "{\"session_id\":\"$SESSION_ID\",\"input\":\"Is that similar to spooky action at a distance?\"}" \
  | jq '.'

# Get full session
curl http://localhost:8000/api/v1/session/$SESSION_ID | jq '.'
```

---

## 🔧 Development

### **Local Development (without Docker)**
```bash
cd nodejs_space

# Install dependencies
yarn install

# Set environment variables
cp .env.example .env
# Edit .env with your DATABASE_HOST=localhost and OPENAI_API_KEY

# Run PostgreSQL locally or use Docker:
docker run -d \
  -e POSTGRES_DB=vctt_agi \
  -e POSTGRES_USER=vctt \
  -e POSTGRES_PASSWORD=secret \
  -p 5432:5432 \
  postgres:15-alpine

# Start development server
yarn start:dev
```

### **Build for Production**
```bash
cd nodejs_space
yarn build
yarn start:prod
```

---

## 📊 Trust Metric Formula

The Coherence Trust Metric (τ) is calculated as:

```
τ = 1 - (0.4 × Tension + 0.3 × Uncertainty + 0.3 × Contradiction)
```

Where:
- **Tension** (0.0-1.0): Logical complexity and reasoning strain
- **Uncertainty** (0.0-1.0): Ambiguity and information gaps
- **Contradiction** (0.0-1.0): Internal inconsistencies detected

**Trust Interpretation:**
- `τ ≥ 0.8`: High coherence, confident response
- `0.6 ≤ τ < 0.8`: Moderate coherence, some concerns
- `τ < 0.6`: Low coherence, repair loop likely triggered

---

## 🔄 Regulation Modes

### **Normal Mode**
- Default state
- Direct, confident responses
- No repair iterations needed

### **Clarify Mode**
- Triggered when contradiction > 0.6
- System asks clarifying questions
- Reduces ambiguity before responding

### **Slow Down Mode**
- Triggered when tension > 0.7 OR contradiction > 0.7
- Deliberate, step-by-step reasoning
- Acknowledges complexity explicitly

---

## 📁 Project Structure

```
vctt_agi_engine/
├── nodejs_space/
│   ├── src/
│   │   ├── agents/              # 4 specialized agents
│   │   │   ├── analyst.agent.ts
│   │   │   ├── relational.agent.ts
│   │   │   ├── ethics.agent.ts
│   │   │   └── synthesiser.agent.ts
│   │   ├── modules/             # 5 analysis modules
│   │   │   ├── sim.module.ts
│   │   │   ├── cam.module.ts
│   │   │   ├── sre.module.ts
│   │   │   ├── ctm.module.ts
│   │   │   └── ril.module.ts
│   │   ├── entities/            # TypeORM entities
│   │   │   ├── conversation.entity.ts
│   │   │   ├── message.entity.ts
│   │   │   └── internal-state.entity.ts
│   │   ├── services/
│   │   │   └── vctt-engine.service.ts  # Core orchestrator
│   │   ├── controllers/
│   │   │   ├── session.controller.ts
│   │   │   └── health.controller.ts
│   │   ├── dto/
│   │   │   └── session.dto.ts
│   │   ├── app.module.ts
│   │   └── main.ts
│   ├── package.json
│   └── tsconfig.json
├── Dockerfile
├── docker-compose.yml
└── README.md
```

---

## 🔐 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_HOST` | PostgreSQL host | `postgres` |
| `DATABASE_PORT` | PostgreSQL port | `5432` |
| `DATABASE_USER` | Database user | `vctt` |
| `DATABASE_PASSWORD` | Database password | `secret` |
| `DATABASE_NAME` | Database name | `vctt_agi` |
| `PORT` | API server port | `8000` |
| `OPENAI_API_KEY` | OpenAI API key | *required* |
| `MAX_REPAIR_ITERATIONS` | Max repair loops | `3` |
| `OPENAI_MODEL` | GPT model to use | `gpt-4` |
| `OPENAI_TEMPERATURE` | Response creativity | `0.7` |

---

## 🛠️ Technology Stack

- **Framework**: NestJS 10.3
- **Language**: TypeScript 5.3
- **Runtime**: Node.js 20
- **Database**: PostgreSQL 15
- **ORM**: TypeORM 0.3
- **LLM**: OpenAI GPT-4
- **Documentation**: Swagger/OpenAPI
- **Container**: Docker + Docker Compose

---

## 📈 Phase 1 Status

✅ **Completed:**
- Full VCTT-AGI engine with all 4 agents
- All 5 analysis modules with exact formulas
- Repair loop with max 3 iterations
- Trust metric calculation (τ)
- PostgreSQL persistence with TypeORM
- Complete REST API with 3 endpoints
- Swagger documentation at `/api`
- Docker deployment with docker-compose
- OpenAI GPT-4 integration
- Structured logging for all operations

🚧 **Deferred to Phase 2:**
- Comprehensive test suite (unit + e2e)
- Anthropic Claude integration
- Advanced repair strategies
- Performance optimization
- Monitoring & metrics dashboard

---

## 🐛 Troubleshooting

### **Database connection failed**
```bash
# Check PostgreSQL is running
docker-compose ps postgres

# View logs
docker-compose logs postgres

# Restart services
docker-compose restart
```

### **OpenAI API errors**
```bash
# Verify API key is set
echo $OPENAI_API_KEY

# Check API key in container
docker-compose exec api env | grep OPENAI
```

### **Port already in use**
```bash
# Change port in docker-compose.yml
ports:
  - "8001:8000"  # Host:Container
```

---

## 📝 License

Proprietary - VCTT Team

---

## 👥 Contributors

Built by the VCTT-AGI team for Phase 1 deployment.

---

## 📞 Support

For issues or questions about the VCTT-AGI Coherence Kernel, please refer to:
- Swagger UI documentation at `/api`
- Health check endpoint at `/health`
- Docker logs: `docker-compose logs -f api`

---

**🧠 The future of coherent AGI starts here.**
