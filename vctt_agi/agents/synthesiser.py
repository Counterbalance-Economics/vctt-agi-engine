
"""Synthesiser Agent - Synthesizes information from multiple sources and generates insights"""
from typing import Dict, Any, List
import openai

from vctt_agi.agents.base import BaseAgent, AgentInput, AgentOutput


class SynthesiserAgent(BaseAgent):
    """
    Synthesiser Agent synthesizes information from multiple sources,
    generates insights, creates coherent narratives, and resolves contradictions.
    """
    
    def __init__(self, api_key: str, model: str = "gpt-4"):
        super().__init__(api_key, model)
        openai.api_key = api_key
    
    async def process(self, input_data: AgentInput) -> AgentOutput:
        """
        Process input and synthesize information
        
        Args:
            input_data: Input containing text and outputs from previous agents
            
        Returns:
            Synthesis results with insights and narratives
        """
        await self.log_action("process_start", {})
        
        # Get previous agent outputs from context
        context = input_data.context or {}
        analyst_output = context.get("analyst_output", {})
        relational_output = context.get("relational_output", {})
        module_state = context.get("module_state", {})
        
        # Synthesize multi-source information
        synthesis = await self._synthesize_information(
            input_data.text, analyst_output, relational_output
        )
        
        # Generate insights
        insights = await self._generate_insights(
            input_data.text, analyst_output, relational_output, module_state
        )
        
        # Create coherent narrative
        narrative = await self._create_narrative(
            input_data.text, synthesis, insights
        )
        
        # Resolve contradictions
        contradictions = await self._resolve_contradictions(
            analyst_output, relational_output, module_state
        )
        
        result = {
            "synthesis": synthesis,
            "insights": insights,
            "narrative": narrative,
            "contradiction_resolution": contradictions,
            "summary": self._create_summary(synthesis, insights),
            "recommendations": self._generate_recommendations(insights, module_state)
        }
        
        confidence = self._calculate_confidence(result, module_state)
        
        await self.log_action("process_complete", {"insight_count": len(insights)})
        
        return self._create_output(
            agent_type="synthesiser",
            result=result,
            confidence=confidence,
            metadata={
                "model": self.model,
                "insight_count": len(insights),
                "has_narrative": bool(narrative)
            }
        )
    
    async def _synthesize_information(
        self,
        text: str,
        analyst_output: Dict[str, Any],
        relational_output: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Synthesize information from multiple sources"""
        try:
            # Prepare synthesis prompt
            prompt = f"""Synthesize the following information:

Original Text: {text[:500]}...

Analyst Findings:
- Argument Type: {analyst_output.get('result', {}).get('structure', {}).get('type', 'unknown')}
- Strength: {analyst_output.get('result', {}).get('strength', {}).get('rating', 'unknown')}
- Fallacies: {len(analyst_output.get('result', {}).get('fallacies', []))}

Relational Findings:
- Concepts: {relational_output.get('result', {}).get('graph_metrics', {}).get('node_count', 0)}
- Relationships: {relational_output.get('result', {}).get('graph_metrics', {}).get('edge_count', 0)}

Provide a comprehensive synthesis."""
            
            response = openai.ChatCompletion.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert synthesizer. Create a comprehensive synthesis of the provided information."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                temperature=0.5,
                max_tokens=600
            )
            
            synthesis_text = response.choices[0].message.content
            
            return {
                "text": synthesis_text,
                "sources": ["analyst", "relational", "original_text"],
                "key_points": self._extract_key_points(synthesis_text)
            }
        except Exception as e:
            self.logger.error(f"Information synthesis failed: {e}")
            return {
                "text": "Synthesis unavailable due to processing error.",
                "sources": [],
                "key_points": []
            }
    
    async def _generate_insights(
        self,
        text: str,
        analyst_output: Dict[str, Any],
        relational_output: Dict[str, Any],
        module_state: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Generate insights from analysis"""
        insights = []
        
        # Insight from argument strength
        analyst_result = analyst_output.get("result", {})
        strength = analyst_result.get("strength", {})
        if strength:
            insights.append({
                "type": "argument_quality",
                "insight": f"The argument is {strength.get('rating', 'moderate')} with a strength score of {strength.get('score', 0.5):.2f}",
                "confidence": 0.8
            })
        
        # Insight from relationships
        relational_result = relational_output.get("result", {})
        if relational_result.get("concepts"):
            concept_count = len(relational_result["concepts"])
            insights.append({
                "type": "conceptual_complexity",
                "insight": f"The text involves {concept_count} key concepts with interconnected relationships",
                "confidence": 0.75
            })
        
        # Insight from VCTT modules
        if module_state:
            sim = module_state.get("sim", {})
            if sim.get("tension", 0) > 0.6:
                insights.append({
                    "type": "tension_detection",
                    "insight": "High tension detected in the situational interpretation",
                    "confidence": 0.85
                })
        
        return insights
    
    async def _create_narrative(
        self,
        text: str,
        synthesis: Dict[str, Any],
        insights: List[Dict[str, Any]]
    ) -> str:
        """Create coherent narrative from synthesis and insights"""
        try:
            insights_text = "\n".join([f"- {i['insight']}" for i in insights])
            
            response = openai.ChatCompletion.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": "Create a coherent narrative that explains the analysis results in clear, accessible language."
                    },
                    {
                        "role": "user",
                        "content": f"Create a narrative based on:\n\nSynthesis: {synthesis.get('text', '')}\n\nKey Insights:\n{insights_text}"
                    }
                ],
                temperature=0.6,
                max_tokens=400
            )
            
            return response.choices[0].message.content
        except Exception as e:
            self.logger.error(f"Narrative creation failed: {e}")
            return "Narrative generation unavailable."
    
    async def _resolve_contradictions(
        self,
        analyst_output: Dict[str, Any],
        relational_output: Dict[str, Any],
        module_state: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Resolve contradictions in analysis"""
        contradictions = []
        
        # Check for contradiction score in module state
        contradiction_score = module_state.get("contradiction", 0)
        
        if contradiction_score > 0.5:
            contradictions.append({
                "type": "logical_contradiction",
                "description": "Contradictions detected in argument structure",
                "severity": contradiction_score,
                "resolution": "Further clarification needed to resolve logical inconsistencies"
            })
        
        return contradictions
    
    def _extract_key_points(self, text: str) -> List[str]:
        """Extract key points from synthesized text"""
        # Simple extraction by splitting on common patterns
        sentences = text.split('. ')
        return [s.strip() + '.' for s in sentences if len(s.strip()) > 20][:5]
    
    def _create_summary(self, synthesis: Dict[str, Any], insights: List[Dict[str, Any]]) -> str:
        """Create a brief summary"""
        insight_count = len(insights)
        return f"Analysis complete with {insight_count} key insights. {synthesis.get('text', '')[:150]}..."
    
    def _generate_recommendations(
        self, insights: List[Dict[str, Any]], module_state: Dict[str, Any]
    ) -> List[str]:
        """Generate recommendations based on insights and module state"""
        recommendations = []
        
        # Recommendation based on regulation mode
        regulation = module_state.get("regulation", {})
        if regulation.get("mode") == "clarify":
            recommendations.append("Consider providing additional clarification to reduce uncertainty")
        elif regulation.get("mode") == "slow_down":
            recommendations.append("Take time to process complex information carefully")
        
        # Recommendation based on trust level
        trust = module_state.get("trust", 0.5)
        if trust < 0.5:
            recommendations.append("Build trust through transparent reasoning and evidence")
        
        return recommendations
    
    def _calculate_confidence(
        self, result: Dict[str, Any], module_state: Dict[str, Any]
    ) -> float:
        """Calculate confidence in synthesis"""
        confidence = 0.7  # Base confidence
        
        if result["insights"]:
            confidence += 0.1
        
        if result["narrative"]:
            confidence += 0.1
        
        # Adjust based on trust from modules
        trust = module_state.get("trust", 0.5)
        confidence = (confidence + trust) / 2
        
        return min(1.0, confidence)
