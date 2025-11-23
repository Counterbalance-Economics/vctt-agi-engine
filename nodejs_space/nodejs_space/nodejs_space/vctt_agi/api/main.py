
"""Main FastAPI application"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging

from vctt_agi.core.config import settings
from vctt_agi.core.database import check_db_connection
from vctt_agi.api.routes import analyze, sessions, health

logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title=settings.API_TITLE,
    description=settings.API_DESCRIPTION,
    version=settings.API_VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health.router, tags=["Health"])
app.include_router(
    analyze.router,
    prefix=settings.API_V1_PREFIX,
    tags=["Analysis"]
)
app.include_router(
    sessions.router,
    prefix=settings.API_V1_PREFIX,
    tags=["Sessions"]
)


@app.on_event("startup")
async def startup_event():
    """Run on application startup"""
    logger.info("Starting VCTT-AGI Engine API")
    
    # Check database connection
    if check_db_connection():
        logger.info("Database connection successful")
    else:
        logger.error("Database connection failed")
    
    logger.info(f"API running at {settings.HOST}:{settings.PORT}")
    logger.info(f"Documentation available at http://{settings.HOST}:{settings.PORT}/docs")


@app.on_event("shutdown")
async def shutdown_event():
    """Run on application shutdown"""
    logger.info("Shutting down VCTT-AGI Engine API")


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "VCTT-AGI Engine",
        "version": settings.API_VERSION,
        "status": "running",
        "docs": "/docs"
    }
