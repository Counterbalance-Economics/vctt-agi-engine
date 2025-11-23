# STAGE 1: PERSISTENT MEMORY SYSTEM - IMPLEMENTATION PLAN

**Branch:** `phase-4-agi-tier-4`  
**Prerequisites:** ✅ Stage 0 Complete  
**Status:** 🚧 IN PROGRESS

---

## 🎯 OBJECTIVES

Build a secure, consent-based persistent memory system that:
- Stores conversation history and learned patterns
- Provides semantic retrieval via vector embeddings
- Enforces user isolation and consent
- Integrates with VCTT trust framework
- Provides audit trails for all memory operations
- Supports right to deletion (GDPR compliant)

---

## 🏗️ ARCHITECTURE

### Core Components

```
┌─────────────────────────────────────────────────────────┐
│                   Memory System                          │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────┐    ┌──────────────┐   ┌───────────┐  │
│  │   Memory     │───▶│   Vector     │──▶│  Consent  │  │
│  │   Service    │    │   Store      │   │  Manager  │  │
│  └──────────────┘    └──────────────┘   └───────────┘  │
│         │                    │                  │        │
│         ▼                    ▼                  ▼        │
│  ┌──────────────┐    ┌──────────────┐   ┌───────────┐  │
│  │  PostgreSQL  │    │  Embeddings  │   │   Audit   │  │
│  │   Database   │    │    (VCTT)    │   │   Logs    │  │
│  └──────────────┘    └──────────────┘   └───────────┘  │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Database Schema

```sql
-- User memory stores
CREATE TABLE user_memory (
  id UUID PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  session_id VARCHAR(255),
  memory_type VARCHAR(50),  -- 'conversation', 'learned_fact', 'preference'
  content TEXT NOT NULL,
  embedding VECTOR(1536),   -- For semantic search
  metadata JSONB,
  vctt_score DECIMAL(5,2),  -- Trust metric
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_session_id (session_id)
);

-- Consent records
CREATE TABLE memory_consent (
  id UUID PRIMARY KEY,
  user_id VARCHAR(255) UNIQUE NOT NULL,
  consent_given BOOLEAN DEFAULT FALSE,
  consent_date TIMESTAMP,
  consent_version VARCHAR(20),
  preferences JSONB,  -- Fine-grained consent settings
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Memory audit trail
CREATE TABLE memory_audit (
  id UUID PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  operation VARCHAR(50),  -- 'CREATE', 'READ', 'UPDATE', 'DELETE'
  memory_id UUID,
  reason TEXT,
  vctt_verification BOOLEAN,
  timestamp TIMESTAMP DEFAULT NOW(),
  metadata JSONB
);
```

---

## 📋 IMPLEMENTATION CHECKLIST

### Phase 1A: Database Setup (30 min)
- [ ] Initialize PostgreSQL database
- [ ] Create memory schema migrations
- [ ] Add pgvector extension for embeddings
- [ ] Create database models

### Phase 1B: Memory Service (45 min)
- [ ] Create MemoryService class
- [ ] Implement CRUD operations
- [ ] Add user isolation
- [ ] Integrate with VCTT scoring

### Phase 1C: Consent Management (30 min)
- [ ] Create ConsentManager service
- [ ] Add consent check decorators
- [ ] Implement consent APIs
- [ ] Add consent audit logging

### Phase 1D: Vector Embeddings (45 min)
- [ ] Add OpenAI/local embeddings service
- [ ] Implement semantic search
- [ ] Add embedding refresh logic
- [ ] Optimize retrieval queries

### Phase 1E: Right to Deletion (20 min)
- [ ] Implement hard delete endpoint
- [ ] Add anonymization option
- [ ] Create export functionality
- [ ] Add deletion audit trails

### Phase 1F: Integration (30 min)
- [ ] Integrate with SafetyStewardAgent
- [ ] Add memory APIs to Swagger
- [ ] Update main conversation flow
- [ ] Add memory context to prompts

### Phase 1G: Testing (30 min)
- [ ] Unit tests for memory service
- [ ] Integration tests
- [ ] Consent flow tests
- [ ] Deletion verification

### Phase 1H: Documentation (15 min)
- [ ] API documentation
- [ ] Memory architecture docs
- [ ] Consent policy document
- [ ] Stage 1 completion report

**Total Estimated Time:** ~4 hours

---

## 🔐 SAFETY INTEGRATION

### SafetySteward Checks
- All memory writes require SafetySteward approval
- Memory retrieval respects operation mode
- Deletion requests logged and verified

### VCTT Integration
- Each memory entry has VCTT trust score
- Low-trust memories marked for review
- Jazz counterfactual analysis on retrieval

### Consent Enforcement
- No memory persistence without explicit consent
- Granular consent per memory type
- Consent revocation deletes all user data

---

## 🎛️ ENVIRONMENT VARIABLES

```bash
# Stage 1: Memory System
MEMORY_PERSISTENCE_ENABLED=false  # Default OFF
MEMORY_RETENTION_DAYS=90          # Default retention
MEMORY_MAX_ENTRIES_PER_USER=10000 # Quota
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_DIMENSIONS=1536
PGVECTOR_ENABLED=true
```

---

## 📊 SUCCESS CRITERIA

- [ ] Users can opt-in to memory persistence
- [ ] Memories stored with VCTT scores
- [ ] Semantic search returns relevant context
- [ ] Users can view and delete their data
- [ ] All memory operations audited
- [ ] Consent properly enforced
- [ ] Integration with existing conversation flow
- [ ] Documentation complete
- [ ] Tests passing
- [ ] Deployment checkpoint saved

---

## 🚀 ROLLOUT PLAN

1. **Development Mode Testing:** Test with `MEMORY_PERSISTENCE_ENABLED=false`
2. **Internal Testing:** Enable for test users
3. **Beta Rollout:** Gradual rollout with monitoring
4. **Production:** Full deployment with consent flow

---

**Status:** Ready to begin implementation  
**Next Action:** Initialize PostgreSQL database
