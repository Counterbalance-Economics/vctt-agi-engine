
"""Health and metrics endpoints"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import Dict, Any
import psutil
import time

from vctt_agi.core.database import get_db, check_db_connection

router = APIRouter()

# Track startup time for uptime calculation
startup_time = time.time()


@router.get("/health")
async def health_check(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """
    Health check endpoint
    
    Returns service health status and database connectivity
    """
    db_healthy = check_db_connection()
    
    return {
        "status": "healthy" if db_healthy else "degraded",
        "service": "VCTT-AGI Engine",
        "database": "connected" if db_healthy else "disconnected",
        "timestamp": time.time()
    }


@router.get("/metrics")
async def get_metrics() -> Dict[str, Any]:
    """
    System metrics endpoint
    
    Returns system resource usage and service metrics
    """
    # Calculate uptime
    uptime_seconds = int(time.time() - startup_time)
    
    # Get system metrics
    cpu_percent = psutil.cpu_percent(interval=1)
    memory = psutil.virtual_memory()
    disk = psutil.disk_usage('/')
    
    return {
        "service": {
            "uptime_seconds": uptime_seconds,
            "uptime_human": _format_uptime(uptime_seconds)
        },
        "system": {
            "cpu_percent": cpu_percent,
            "memory": {
                "total_mb": memory.total / (1024 * 1024),
                "available_mb": memory.available / (1024 * 1024),
                "used_percent": memory.percent
            },
            "disk": {
                "total_gb": disk.total / (1024 * 1024 * 1024),
                "used_gb": disk.used / (1024 * 1024 * 1024),
                "free_gb": disk.free / (1024 * 1024 * 1024),
                "used_percent": disk.percent
            }
        },
        "timestamp": time.time()
    }


def _format_uptime(seconds: int) -> str:
    """Format uptime in human-readable format"""
    days = seconds // 86400
    hours = (seconds % 86400) // 3600
    minutes = (seconds % 3600) // 60
    secs = seconds % 60
    
    parts = []
    if days > 0:
        parts.append(f"{days}d")
    if hours > 0:
        parts.append(f"{hours}h")
    if minutes > 0:
        parts.append(f"{minutes}m")
    parts.append(f"{secs}s")
    
    return " ".join(parts)
