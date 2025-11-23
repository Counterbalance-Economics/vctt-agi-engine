
"""Situational Interpretation Module (SIM) - Track tension, uncertainty, and emotional intensity"""
from typing import Dict, Any
import logging

logger = logging.getLogger(__name__)


class SituationalInterpretationModule:
    """
    SIM tracks situational metrics:
    - Tension (0.0-1.0): Level of conflict or stress in the situation
    - Uncertainty (0.0-1.0): Degree of ambiguity or unknown factors
    - Emotional Intensity (0.0-1.0): Strength of emotional content
    """
    
    def __init__(self):
        self.metrics = {
            "tension": 0.0,
            "uncertainty": 0.0,
            "emotional_intensity": 0.0
        }
    
    def analyze(self, text: str, analyst_output: Dict[str, Any] = None) -> Dict[str, float]:
        """
        Analyze text and update situational metrics
        
        Args:
            text: Input text to analyze
            analyst_output: Optional output from Analyst agent
            
        Returns:
            Dictionary with tension, uncertainty, and emotional_intensity scores
        """
        logger.info("SIM: Analyzing situational metrics")
        
        # Calculate tension
        self.metrics["tension"] = self._calculate_tension(text, analyst_output)
        
        # Calculate uncertainty
        self.metrics["uncertainty"] = self._calculate_uncertainty(text, analyst_output)
        
        # Calculate emotional intensity
        self.metrics["emotional_intensity"] = self._calculate_emotional_intensity(text)
        
        logger.info(f"SIM metrics: {self.metrics}")
        return self.metrics.copy()
    
    def _calculate_tension(self, text: str, analyst_output: Dict[str, Any]) -> float:
        """Calculate tension score"""
        tension = 0.0
        
        # Check for conflict words
        conflict_words = ["but", "however", "conflict", "disagree", "oppose", "against", "dispute"]
        conflict_count = sum(1 for word in conflict_words if word in text.lower())
        tension += min(conflict_count * 0.1, 0.5)
        
        # Check analyst output for fallacies (indicates tension)
        if analyst_output and analyst_output.get("result"):
            fallacy_count = len(analyst_output["result"].get("fallacies", []))
            tension += min(fallacy_count * 0.15, 0.4)
        
        # Check for exclamation marks
        exclamation_count = text.count("!")
        tension += min(exclamation_count * 0.05, 0.1)
        
        return min(tension, 1.0)
    
    def _calculate_uncertainty(self, text: str, analyst_output: Dict[str, Any]) -> float:
        """Calculate uncertainty score"""
        uncertainty = 0.0
        
        # Check for uncertainty words
        uncertainty_words = [
            "maybe", "perhaps", "possibly", "might", "could", "uncertain",
            "unclear", "ambiguous", "questionable", "doubt"
        ]
        uncertainty_count = sum(1 for word in uncertainty_words if word in text.lower())
        uncertainty += min(uncertainty_count * 0.1, 0.5)
        
        # Check analyst output for weak argument strength
        if analyst_output and analyst_output.get("result"):
            strength = analyst_output["result"].get("strength", {})
            if strength.get("rating") == "weak":
                uncertainty += 0.3
            elif strength.get("rating") == "moderate":
                uncertainty += 0.15
        
        # Check for question marks
        question_count = text.count("?")
        uncertainty += min(question_count * 0.08, 0.2)
        
        return min(uncertainty, 1.0)
    
    def _calculate_emotional_intensity(self, text: str) -> float:
        """Calculate emotional intensity score"""
        intensity = 0.0
        
        # Check for emotional words
        emotional_words = [
            "love", "hate", "fear", "anger", "joy", "sad", "happy",
            "terrible", "wonderful", "awful", "amazing", "horrific", "fantastic"
        ]
        emotional_count = sum(1 for word in emotional_words if word in text.lower())
        intensity += min(emotional_count * 0.15, 0.6)
        
        # Check for capitalization (shouting)
        upper_words = sum(1 for word in text.split() if word.isupper() and len(word) > 1)
        intensity += min(upper_words * 0.1, 0.2)
        
        # Check for multiple punctuation
        multiple_punct = text.count("!!!") + text.count("???")
        intensity += min(multiple_punct * 0.1, 0.2)
        
        return min(intensity, 1.0)
    
    def get_metrics(self) -> Dict[str, float]:
        """Get current metrics"""
        return self.metrics.copy()
