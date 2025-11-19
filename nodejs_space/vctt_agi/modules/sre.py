
"""Self-Regulation Engine (SRE) - Manage regulation modes and trigger mode switches"""
from typing import Dict, Any, List, Literal
import logging

logger = logging.getLogger(__name__)

RegulationMode = Literal["normal", "clarify", "slow_down"]


class SelfRegulationEngine:
    """
    SRE manages regulation modes and triggers mode switches based on metrics.
    Modes: normal, clarify, slow_down
    """
    
    def __init__(self):
        self.mode: RegulationMode = "normal"
        self.mode_history = []
    
    def regulate(
        self,
        sim_metrics: Dict[str, float],
        contradiction_score: float,
        trust_score: float
    ) -> Dict[str, Any]:
        """
        Determine regulation mode based on metrics
        
        Args:
            sim_metrics: SIM metrics (tension, uncertainty, emotional_intensity)
            contradiction_score: Contradiction score from CAM
            trust_score: Trust score from CTM
            
        Returns:
            Dictionary with mode and mode change rationale
        """
        logger.info("SRE: Regulating based on metrics")
        
        previous_mode = self.mode
        
        # Determine new mode based on thresholds
        self.mode = self._determine_mode(sim_metrics, contradiction_score, trust_score)
        
        # Track mode change
        if self.mode != previous_mode:
            self.mode_history.append({
                "from": previous_mode,
                "to": self.mode,
                "reason": self._get_mode_change_reason(sim_metrics, contradiction_score, trust_score)
            })
            logger.info(f"SRE: Mode changed from {previous_mode} to {self.mode}")
        
        return {
            "mode": self.mode,
            "previous_mode": previous_mode,
            "mode_changed": self.mode != previous_mode,
            "rationale": self._get_mode_rationale(sim_metrics, contradiction_score, trust_score)
        }
    
    def _determine_mode(
        self,
        sim_metrics: Dict[str, float],
        contradiction_score: float,
        trust_score: float
    ) -> RegulationMode:
        """Determine appropriate regulation mode"""
        uncertainty = sim_metrics.get("uncertainty", 0.0)
        tension = sim_metrics.get("tension", 0.0)
        emotional_intensity = sim_metrics.get("emotional_intensity", 0.0)
        
        # Slow down if complexity is high
        if (uncertainty > 0.7 or contradiction_score > 0.6 or 
            emotional_intensity > 0.8 or trust_score < 0.3):
            return "slow_down"
        
        # Clarify if moderate uncertainty or contradictions
        if (uncertainty > 0.5 or contradiction_score > 0.4 or 
            trust_score < 0.5 or tension > 0.6):
            return "clarify"
        
        # Normal mode for stable conditions
        return "normal"
    
    def _get_mode_change_reason(
        self,
        sim_metrics: Dict[str, float],
        contradiction_score: float,
        trust_score: float
    ) -> str:
        """Get reason for mode change"""
        reasons = []
        
        if sim_metrics.get("uncertainty", 0) > 0.6:
            reasons.append("high uncertainty")
        if contradiction_score > 0.5:
            reasons.append("contradictions detected")
        if trust_score < 0.4:
            reasons.append("low trust")
        if sim_metrics.get("tension", 0) > 0.7:
            reasons.append("high tension")
        if sim_metrics.get("emotional_intensity", 0) > 0.7:
            reasons.append("high emotional intensity")
        
        return ", ".join(reasons) if reasons else "metrics stabilized"
    
    def _get_mode_rationale(
        self,
        sim_metrics: Dict[str, float],
        contradiction_score: float,
        trust_score: float
    ) -> str:
        """Get rationale for current mode"""
        if self.mode == "slow_down":
            return "Processing complexity requires careful consideration. Taking additional time to analyze."
        elif self.mode == "clarify":
            return "Ambiguity or inconsistencies detected. Seeking clarification to improve understanding."
        else:
            return "Conditions are stable. Proceeding with normal processing."
    
    def get_mode(self) -> RegulationMode:
        """Get current regulation mode"""
        return self.mode
    
    def get_history(self) -> List[Dict[str, Any]]:
        """Get mode change history"""
        return self.mode_history.copy()
