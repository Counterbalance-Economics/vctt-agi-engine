
"""Analyst Agent - Analyzes argument structure and logical patterns"""
from typing import Dict, Any, List
import re
import openai

from vctt_agi.agents.base import BaseAgent, AgentInput, AgentOutput


class AnalystAgent(BaseAgent):
    """
    Analyst Agent analyzes argument structure, detects logical fallacies,
    extracts premises and conclusions, and assesses argument strength.
    """
    
    def __init__(self, api_key: str, model: str = "gpt-4"):
        super().__init__(api_key, model)
        openai.api_key = api_key
    
    async def process(self, input_data: AgentInput) -> AgentOutput:
        """
        Process input text and analyze argument structure
        
        Args:
            input_data: Input containing text to analyze
            
        Returns:
            Analysis results with argument structure, fallacies, etc.
        """
        await self.log_action("process_start", {"text_length": len(input_data.text)})
        
        # Analyze argument structure
        structure = await self._analyze_structure(input_data.text)
        
        # Detect logical fallacies
        fallacies = await self._detect_fallacies(input_data.text)
        
        # Extract premises and conclusions
        premises_conclusions = await self._extract_premises_conclusions(input_data.text)
        
        # Assess argument strength
        strength = await self._assess_strength(input_data.text, structure, fallacies)
        
        result = {
            "structure": structure,
            "fallacies": fallacies,
            "premises": premises_conclusions["premises"],
            "conclusions": premises_conclusions["conclusions"],
            "strength": strength,
            "text_analysis": {
                "word_count": len(input_data.text.split()),
                "sentence_count": len(re.split(r'[.!?]+', input_data.text))
            }
        }
        
        # Calculate confidence based on text quality and completeness
        confidence = self._calculate_confidence(result)
        
        await self.log_action("process_complete", {"confidence": confidence})
        
        return self._create_output(
            agent_type="analyst",
            result=result,
            confidence=confidence,
            metadata={
                "model": self.model,
                "fallacies_detected": len(fallacies)
            }
        )
    
    async def _analyze_structure(self, text: str) -> Dict[str, Any]:
        """Analyze argument structure using LLM"""
        try:
            response = openai.ChatCompletion.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert in argument analysis. Analyze the logical structure of the given text."
                    },
                    {
                        "role": "user",
                        "content": f"Analyze the argument structure of this text:\n\n{text}\n\nProvide: type (deductive/inductive/abductive), validity, and soundness."
                    }
                ],
                temperature=0.3,
                max_tokens=500
            )
            
            content = response.choices[0].message.content
            
            # Parse structure from response
            return {
                "type": self._extract_argument_type(content),
                "validity": "valid" if "valid" in content.lower() else "uncertain",
                "soundness": "sound" if "sound" in content.lower() else "uncertain",
                "raw_analysis": content
            }
        except Exception as e:
            self.logger.error(f"Structure analysis failed: {e}")
            return {
                "type": "unknown",
                "validity": "uncertain",
                "soundness": "uncertain",
                "error": str(e)
            }
    
    async def _detect_fallacies(self, text: str) -> List[Dict[str, str]]:
        """Detect logical fallacies"""
        try:
            response = openai.ChatCompletion.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert in logical fallacies. Identify any fallacies in the given text."
                    },
                    {
                        "role": "user",
                        "content": f"Identify logical fallacies in this text:\n\n{text}"
                    }
                ],
                temperature=0.3,
                max_tokens=400
            )
            
            content = response.choices[0].message.content
            
            # Parse fallacies (simplified extraction)
            fallacies = []
            common_fallacies = [
                "ad hominem", "strawman", "false dilemma", "slippery slope",
                "circular reasoning", "hasty generalization", "appeal to authority"
            ]
            
            for fallacy in common_fallacies:
                if fallacy in content.lower():
                    fallacies.append({
                        "type": fallacy,
                        "description": f"Detected {fallacy} in text"
                    })
            
            return fallacies
        except Exception as e:
            self.logger.error(f"Fallacy detection failed: {e}")
            return []
    
    async def _extract_premises_conclusions(self, text: str) -> Dict[str, List[str]]:
        """Extract premises and conclusions"""
        try:
            response = openai.ChatCompletion.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": "Extract the premises and conclusions from the argument."
                    },
                    {
                        "role": "user",
                        "content": f"Extract premises and conclusions from:\n\n{text}"
                    }
                ],
                temperature=0.3,
                max_tokens=400
            )
            
            content = response.choices[0].message.content
            
            # Simple extraction (can be improved with better parsing)
            premises = [s.strip() for s in content.split('\n') if 'premise' in s.lower()]
            conclusions = [s.strip() for s in content.split('\n') if 'conclusion' in s.lower()]
            
            return {
                "premises": premises[:5],  # Limit to 5
                "conclusions": conclusions[:3]  # Limit to 3
            }
        except Exception as e:
            self.logger.error(f"Premise/conclusion extraction failed: {e}")
            return {"premises": [], "conclusions": []}
    
    async def _assess_strength(self, text: str, structure: Dict, fallacies: List) -> Dict[str, Any]:
        """Assess argument strength"""
        # Calculate strength score based on multiple factors
        score = 0.5  # Base score
        
        # Adjust for structure validity
        if structure.get("validity") == "valid":
            score += 0.2
        
        # Penalize for fallacies
        score -= len(fallacies) * 0.1
        
        # Ensure score is in range [0, 1]
        score = max(0.0, min(1.0, score))
        
        return {
            "score": score,
            "rating": "strong" if score > 0.7 else "moderate" if score > 0.4 else "weak",
            "factors": {
                "structure_valid": structure.get("validity") == "valid",
                "fallacy_count": len(fallacies)
            }
        }
    
    def _extract_argument_type(self, text: str) -> str:
        """Extract argument type from analysis text"""
        text_lower = text.lower()
        if "deductive" in text_lower:
            return "deductive"
        elif "inductive" in text_lower:
            return "inductive"
        elif "abductive" in text_lower:
            return "abductive"
        return "unknown"
    
    def _calculate_confidence(self, result: Dict[str, Any]) -> float:
        """Calculate confidence score based on analysis completeness"""
        confidence = 0.7  # Base confidence
        
        # Increase if we have good structure analysis
        if result["structure"]["type"] != "unknown":
            confidence += 0.1
        
        # Increase if we found premises/conclusions
        if result["premises"] or result["conclusions"]:
            confidence += 0.1
        
        # Decrease if errors present
        if "error" in result["structure"]:
            confidence -= 0.2
        
        return max(0.0, min(1.0, confidence))
