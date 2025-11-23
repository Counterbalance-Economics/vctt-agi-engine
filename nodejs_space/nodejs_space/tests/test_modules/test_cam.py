
"""Tests for Contradiction Analysis Module"""
import pytest
from vctt_agi.modules.cam import ContradictionAnalysisModule


def test_cam_initialization():
    """Test CAM initialization"""
    cam = ContradictionAnalysisModule()
    
    assert cam.get_score() == 0.0
    assert len(cam.get_contradictions()) == 0


def test_cam_text_contradiction_detection():
    """Test detection of textual contradictions"""
    cam = ContradictionAnalysisModule()
    
    # Text with "but" patterns indicating contradiction
    text = "This is true, but it's not true. The system works, but it doesn't work."
    result = cam.analyze(text)
    
    assert result["contradiction_score"] > 0.0
    assert len(result["contradictions"]) > 0


def test_cam_logical_contradiction():
    """Test detection of logical contradictions from analyst"""
    cam = ContradictionAnalysisModule()
    
    analyst_output = {
        "result": {
            "structure": {"validity": "invalid"},
            "fallacies": [{"type": "circular reasoning"}]
        }
    }
    
    result = cam.analyze("Some text", analyst_output=analyst_output)
    
    assert result["contradiction_score"] > 0.0
    assert any(c["type"] == "logical" for c in result["contradictions"])


def test_cam_no_contradictions():
    """Test CAM with non-contradictory text"""
    cam = ContradictionAnalysisModule()
    
    text = "The system is efficient and reliable."
    result = cam.analyze(text)
    
    assert result["contradiction_score"] < 0.3
