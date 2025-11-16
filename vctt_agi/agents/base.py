
"""Base agent class for all VCTT agents"""
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
from dataclasses import dataclass
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


@dataclass
class AgentInput:
    """Input data structure for agents"""
    text: str
    context: Optional[Dict[str, Any]] = None
    session_id: Optional[str] = None


@dataclass
class AgentOutput:
    """Output data structure for agents"""
    agent_type: str
    result: Dict[str, Any]
    confidence: float
    metadata: Dict[str, Any]
    timestamp: datetime
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return {
            "agent_type": self.agent_type,
            "result": self.result,
            "confidence": self.confidence,
            "metadata": self.metadata,
            "timestamp": self.timestamp.isoformat()
        }


class BaseAgent(ABC):
    """Abstract base class for all agents"""
    
    def __init__(self, api_key: Optional[str] = None, model: str = "gpt-4"):
        """
        Initialize agent
        
        Args:
            api_key: API key for LLM provider (OpenAI or Anthropic)
            model: Model name to use
        """
        self.api_key = api_key
        self.model = model
        self.logger = logging.getLogger(f"{__name__}.{self.__class__.__name__}")
    
    @abstractmethod
    async def process(self, input_data: AgentInput) -> AgentOutput:
        """
        Process input and generate output
        
        Args:
            input_data: Input data for the agent
            
        Returns:
            Agent output with results
        """
        pass
    
    def _create_output(
        self, 
        agent_type: str, 
        result: Dict[str, Any], 
        confidence: float = 0.8,
        metadata: Optional[Dict[str, Any]] = None
    ) -> AgentOutput:
        """
        Create standardized agent output
        
        Args:
            agent_type: Type of agent
            result: Result data
            confidence: Confidence score (0.0-1.0)
            metadata: Additional metadata
            
        Returns:
            AgentOutput instance
        """
        return AgentOutput(
            agent_type=agent_type,
            result=result,
            confidence=min(max(confidence, 0.0), 1.0),
            metadata=metadata or {},
            timestamp=datetime.utcnow()
        )
    
    async def log_action(self, action: str, details: Dict[str, Any]) -> None:
        """
        Log agent action
        
        Args:
            action: Action description
            details: Additional details
        """
        self.logger.info(f"{self.__class__.__name__}: {action}", extra=details)
