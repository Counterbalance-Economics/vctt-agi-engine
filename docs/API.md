
# VCTT-AGI Engine API Documentation

## Overview

The VCTT-AGI Engine API provides endpoints for analyzing text through a multi-agent architecture with VCTT modules.

## Base URL

```
http://localhost:8000
```

## Endpoints

### Health & Metrics

#### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "service": "VCTT-AGI Engine",
  "database": "connected",
  "timestamp": 1699999999.999
}
```

#### GET /metrics

System metrics endpoint.

**Response:**
```json
{
  "service": {
    "uptime_seconds": 3600,
    "uptime_human": "1h 0m 0s"
  },
  "system": {
    "cpu_percent": 25.5,
    "memory": {...},
    "disk": {...}
  }
}
```

### Analysis

#### POST /api/v1/analyze

Main analysis endpoint - processes text through VCTT-AGI pipeline.

**Request Body:**
```json
{
  "text": "Your text to analyze...",
  "user_id": "optional_user_id",
  "context": {
    "optional": "context data"
  }
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "session_id": "uuid",
    "analysis": {
      "analyst_output": {...},
      "relational_output": {...},
      "synthesis": {...}
    },
    "internal_state": {
      "sim": {...},
      "contradiction": 0.4,
      "regulation": {...},
      "trust": 0.8
    },
    "metadata": {
      "processing_time_ms": 2500,
      "agents_used": ["analyst", "relational", "synthesiser"],
      "modules_executed": ["sim", "cam", "sre", "ctm", "ril"]
    }
  }
}
```

### Sessions

#### GET /api/v1/sessions/{session_id}

Retrieve session information.

**Response:**
```json
{
  "status": "success",
  "data": {
    "session_id": "uuid",
    "user_id": "user123",
    "status": "completed",
    "created_at": "2024-01-01T00:00:00",
    "context": {...}
  }
}
```

#### GET /api/v1/sessions/{session_id}/results

Get analysis results for a session.

**Response:**
```json
{
  "status": "success",
  "data": {
    "session_id": "uuid",
    "analysis_results": {...},
    "module_metrics": {...},
    "agent_logs": [...]
  }
}
```

#### GET /api/v1/sessions

List sessions with optional filtering.

**Query Parameters:**
- `user_id` (optional): Filter by user ID
- `limit` (default: 10): Maximum number of results
- `offset` (default: 0): Pagination offset

## Interactive Documentation

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## Authentication

Currently, no authentication is required. This will be added in Phase 2.

## Rate Limiting

Not implemented in Phase 1. To be added in Phase 2.
