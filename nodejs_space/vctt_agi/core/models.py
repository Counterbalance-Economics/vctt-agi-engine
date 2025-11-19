
"""SQLAlchemy database models"""
from sqlalchemy import Column, String, Integer, Float, DateTime, Text, JSON, ForeignKey, Enum
from sqlalchemy.types import TypeDecorator, CHAR
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
import enum

from vctt_agi.core.database import Base


class UUID(TypeDecorator):
    """Platform-independent UUID type. Uses PostgreSQL UUID or CHAR(36) for SQLite"""
    impl = CHAR
    cache_ok = True
    
    def load_dialect_impl(self, dialect):
        if dialect.name == 'postgresql':
            return dialect.type_descriptor(PG_UUID(as_uuid=True))
        else:
            return dialect.type_descriptor(CHAR(36))
    
    def process_bind_param(self, value, dialect):
        if value is None:
            return value
        elif dialect.name == 'postgresql':
            return str(value)
        else:
            if isinstance(value, uuid.UUID):
                return str(value)
            return value
    
    def process_result_value(self, value, dialect):
        if value is None:
            return value
        if isinstance(value, uuid.UUID):
            return value
        return uuid.UUID(value)


class SessionStatus(str, enum.Enum):
    """Session status enumeration"""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class AgentType(str, enum.Enum):
    """Agent type enumeration"""
    ANALYST = "analyst"
    RELATIONAL = "relational"
    SYNTHESISER = "synthesiser"


class Session(Base):
    """Training session tracking table"""
    __tablename__ = "sessions"
    
    id = Column(UUID, primary_key=True, default=uuid.uuid4)
    user_id = Column(String(255), nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    status = Column(Enum(SessionStatus), default=SessionStatus.PENDING, nullable=False)
    context = Column(JSON, nullable=True)
    
    # Relationships
    analysis_results = relationship("AnalysisResult", back_populates="session", cascade="all, delete-orphan")
    module_metrics = relationship("ModuleMetric", back_populates="session", cascade="all, delete-orphan")
    agent_logs = relationship("AgentLog", back_populates="session", cascade="all, delete-orphan")


class AnalysisResult(Base):
    """Agent analysis outputs table"""
    __tablename__ = "analysis_results"
    
    id = Column(UUID, primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID, ForeignKey("sessions.id"), nullable=False, index=True)
    agent_type = Column(Enum(AgentType), nullable=False)
    content = Column(JSON, nullable=False)
    confidence = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationships
    session = relationship("Session", back_populates="analysis_results")


class ModuleMetric(Base):
    """VCTT module measurements table"""
    __tablename__ = "module_metrics"
    
    id = Column(UUID, primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID, ForeignKey("sessions.id"), nullable=False, index=True)
    module_name = Column(String(50), nullable=False)
    metrics_json = Column(JSON, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationships
    session = relationship("Session", back_populates="module_metrics")


class AgentLog(Base):
    """Agent execution logs table"""
    __tablename__ = "agent_logs"
    
    id = Column(UUID, primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID, ForeignKey("sessions.id"), nullable=False, index=True)
    agent_type = Column(Enum(AgentType), nullable=False)
    action = Column(String(255), nullable=False)
    details = Column(JSON, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationships
    session = relationship("Session", back_populates="agent_logs")
