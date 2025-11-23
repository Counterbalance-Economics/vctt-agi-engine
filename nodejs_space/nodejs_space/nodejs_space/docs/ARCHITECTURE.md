
# VCTT-AGI Engine Architecture

## Overview

The VCTT-AGI Engine uses a multi-agent architecture with five VCTT modules to provide comprehensive critical thinking analysis.

## Architecture Diagram

```
Input Text
    ↓
[Analyst Agent] → Analysis of argument structure, fallacies
    ↓
[VCTT Modules]
├── SIM: Situational Interpretation
├── CAM: Contradiction Analysis  
├── SRE: Self-Regulation
├── CTM: Contextual Trust
└── RIL: Relational Inference
    ↓
[Relational Agent] → Concept mapping, relationship graphs
    ↓
[RIL Module] → Relational inference
    ↓
[Synthesiser Agent] → Final synthesis and insights
    ↓
Output Results
```

## Components

### Agents

1. **Analyst Agent**: Analyzes argument structure, detects fallacies, extracts premises/conclusions
2. **Relational Agent**: Maps concept relationships, builds knowledge graphs
3. **Synthesiser Agent**: Synthesizes information, generates insights, creates narratives

### VCTT Modules

1. **SIM**: Tracks tension, uncertainty, emotional intensity
2. **CAM**: Detects contradictions, calculates contradiction scores
3. **SRE**: Manages regulation modes (normal/clarify/slow_down)
4. **CTM**: Calculates and tracks trust metrics
5. **RIL**: Handles relational reasoning and inference

### Orchestrator

Coordinates the pipeline flow and manages internal state.

## Data Flow

1. Input received via API
2. Session created in database
3. Analyst processes text
4. VCTT modules analyze results
5. Relational agent maps concepts
6. RIL performs inference
7. Synthesiser generates final output
8. Results stored in database
9. Response returned to client

## Database Schema

### Tables

- **sessions**: Training session tracking
- **analysis_results**: Agent analysis outputs
- **module_metrics**: VCTT module measurements
- **agent_logs**: Agent execution logs

## Technology Stack

- **Framework**: FastAPI
- **Language**: Python 3.11
- **Database**: PostgreSQL with SQLAlchemy
- **LLM**: OpenAI GPT-4 / Anthropic Claude
- **Deployment**: Docker Compose
