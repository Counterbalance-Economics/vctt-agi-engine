
"""Seed database with sample data for testing"""
import sys
from pathlib import Path
import uuid
from datetime import datetime

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from vctt_agi.core.database import SessionLocal
from vctt_agi.core.models import Session, AnalysisResult, ModuleMetric, AgentLog, SessionStatus, AgentType
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def seed_database():
    """Seed database with sample data"""
    db = SessionLocal()
    
    try:
        logger.info("Seeding database with sample data...")
        
        # Create sample session
        session_id = uuid.uuid4()
        session = Session(
            id=session_id,
            user_id="test_user_001",
            status=SessionStatus.COMPLETED,
            context={"source": "test", "type": "sample"}
        )
        db.add(session)
        
        # Create sample analysis result
        analysis = AnalysisResult(
            session_id=session_id,
            agent_type=AgentType.ANALYST,
            content={
                "structure": {"type": "deductive", "validity": "valid"},
                "strength": {"score": 0.75, "rating": "strong"}
            },
            confidence=0.85
        )
        db.add(analysis)
        
        # Create sample module metric
        metric = ModuleMetric(
            session_id=session_id,
            module_name="SIM",
            metrics_json={
                "tension": 0.3,
                "uncertainty": 0.4,
                "emotional_intensity": 0.5
            }
        )
        db.add(metric)
        
        # Create sample agent log
        log = AgentLog(
            session_id=session_id,
            agent_type=AgentType.ANALYST,
            action="analyze_text",
            details={"status": "completed", "duration_ms": 1500}
        )
        db.add(log)
        
        db.commit()
        logger.info(f"Sample session created: {session_id}")
        logger.info("Database seeded successfully")
        
    except Exception as e:
        logger.error(f"Error seeding database: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
