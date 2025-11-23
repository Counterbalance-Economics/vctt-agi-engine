# 🌐 STAGE 2: WORLD MODEL & KNOWLEDGE GRAPH - IMPLEMENTATION PLAN

**Status:** 🚀 **IN PROGRESS**  
**Branch:** `phase-4-agi-tier-4`  
**Dependencies:** Stage 0 (Safety) ✅, Stage 1 (Memory) ✅

---

## 🎯 MISSION

Build a **structured knowledge representation system** that extracts entities, relationships, and concepts from memories and conversations, creating a persistent world model for AGI reasoning.

---

## 📋 DELIVERABLES

### 1. **Knowledge Graph Database Schema** 🗄️
- Extend Prisma schema with knowledge graph tables
- Tables: `entities`, `relationships`, `concepts`, `concept_hierarchy`
- VCTT trust scores on all knowledge nodes
- Temporal tracking (when knowledge was learned)

### 2. **Entity Extraction Service** 🔍
- Extract named entities from text (people, places, organizations, concepts)
- Entity type classification
- Entity linking (resolve same entity across mentions)
- Confidence scoring with VCTT integration

### 3. **Knowledge Graph Service** 🕸️
- Store entities and relationships
- Query knowledge graph (find related entities)
- Path finding (how are X and Y connected?)
- Subgraph extraction (get all knowledge about X)
- VCTT-weighted reasoning (trust-based knowledge filtering)

### 4. **Concept Hierarchy Service** 🌳
- Build taxonomies (AGI > Machine Learning > Neural Networks)
- Parent-child relationships
- "Is-a" and "Part-of" relationships
- Concept similarity scoring

### 5. **Cross-Session Learning** 🔄
- Learn from multiple sessions
- Pattern detection across conversations
- Knowledge consolidation (merge duplicate entities)
- Contradiction detection (VCTT-based conflict resolution)

### 6. **Mycelium Network Integration** 🧠
- Connect knowledge graph to Truth Mycelium (existing module)
- Use Jazz counterfactual reasoning on knowledge claims
- VCTT verification of knowledge entries
- Multi-agent validation of relationships

### 7. **Knowledge Graph APIs** 🌐
- `POST /api/knowledge/extract` - Extract entities from text
- `POST /api/knowledge/entity` - Create/update entity
- `GET /api/knowledge/entity/:id` - Get entity with relationships
- `POST /api/knowledge/relationship` - Create relationship
- `GET /api/knowledge/query` - Query knowledge graph
- `GET /api/knowledge/subgraph/:entityId` - Get subgraph
- `GET /api/knowledge/concepts` - Get concept hierarchy
- `POST /api/knowledge/learn` - Learn from conversation

### 8. **Safety Integration** 🛡️
- All knowledge writes gated by SafetySteward
- VCTT trust scoring on all knowledge
- Knowledge audit trail
- Respects Stage 0 modes (RESEARCH/DEVELOPMENT/AUTONOMOUS)

---

## 🏗️ ARCHITECTURE

```
┌─────────────────────────────────────────────────────┐
│          Stage 2: World Model & Knowledge Graph      │
├─────────────────────────────────────────────────────┤
│                                                      │
│  ┌──────────────┐    ┌───────────────┐             │
│  │   Knowledge  │───▶│     Entity    │             │
│  │  Controller  │    │   Extraction  │             │
│  └──────────────┘    │    Service    │             │
│         │             └───────────────┘             │
│         ▼                     │                     │
│  ┌──────────────┐            ▼                     │
│  │   Knowledge  │    ┌───────────────┐             │
│  │     Graph    │───▶│   PostgreSQL  │             │
│  │   Service    │    │  (Extended)   │             │
│  └──────────────┘    └───────────────┘             │
│         │                                           │
│         ├──────▶ ConceptHierarchy                  │
│         ├──────▶ TruthMycelium (VCTT)              │
│         ├──────▶ SafetySteward (Stage 0)           │
│         └──────▶ MemoryService (Stage 1)           │
│                                                      │
└─────────────────────────────────────────────────────┘
```

