
"""Database initialization script"""
import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from vctt_agi.core.database import init_db, check_db_connection
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def main():
    """Initialize database"""
    logger.info("Checking database connection...")
    
    if not check_db_connection():
        logger.error("Cannot connect to database. Please ensure PostgreSQL is running.")
        sys.exit(1)
    
    logger.info("Database connection successful")
    logger.info("Initializing database tables...")
    
    try:
        init_db()
        logger.info("Database initialized successfully")
    except Exception as e:
        logger.error(f"Database initialization failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
