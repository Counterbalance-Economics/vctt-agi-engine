
"""Tests for Self-Regulation Engine"""
import pytest
from vctt_agi.modules.sre import SelfRegulationEngine


def test_sre_initialization():
    """Test SRE initialization"""
    sre = SelfRegulationEngine()
    
    assert sre.get_mode() == "normal"


def test_sre_normal_mode():
    """Test SRE stays in normal mode for stable conditions"""
    sre = SelfRegulationEngine()
    
    sim_metrics = {"tension": 0.2, "uncertainty": 0.3, "emotional_intensity": 0.4}
    result = sre.regulate(sim_metrics, contradiction_score=0.2, trust_score=0.7)
    
    assert result["mode"] == "normal"


def test_sre_clarify_mode():
    """Test SRE switches to clarify mode"""
    sre = SelfRegulationEngine()
    
    # Moderate uncertainty should trigger clarify
    sim_metrics = {"tension": 0.6, "uncertainty": 0.55, "emotional_intensity": 0.4}
    result = sre.regulate(sim_metrics, contradiction_score=0.45, trust_score=0.45)
    
    assert result["mode"] == "clarify"
    assert result["mode_changed"] == True


def test_sre_slow_down_mode():
    """Test SRE switches to slow_down mode"""
    sre = SelfRegulationEngine()
    
    # High complexity should trigger slow_down
    sim_metrics = {"tension": 0.7, "uncertainty": 0.75, "emotional_intensity": 0.85}
    result = sre.regulate(sim_metrics, contradiction_score=0.65, trust_score=0.25)
    
    assert result["mode"] == "slow_down"


def test_sre_mode_history():
    """Test SRE tracks mode changes"""
    sre = SelfRegulationEngine()
    
    # First regulation - normal
    sim_metrics1 = {"tension": 0.2, "uncertainty": 0.3, "emotional_intensity": 0.3}
    sre.regulate(sim_metrics1, contradiction_score=0.2, trust_score=0.7)
    
    # Second regulation - clarify
    sim_metrics2 = {"tension": 0.6, "uncertainty": 0.6, "emotional_intensity": 0.5}
    sre.regulate(sim_metrics2, contradiction_score=0.5, trust_score=0.4)
    
    history = sre.get_history()
    assert len(history) == 1  # One mode change
    assert history[0]["from"] == "normal"
    assert history[0]["to"] == "clarify"
