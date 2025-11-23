
"""Main orchestrator for coordinating agents and modules"""
from typing import Dict, Any, Optional
from datetime import datetime
import logging
import time

from vctt_agi.agents.analyst import AnalystAgent
from vctt_agi.agents.relational import RelationalAgent
from vctt_agi.agents.synthesiser import SynthesiserAgent
from vctt_agi.agents.base import AgentInput
from vctt_agi.modules.sim import SituationalInterpretationModule
from vctt_agi.modules.cam import ContradictionAnalysisModule
from vctt_agi.modules.sre import SelfRegulationEngine
from vctt_agi.modules.ctm import ContextualTrustModule
from vctt_agi.modules.ril import RelationalInferenceLayer

logger = logging.getLogger(__name__)


class VCTTOrchestrator:
    """
    Orchestrator coordinates the full VCTT-AGI pipeline:
    Input → Analyst → VCTT Modules → Relational → Synthesiser → Output
    """
    
    def __init__(
        self,
        openai_api_key: str,
        anthropic_api_key: Optional[str] = None,
        model: str = "gpt-4"
    ):
        """
        Initialize orchestrator with agents and modules
        
        Args:
            openai_api_key: OpenAI API key
            anthropic_api_key: Optional Anthropic API key
            model: LLM model to use
        """
        # Initialize agents
        self.analyst = AnalystAgent(api_key=openai_api_key, model=model)
        self.relational = RelationalAgent(api_key=openai_api_key, model=model)
        self.synthesiser = SynthesiserAgent(api_key=openai_api_key, model=model)
        
        # Initialize modules
        self.sim = SituationalInterpretationModule()
        self.cam = ContradictionAnalysisModule()
        self.sre = SelfRegulationEngine()
        self.ctm = ContextualTrustModule()
        self.ril = RelationalInferenceLayer()
        
        self.model = model
        self.internal_state = self._init_internal_state()
        
        logger.info("VCTT Orchestrator initialized")
    
    def _init_internal_state(self) -> Dict[str, Any]:
        """Initialize internal state"""
        return {
            "sim": {
                "tension": 0.0,
                "uncertainty": 0.0,
                "emotional_intensity": 0.0
            },
            "contradiction": 0.0,
            "regulation": {
                "mode": "normal"
            },
            "trust": 0.5
        }
    
    async def process(
        self,
        text: str,
        user_id: Optional[str] = None,
        session_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Process input through the full VCTT pipeline
        
        Args:
            text: Input text to analyze
            user_id: Optional user identifier
            session_id: Optional session identifier
            
        Returns:
            Complete analysis results with internal state
        """
        start_time = time.time()
        logger.info(f"Starting VCTT pipeline for session {session_id}")
        
        try:
            # Stage 1: Analyst Agent
            logger.info("Stage 1: Running Analyst Agent")
            analyst_input = AgentInput(
                text=text,
                session_id=session_id,
                context={"user_id": user_id}
            )
            analyst_output = await self.analyst.process(analyst_input)
            
            # Stage 2: VCTT Modules
            logger.info("Stage 2: Executing VCTT Modules")
            
            # SIM - Situational Interpretation
            sim_metrics = self.sim.analyze(text, analyst_output.to_dict())
            self.internal_state["sim"] = sim_metrics
            
            # CAM - Contradiction Analysis
            cam_result = self.cam.analyze(text, analyst_output.to_dict())
            self.internal_state["contradiction"] = cam_result["contradiction_score"]
            
            # CTM - Calculate Trust (needs SIM and CAM results)
            ctm_result = self.ctm.calculate_trust(
                analyst_output=analyst_output.to_dict(),
                sim_metrics=sim_metrics,
                contradiction_score=cam_result["contradiction_score"]
            )
            self.internal_state["trust"] = ctm_result["trust_score"]
            
            # SRE - Self Regulation (needs all module metrics)
            sre_result = self.sre.regulate(
                sim_metrics=sim_metrics,
                contradiction_score=cam_result["contradiction_score"],
                trust_score=ctm_result["trust_score"]
            )
            self.internal_state["regulation"] = {"mode": sre_result["mode"]}
            
            # Stage 3: Relational Agent
            logger.info("Stage 3: Running Relational Agent")
            relational_input = AgentInput(
                text=text,
                session_id=session_id,
                context={
                    "user_id": user_id,
                    "analyst_output": analyst_output.to_dict()
                }
            )
            relational_output = await self.relational.process(relational_input)
            
            # RIL - Relational Inference
            relational_result = relational_output.to_dict()["result"]
            ril_result = self.ril.infer(
                concepts=relational_result.get("concepts", []),
                relationships=relational_result.get("relationships", []),
                context={"analyst": analyst_output.to_dict()}
            )
            
            # Stage 4: Synthesiser Agent
            logger.info("Stage 4: Running Synthesiser Agent")
            synthesiser_input = AgentInput(
                text=text,
                session_id=session_id,
                context={
                    "user_id": user_id,
                    "analyst_output": analyst_output.to_dict(),
                    "relational_output": relational_output.to_dict(),
                    "module_state": self.internal_state
                }
            )
            synthesiser_output = await self.synthesiser.process(synthesiser_input)
            
            # Calculate processing time
            processing_time = int((time.time() - start_time) * 1000)
            
            # Build final result
            result = {
                "status": "success",
                "data": {
                    "session_id": session_id,
                    "analysis": {
                        "analyst_output": analyst_output.to_dict(),
                        "relational_output": relational_output.to_dict(),
                        "synthesis": synthesiser_output.to_dict()
                    },
                    "internal_state": self.internal_state.copy(),
                    "module_details": {
                        "sim": sim_metrics,
                        "cam": cam_result,
                        "sre": sre_result,
                        "ctm": ctm_result,
                        "ril": ril_result
                    },
                    "metadata": {
                        "processing_time_ms": processing_time,
                        "agents_used": ["analyst", "relational", "synthesiser"],
                        "modules_executed": ["sim", "cam", "sre", "ctm", "ril"],
                        "model": self.model,
                        "timestamp": datetime.utcnow().isoformat()
                    }
                }
            }
            
            logger.info(f"VCTT pipeline completed in {processing_time}ms")
            return result
            
        except Exception as e:
            logger.error(f"Pipeline error: {e}", exc_info=True)
            return {
                "status": "error",
                "error": {
                    "message": str(e),
                    "type": type(e).__name__
                }
            }
    
    def get_internal_state(self) -> Dict[str, Any]:
        """Get current internal state"""
        return self.internal_state.copy()
    
    def reset_state(self):
        """Reset internal state to initial values"""
        self.internal_state = self._init_internal_state()
        logger.info("Internal state reset")