---

## 📊 DATABASE SCHEMA

### New Tables

```prisma
// Entities (people, places, concepts, organizations)
model Entity {
  id            String   @id @default(uuid())
  userId        String   // User who owns this knowledge
  name          String   // Entity name
  type          String   // person, place, organization, concept, event, etc.
  description   String?  // Description of entity
  attributes    Json?    // Flexible attributes (JSON)
  embedding     Json?    // Semantic embedding
  vcttScore     Decimal  // Trust metric for this entity
  confidence    Decimal  // Extraction confidence
  firstMentioned DateTime // When first learned
  lastUpdated   DateTime @updatedAt
  sourceMemoryId String? // Reference to memory that created this
  
  // Relationships
  relationshipsFrom Relationship[] @relation("FromEntity")
  relationshipsTo   Relationship[] @relation("ToEntity")
  concepts          ConceptMapping[]
  
  @@index([userId])
  @@index([type])
  @@index([name])
}

// Relationships between entities
model Relationship {
  id            String   @id @default(uuid())
  userId        String   // User who owns this knowledge
  fromEntityId  String
  toEntityId    String
  relationType  String   // works_for, located_in, part_of, related_to, etc.
  properties    Json?    // Additional properties
  vcttScore     Decimal  // Trust metric
  confidence    Decimal
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  sourceMemoryId String?
  
  fromEntity    Entity @relation("FromEntity", fields: [fromEntityId], references: [id])
  toEntity      Entity @relation("ToEntity", fields: [toEntityId], references: [id])
  
  @@index([userId])
  @@index([fromEntityId])
  @@index([toEntityId])
  @@index([relationType])
}

// Concepts and taxonomies
model Concept {
  id            String   @id @default(uuid())
  name          String   @unique
  description   String?
  parentId      String?  // For hierarchies (AGI -> AI -> Machine Learning)
  level         Int      // Depth in hierarchy
  embedding     Json?
  vcttScore     Decimal
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  parent        Concept?  @relation("ConceptHierarchy", fields: [parentId], references: [id])
  children      Concept[] @relation("ConceptHierarchy")
  entities      ConceptMapping[]
  
  @@index([parentId])
  @@index([name])
}

// Mapping between entities and concepts
model ConceptMapping {
  id            String   @id @default(uuid())
  entityId      String
  conceptId     String
  relevance     Decimal  // How relevant is this concept to this entity
  
  entity        Entity   @relation(fields: [entityId], references: [id])
  concept       Concept  @relation(fields: [conceptId], references: [id])
  
  @@index([entityId])
  @@index([conceptId])
}
```

---

## 🔧 SERVICES TO BUILD

### 1. **EntityExtractionService**
- Uses LLM to extract entities from text
- Entity type classification
- Confidence scoring
- Deduplication (link to existing entities)

### 2. **KnowledgeGraphService**
- CRUD for entities and relationships
- Graph queries (BFS, DFS, shortest path)
- Subgraph extraction
- VCTT-weighted reasoning
- Integration with Memory Service

### 3. **ConceptHierarchyService**
- Build and maintain concept taxonomies
- Parent-child relationships
- Concept similarity (using embeddings)
- Query by concept (find all entities tagged with "AGI")

### 4. **CrossSessionLearningService**
- Aggregate knowledge across sessions
- Detect patterns and recurring themes
- Consolidate duplicate entities
- Detect contradictions (use VCTT to resolve)

### 5. **MyceliumKnowledgeService**
- Integrate with Truth Mycelium
- Jazz counterfactual verification of knowledge claims
- VCTT trust scoring
- Multi-agent validation

---

## 🎛️ ENVIRONMENT VARIABLES

