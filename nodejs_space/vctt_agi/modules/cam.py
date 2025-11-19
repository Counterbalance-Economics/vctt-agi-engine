
"""Contradiction Analysis Module (CAM) - Detect contradictions and calculate contradiction scores"""
from typing import Dict, Any, List
import logging

logger = logging.getLogger(__name__)


class ContradictionAnalysisModule:
    """
    CAM detects contradictions in text and analysis results.
    Calculates contradiction score (0.0-1.0) indicating level of internal inconsistency.
    """
    
    def __init__(self):
        self.contradiction_score = 0.0
        self.detected_contradictions = []
    
    def analyze(
        self,
        text: str,
        analyst_output: Dict[str, Any] = None,
        relational_output: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """
        Analyze for contradictions
        
        Args:
            text: Input text to analyze
            analyst_output: Optional output from Analyst agent
            relational_output: Optional output from Relational agent
            
        Returns:
            Dictionary with contradiction score and detected contradictions
        """
        logger.info("CAM: Analyzing contradictions")
        
        self.detected_contradictions = []
        
        # Detect direct contradictions in text
        text_contradictions = self._detect_text_contradictions(text)
        self.detected_contradictions.extend(text_contradictions)
        
        # Detect logical contradictions from analyst
        if analyst_output:
            logical_contradictions = self._detect_logical_contradictions(analyst_output)
            self.detected_contradictions.extend(logical_contradictions)
        
        # Detect relational contradictions
        if relational_output:
            relational_contradictions = self._detect_relational_contradictions(relational_output)
            self.detected_contradictions.extend(relational_contradictions)
        
        # Calculate overall contradiction score
        self.contradiction_score = self._calculate_score()
        
        result = {
            "contradiction_score": self.contradiction_score,
            "contradictions": self.detected_contradictions
        }
        
        logger.info(f"CAM: Found {len(self.detected_contradictions)} contradictions, score: {self.contradiction_score:.2f}")
        return result
    
    def _detect_text_contradictions(self, text: str) -> List[Dict[str, Any]]:
        """Detect direct contradictions in text"""
        contradictions = []
        text_lower = text.lower()
        
        # Check for explicit contradiction patterns
        patterns = [
            ("not", "but"),
            ("never", "always"),
            ("none", "all"),
            ("impossible", "possible")
        ]
        
        for neg, pos in patterns:
            if neg in text_lower and pos in text_lower:
                contradictions.append({
                    "type": "textual",
                    "description": f"Potential contradiction: text contains both '{neg}' and '{pos}'",
                    "severity": 0.5
                })
        
        # Check for "but" patterns indicating contradiction
        but_count = text_lower.count(" but ")
        if but_count > 2:
            contradictions.append({
                "type": "textual",
                "description": f"Multiple contrasting statements detected ({but_count} instances)",
                "severity": min(but_count * 0.15, 0.8)
            })
        
        return contradictions
    
    def _detect_logical_contradictions(self, analyst_output: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Detect logical contradictions from analyst results"""
        contradictions = []
        
        result = analyst_output.get("result", {})
        
        # Check for invalid or unsound arguments
        structure = result.get("structure", {})
        if structure.get("validity") == "invalid":
            contradictions.append({
                "type": "logical",
                "description": "Invalid argument structure detected",
                "severity": 0.7
            })
        
        if structure.get("soundness") == "unsound":
            contradictions.append({
                "type": "logical",
                "description": "Unsound argument detected",
                "severity": 0.6
            })
        
        # Check for specific fallacies that indicate contradiction
        fallacies = result.get("fallacies", [])
        contradiction_fallacies = ["circular reasoning", "contradiction", "inconsistent"]
        for fallacy in fallacies:
            if any(cf in fallacy.get("type", "").lower() for cf in contradiction_fallacies):
                contradictions.append({
                    "type": "logical_fallacy",
                    "description": f"Contradiction-related fallacy: {fallacy.get('type')}",
                    "severity": 0.65
                })
        
        return contradictions
    
    def _detect_relational_contradictions(self, relational_output: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Detect contradictions in concept relationships"""
        contradictions = []
        
        result = relational_output.get("result", {})
        relationships = result.get("relationships", [])
        
        # Check for conflicting relationship types between same concepts
        concept_pairs = {}
        for rel in relationships:
            pair = (rel.get("source"), rel.get("target"))
            if pair in concept_pairs:
                # Same concept pair appears multiple times
                if concept_pairs[pair] != rel.get("type"):
                    contradictions.append({
                        "type": "relational",
                        "description": f"Conflicting relationship types for concepts {pair[0]} and {pair[1]}",
                        "severity": 0.5
                    })
            concept_pairs[pair] = rel.get("type")
        
        return contradictions
    
    def _calculate_score(self) -> float:
        """Calculate overall contradiction score"""
        if not self.detected_contradictions:
            return 0.0
        
        # Weighted average of contradiction severities
        total_severity = sum(c.get("severity", 0.5) for c in self.detected_contradictions)
        count = len(self.detected_contradictions)
        
        # Average severity, with bonus for multiple contradictions
        base_score = total_severity / count if count > 0 else 0.0
        multiplier = min(1.0 + (count - 1) * 0.1, 1.5)  # Up to 50% bonus
        
        return min(base_score * multiplier, 1.0)
    
    def get_score(self) -> float:
        """Get current contradiction score"""
        return self.contradiction_score
    
    def get_contradictions(self) -> List[Dict[str, Any]]:
        """Get detected contradictions"""
        return self.detected_contradictions.copy()
