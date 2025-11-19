
"""Tests for Situational Interpretation Module"""
import pytest
from vctt_agi.modules.sim import SituationalInterpretationModule


def test_sim_initialization():
    """Test SIM initialization"""
    sim = SituationalInterpretationModule()
    metrics = sim.get_metrics()
    
    assert metrics["tension"] == 0.0
    assert metrics["uncertainty"] == 0.0
    assert metrics["emotional_intensity"] == 0.0


def test_sim_tension_detection():
    """Test tension detection"""
    sim = SituationalInterpretationModule()
    
    # Text with conflict words
    text = "I disagree with this argument. However, there is conflict in the reasoning."
    metrics = sim.analyze(text)
    
    assert metrics["tension"] > 0.0
    assert 0.0 <= metrics["tension"] <= 1.0


def test_sim_uncertainty_detection():
    """Test uncertainty detection"""
    sim = SituationalInterpretationModule()
    
    # Text with uncertainty words
    text = "Maybe this is true? Perhaps we should consider that it might be uncertain."
    metrics = sim.analyze(text)
    
    assert metrics["uncertainty"] > 0.0
    assert 0.0 <= metrics["uncertainty"] <= 1.0


def test_sim_emotional_intensity():
    """Test emotional intensity detection"""
    sim = SituationalInterpretationModule()
    
    # Text with emotional words
    text = "I love this amazing idea! It's wonderful and fantastic!"
    metrics = sim.analyze(text)
    
    assert metrics["emotional_intensity"] > 0.0
    assert 0.0 <= metrics["emotional_intensity"] <= 1.0


def test_sim_neutral_text():
    """Test SIM with neutral text"""
    sim = SituationalInterpretationModule()
    
    text = "The system processes data efficiently."
    metrics = sim.analyze(text)
    
    # Should have low metrics for neutral text
    assert metrics["tension"] < 0.5
    assert metrics["uncertainty"] < 0.5
    assert metrics["emotional_intensity"] < 0.5