```bash
# Stage 2: Knowledge Graph
KNOWLEDGE_GRAPH_ENABLED=false  # Default: false (safe)
ENTITY_EXTRACTION_MODEL=grok-beta  # LLM for entity extraction
MIN_ENTITY_CONFIDENCE=0.7  # Minimum confidence to store entity
MIN_VCTT_SCORE_KNOWLEDGE=0.75  # Minimum VCTT for knowledge storage
ENABLE_CROSS_SESSION_LEARNING=true
ENABLE_MYCELIUM_VERIFICATION=true
```

---

## 🧪 TESTING STRATEGY

### Unit Tests
- Entity extraction accuracy
- Relationship creation
- Concept hierarchy queries
- VCTT scoring

### Integration Tests
- Memory → Knowledge Graph pipeline
- Cross-session learning
- Mycelium verification
- Safety mode gating

### End-to-End Tests
1. Store conversation memory (Stage 1)
2. Extract entities automatically
3. Query knowledge graph
4. Verify VCTT scores
5. Test safety gating

---

## 🛡️ SAFETY REQUIREMENTS

### Mode Gating
- **RESEARCH Mode**: Read-only (no knowledge writes)
- **DEVELOPMENT Mode**: Full read/write (for testing)
- **AUTONOMOUS Mode**: Full capabilities with Mycelium verification
- **EMERGENCY Mode**: All operations blocked

### VCTT Integration
- Every entity has a trust score
- Every relationship has a trust score
- Low-trust knowledge flagged for review
- Contradictions resolved using VCTT scores

### Audit Trail
- All knowledge operations logged
- Source memory tracked
- Extraction confidence recorded
- VCTT verification results stored

---

## 📈 SUCCESS CRITERIA

- [ ] Prisma schema extended with 4 new tables
- [ ] Entity extraction working with LLM
- [ ] Knowledge graph CRUD operational
- [ ] Concept hierarchy implemented
- [ ] Cross-session learning functional
- [ ] Mycelium verification integrated
- [ ] 8 knowledge graph APIs deployed
- [ ] Safety integration (Stage 0 compliance)
- [ ] VCTT scoring on all knowledge
- [ ] Full audit trail
- [ ] Swagger documentation
- [ ] All tests passing
- [ ] Production-ready

---

## 🚀 IMPLEMENTATION PHASES

### Phase 2.1: Database & Core Services (1-2 hours)
- Extend Prisma schema
- Build EntityExtractionService
- Build KnowledgeGraphService
- Basic CRUD operations

### Phase 2.2: Advanced Features (1 hour)
- ConceptHierarchyService
- CrossSessionLearningService
- Graph query algorithms

### Phase 2.3: Mycelium Integration (1 hour)
- Connect to Truth Mycelium
- VCTT verification
- Jazz counterfactual reasoning

### Phase 2.4: APIs & Testing (30 min)
- Build KnowledgeController
- Add Swagger docs
- Integration tests
- Safety verification

---

## 🎯 EXPECTED OUTCOMES

### Immediate Benefits
1. **Structured Knowledge** - Entities and relationships persisted
2. **Semantic Queries** - "Who works for X?" queries work
3. **Knowledge Discovery** - Find connections between concepts
4. **Trust-Weighted Reasoning** - VCTT scores guide knowledge use
5. **Cross-Session Learning** - AGI learns from past conversations

### Future Capabilities (Stage 3+)
- Goal planning using world model
- Predictive reasoning (what will happen if...)
- Causal reasoning (why did X happen?)
- Autonomous knowledge acquisition
- Self-improving world model

---

**Status:** ⏳ **READY TO BEGIN**  
**Estimated Time:** 3-4 hours  
**Risk Level:** 🟡 **MODERATE** (complex graph operations)

---

**Next Steps:**
1. Extend Prisma schema ✅ (starting now)
2. Build entity extraction
3. Build knowledge graph service
4. Integrate with Mycelium
5. Add APIs
6. Test and deploy
