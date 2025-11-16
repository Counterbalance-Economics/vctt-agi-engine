
"""Contextual Trust Module (CTM) - Calculate and track trust metrics"""
from typing import Dict, Any, List
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


class ContextualTrustModule:
    """
    CTM calculates trust metrics (0.0-1.0) and tracks trust evolution.
    Trust is based on consistency, reliability, and alignment with expectations.
    """
    
    def __init__(self):
        self.trust_score = 0.5  # Start with neutral trust
        self.trust_history = []
    
    def calculate_trust(
        self,
        analyst_output: Dict[str, Any] = None,
        relational_output: Dict[str, Any] = None,
        sim_metrics: Dict[str, float] = None,
        contradiction_score: float = 0.0
    ) -> Dict[str, Any]:
        """
        Calculate trust score based on analysis quality and consistency
        
        Args:
            analyst_output: Output from Analyst agent
            relational_output: Output from Relational agent
            sim_metrics: Metrics from SIM
            contradiction_score: Score from CAM
            
        Returns:
            Dictionary with trust score and factors
        """
        logger.info("CTM: Calculating trust score")
        
        factors = {}
        
        # Factor 1: Argument strength and validity
        if analyst_output:
            analyst_trust = self._calculate_analyst_trust(analyst_output)
            factors["analyst"] = analyst_trust
        
        # Factor 2: Relationship coherence
        if relational_output:
            relational_trust = self._calculate_relational_trust(relational_output)
            factors["relational"] = relational_trust
        
        # Factor 3: Situational stability
        if sim_metrics:
            situational_trust = self._calculate_situational_trust(sim_metrics)
            factors["situational"] = situational_trust
        
        # Factor 4: Contradiction penalty
        contradiction_penalty = contradiction_score * 0.5
        factors["contradiction_penalty"] = -contradiction_penalty
        
        # Calculate weighted average
        weights = {"analyst": 0.35, "relational": 0.25, "situational": 0.25}
        weighted_sum = sum(factors.get(k, 0.5) * v for k, v in weights.items())
        
        # Apply contradiction penalty
        self.trust_score = max(0.0, min(1.0, weighted_sum - contradiction_penalty))
        
        # Track evolution
        self.trust_history.append({
            "score": self.trust_score,
            "timestamp": datetime.utcnow().isoformat(),
            "factors": factors.copy()
        })
        
        logger.info(f"CTM: Trust score calculated: {self.trust_score:.2f}")
        
        return {
            "trust_score": self.trust_score,
            "factors": factors,
            "trend": self._calculate_trend()
        }
    
    def _calculate_analyst_trust(self, analyst_output: Dict[str, Any]) -> float:
        """Calculate trust based on analyst output quality"""
        result = analyst_output.get("result", {})
        
        # Start with confidence score
        trust = analyst_output.get("confidence", 0.5)
        
        # Adjust for argument strength
        strength = result.get("strength", {})
        strength_score = strength.get("score", 0.5)
        trust = (trust + strength_score) / 2
        
        # Penalize for fallacies
        fallacy_count = len(result.get("fallacies", []))
        trust -= min(fallacy_count * 0.1, 0.3)
        
        # Bonus for valid structure
        structure = result.get("structure", {})
        if structure.get("validity") == "valid":
            trust += 0.1
        
        return max(0.0, min(1.0, trust))
    
    def _calculate_relational_trust(self, relational_output: Dict[str, Any]) -> float:
        """Calculate trust based on relational output quality"""
        result = relational_output.get("result", {})
        
        # Start with confidence score
        trust = relational_output.get("confidence", 0.5)
        
        # Adjust for graph quality
        graph_metrics = result.get("graph_metrics", {})
        node_count = graph_metrics.get("node_count", 0)
        edge_count = graph_metrics.get("edge_count", 0)
        
        # Bonus for good concept extraction
        if node_count >= 3:
            trust += 0.1
        
        # Bonus for relationships
        if edge_count >= 2:
            trust += 0.1
        
        # Graph density as trust factor
        density = graph_metrics.get("density", 0.0)
        if 0.2 <= density <= 0.7:  # Optimal density range
            trust += 0.1
        
        return max(0.0, min(1.0, trust))
    
    def _calculate_situational_trust(self, sim_metrics: Dict[str, float]) -> float:
        """Calculate trust based on situational metrics"""
        tension = sim_metrics.get("tension", 0.0)
        uncertainty = sim_metrics.get("uncertainty", 0.0)
        emotional_intensity = sim_metrics.get("emotional_intensity", 0.0)
        
        # Start with neutral trust
        trust = 0.6
        
        # Penalize for high tension
        trust -= tension * 0.3
        
        # Penalize for high uncertainty
        trust -= uncertainty * 0.4
        
        # Moderate emotional intensity is okay, extremes reduce trust
        if emotional_intensity > 0.7 or emotional_intensity < 0.1:
            trust -= 0.15
        
        return max(0.0, min(1.0, trust))
    
    def _calculate_trend(self) -> str:
        """Calculate trust trend over recent history"""
        if len(self.trust_history) < 2:
            return "stable"
        
        # Compare last two scores
        recent = self.trust_history[-1]["score"]
        previous = self.trust_history[-2]["score"]
        
        diff = recent - previous
        
        if diff > 0.1:
            return "increasing"
        elif diff < -0.1:
            return "decreasing"
        else:
            return "stable"
    
    def get_trust_score(self) -> float:
        """Get current trust score"""
        return self.trust_score
    
    def get_history(self) -> List[Dict[str, Any]]:
        """Get trust evolution history"""
        return self.trust_history.copy()
