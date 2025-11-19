
"""Tests for Contextual Trust Module"""
import pytest
from vctt_agi.modules.ctm import ContextualTrustModule


def test_ctm_initialization():
    """Test CTM initialization"""
    ctm = ContextualTrustModule()
    
    assert ctm.get_trust_score() == 0.5  # Neutral trust


def test_ctm_calculate_trust():
    """Test trust calculation"""
    ctm = ContextualTrustModule()
    
    analyst_output = {
        "confidence": 0.8,
        "result": {
            "strength": {"score": 0.7},
            "fallacies": [],
            "structure": {"validity": "valid"}
        }
    }
    
    result = ctm.calculate_trust(analyst_output=analyst_output)
    
    assert "trust_score" in result
    assert 0.0 <= result["trust_score"] <= 1.0
    assert "factors" in result


def test_ctm_trust_with_contradictions():
    """Test trust decreases with contradictions"""
    ctm = ContextualTrustModule()
    
    analyst_output = {
        "confidence": 0.8,
        "result": {"strength": {"score": 0.7}, "fallacies": []}
    }
    
    # High contradiction should lower trust
    result = ctm.calculate_trust(
        analyst_output=analyst_output,
        contradiction_score=0.8
    )
    
    assert result["trust_score"] < 0.6


def test_ctm_trust_evolution():
    """Test trust evolution tracking"""
    ctm = ContextualTrustModule()
    
    # Calculate trust multiple times
    for i in range(3):
        ctm.calculate_trust(contradiction_score=0.2)
    
    history = ctm.get_history()
    assert len(history) == 3
