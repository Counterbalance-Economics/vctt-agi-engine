
"""Analysis endpoint - Main VCTT processing"""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from typing import Optional, Dict, Any
import uuid
import logging

from vctt_agi.core.database import get_db
from vctt_agi.core.models import Session as DBSession, AnalysisResult, ModuleMetric, AgentLog, SessionStatus, AgentType
from vctt_agi.core.config import settings
from vctt_agi.orchestrator.pipeline import VCTTOrchestrator

logger = logging.getLogger(__name__)
router = APIRouter()


class AnalyzeRequest(BaseModel):
    """Request model for analysis endpoint"""
    text: str = Field(..., min_length=10, description="Text to analyze")
    user_id: Optional[str] = Field(None, description="Optional user identifier")
    context: Optional[Dict[str, Any]] = Field(None, description="Optional context data")
    
    class Config:
        schema_extra = {
            "example": {
                "text": "We should implement renewable energy because it's sustainable and reduces carbon emissions. However, the initial costs are high.",
                "user_id": "user123",
                "context": {"source": "debate_platform"}
            }
        }


class AnalyzeResponse(BaseModel):
    """Response model for analysis endpoint"""
    status: str
    data: Optional[Dict[str, Any]] = None
    error: Optional[Dict[str, str]] = None


@router.post("/analyze", response_model=AnalyzeResponse, status_code=status.HTTP_200_OK)
async def analyze_text(
    request: AnalyzeRequest,
    db: Session = Depends(get_db)
) -> AnalyzeResponse:
    """
    Main analysis endpoint - processes text through VCTT-AGI pipeline
    
    This endpoint:
    1. Creates a new session
    2. Runs the full VCTT pipeline (Analyst → Modules → Relational → Synthesiser)
    3. Stores results in database
    4. Returns comprehensive analysis with internal state
    
    **Required**: OPENAI_API_KEY environment variable must be set
    """
    try:
        # Check for API key
        if not settings.OPENAI_API_KEY:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="OPENAI_API_KEY not configured"
            )
        
        # Create session in database
        session_id = str(uuid.uuid4())
        db_session = DBSession(
            id=session_id,
            user_id=request.user_id,
            status=SessionStatus.PROCESSING,
            context=request.context
        )
        db.add(db_session)
        db.commit()
        
        logger.info(f"Created session {session_id} for analysis")
        
        # Initialize orchestrator
        orchestrator = VCTTOrchestrator(
            openai_api_key=settings.OPENAI_API_KEY,
            anthropic_api_key=settings.ANTHROPIC_API_KEY
        )
        
        # Process through pipeline
        result = await orchestrator.process(
            text=request.text,
            user_id=request.user_id,
            session_id=session_id
        )
        
        if result["status"] == "error":
            # Update session status to failed
            db_session.status = SessionStatus.FAILED
            db.commit()
            
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=result["error"]["message"]
            )
        
        # Store analysis results in database
        await _store_results(db, session_id, result["data"])
        
        # Update session status to completed
        db_session.status = SessionStatus.COMPLETED
        db.commit()
        
        logger.info(f"Analysis completed for session {session_id}")
        
        return AnalyzeResponse(
            status="success",
            data=result["data"]
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Analysis error: {e}", exc_info=True)
        
        # Update session if it exists
        if 'db_session' in locals():
            db_session.status = SessionStatus.FAILED
            db.commit()
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Analysis failed: {str(e)}"
        )


async def _store_results(db: Session, session_id: str, data: Dict[str, Any]):
    """Store analysis results in database"""
    try:
        analysis = data.get("analysis", {})
        module_details = data.get("module_details", {})
        
        # Store analyst results
        if "analyst_output" in analysis:
            analyst_result = AnalysisResult(
                session_id=session_id,
                agent_type=AgentType.ANALYST,
                content=analysis["analyst_output"],
                confidence=analysis["analyst_output"].get("confidence", 0.8)
            )
            db.add(analyst_result)
            
            # Log analyst action
            analyst_log = AgentLog(
                session_id=session_id,
                agent_type=AgentType.ANALYST,
                action="analyze_text",
                details={"status": "completed"}
            )
            db.add(analyst_log)
        
        # Store relational results
        if "relational_output" in analysis:
            relational_result = AnalysisResult(
                session_id=session_id,
                agent_type=AgentType.RELATIONAL,
                content=analysis["relational_output"],
                confidence=analysis["relational_output"].get("confidence", 0.8)
            )
            db.add(relational_result)
            
            # Log relational action
            relational_log = AgentLog(
                session_id=session_id,
                agent_type=AgentType.RELATIONAL,
                action="map_relationships",
                details={"status": "completed"}
            )
            db.add(relational_log)
        
        # Store synthesiser results
        if "synthesis" in analysis:
            synthesis_result = AnalysisResult(
                session_id=session_id,
                agent_type=AgentType.SYNTHESISER,
                content=analysis["synthesis"],
                confidence=analysis["synthesis"].get("confidence", 0.8)
            )
            db.add(synthesis_result)
            
            # Log synthesiser action
            synthesis_log = AgentLog(
                session_id=session_id,
                agent_type=AgentType.SYNTHESISER,
                action="synthesize",
                details={"status": "completed"}
            )
            db.add(synthesis_log)
        
        # Store module metrics
        for module_name, metrics in module_details.items():
            module_metric = ModuleMetric(
                session_id=session_id,
                module_name=module_name.upper(),
                metrics_json=metrics
            )
            db.add(module_metric)
        
        db.commit()
        logger.info(f"Stored results for session {session_id}")
        
    except Exception as e:
        logger.error(f"Error storing results: {e}", exc_info=True)
        db.rollback()
        raise
