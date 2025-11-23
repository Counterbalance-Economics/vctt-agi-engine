
"""Session management endpoints"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Dict, Any, List
import logging

from vctt_agi.core.database import get_db
from vctt_agi.core.models import Session as DBSession, AnalysisResult, ModuleMetric, AgentLog

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/sessions/{session_id}")
async def get_session(
    session_id: str,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Retrieve session information
    
    Returns session metadata including status, timestamps, and context
    """
    try:
        # Query session
        session = db.query(DBSession).filter(DBSession.id == session_id).first()
        
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Session {session_id} not found"
            )
        
        return {
            "status": "success",
            "data": {
                "session_id": str(session.id),
                "user_id": session.user_id,
                "status": session.status.value,
                "created_at": session.created_at.isoformat(),
                "updated_at": session.updated_at.isoformat() if session.updated_at else None,
                "context": session.context
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving session: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve session: {str(e)}"
        )


@router.get("/sessions/{session_id}/results")
async def get_session_results(
    session_id: str,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Get analysis results for a session
    
    Returns all analysis results, module metrics, and agent logs for the session
    """
    try:
        # Check if session exists
        session = db.query(DBSession).filter(DBSession.id == session_id).first()
        
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Session {session_id} not found"
            )
        
        # Get analysis results
        analysis_results = db.query(AnalysisResult).filter(
            AnalysisResult.session_id == session_id
        ).all()
        
        # Get module metrics
        module_metrics = db.query(ModuleMetric).filter(
            ModuleMetric.session_id == session_id
        ).all()
        
        # Get agent logs
        agent_logs = db.query(AgentLog).filter(
            AgentLog.session_id == session_id
        ).order_by(AgentLog.timestamp).all()
        
        # Format analysis results by agent type
        analysis_by_agent = {}
        for result in analysis_results:
            analysis_by_agent[result.agent_type.value] = {
                "id": str(result.id),
                "content": result.content,
                "confidence": result.confidence,
                "created_at": result.created_at.isoformat()
            }
        
        # Format module metrics
        metrics_by_module = {}
        for metric in module_metrics:
            if metric.module_name not in metrics_by_module:
                metrics_by_module[metric.module_name] = []
            metrics_by_module[metric.module_name].append({
                "id": str(metric.id),
                "metrics": metric.metrics_json,
                "timestamp": metric.timestamp.isoformat()
            })
        
        # Format agent logs
        logs = [
            {
                "id": str(log.id),
                "agent_type": log.agent_type.value,
                "action": log.action,
                "details": log.details,
                "timestamp": log.timestamp.isoformat()
            }
            for log in agent_logs
        ]
        
        return {
            "status": "success",
            "data": {
                "session_id": session_id,
                "session_status": session.status.value,
                "analysis_results": analysis_by_agent,
                "module_metrics": metrics_by_module,
                "agent_logs": logs,
                "created_at": session.created_at.isoformat()
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving results: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve results: {str(e)}"
        )


@router.get("/sessions")
async def list_sessions(
    user_id: str = None,
    limit: int = 10,
    offset: int = 0,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    List sessions with optional filtering
    
    Args:
        user_id: Optional filter by user ID
        limit: Maximum number of sessions to return
        offset: Offset for pagination
    """
    try:
        query = db.query(DBSession)
        
        # Filter by user_id if provided
        if user_id:
            query = query.filter(DBSession.user_id == user_id)
        
        # Order by creation date (newest first)
        query = query.order_by(DBSession.created_at.desc())
        
        # Apply pagination
        total = query.count()
        sessions = query.limit(limit).offset(offset).all()
        
        # Format sessions
        session_list = [
            {
                "session_id": str(s.id),
                "user_id": s.user_id,
                "status": s.status.value,
                "created_at": s.created_at.isoformat(),
                "updated_at": s.updated_at.isoformat() if s.updated_at else None
            }
            for s in sessions
        ]
        
        return {
            "status": "success",
            "data": {
                "sessions": session_list,
                "pagination": {
                    "total": total,
                    "limit": limit,
                    "offset": offset,
                    "count": len(session_list)
                }
            }
        }
        
    except Exception as e:
        logger.error(f"Error listing sessions: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list sessions: {str(e)}"
        )
