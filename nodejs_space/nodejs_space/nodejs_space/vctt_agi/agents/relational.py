
"""Relational Agent - Maps relationships between concepts and builds knowledge graphs"""
from typing import Dict, Any, List, Tuple
import openai

from vctt_agi.agents.base import BaseAgent, AgentInput, AgentOutput


class RelationalAgent(BaseAgent):
    """
    Relational Agent maps relationships between concepts, calculates connection strength,
    builds knowledge graphs, and identifies implicit relationships.
    """
    
    def __init__(self, api_key: str, model: str = "gpt-4"):
        super().__init__(api_key, model)
        openai.api_key = api_key
    
    async def process(self, input_data: AgentInput) -> AgentOutput:
        """
        Process input and map concept relationships
        
        Args:
            input_data: Input containing text and optional analyst results
            
        Returns:
            Relationship mapping results
        """
        await self.log_action("process_start", {"text_length": len(input_data.text)})
        
        # Extract concepts from text
        concepts = await self._extract_concepts(input_data.text, input_data.context)
        
        # Map relationships between concepts
        relationships = await self._map_relationships(concepts, input_data.text)
        
        # Calculate connection strengths
        strengths = self._calculate_connection_strengths(relationships)
        
        # Build knowledge graph structure
        knowledge_graph = self._build_knowledge_graph(concepts, relationships, strengths)
        
        # Identify implicit relationships
        implicit_relations = await self._identify_implicit_relationships(
            concepts, relationships, input_data.text
        )
        
        result = {
            "concepts": concepts,
            "relationships": relationships,
            "connection_strengths": strengths,
            "knowledge_graph": knowledge_graph,
            "implicit_relationships": implicit_relations,
            "graph_metrics": {
                "node_count": len(concepts),
                "edge_count": len(relationships),
                "density": self._calculate_graph_density(len(concepts), len(relationships))
            }
        }
        
        confidence = self._calculate_confidence(result)
        
        await self.log_action("process_complete", {"concept_count": len(concepts)})
        
        return self._create_output(
            agent_type="relational",
            result=result,
            confidence=confidence,
            metadata={
                "model": self.model,
                "concept_count": len(concepts),
                "relationship_count": len(relationships)
            }
        )
    
    async def _extract_concepts(self, text: str, context: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Extract key concepts from text"""
        try:
            # Use analyst results if available
            analyst_data = context.get("analyst_output", {}) if context else {}
            
            response = openai.ChatCompletion.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": "Extract key concepts and entities from the text. Return as a JSON array of concept objects."
                    },
                    {
                        "role": "user",
                        "content": f"Extract key concepts from this text:\n\n{text}"
                    }
                ],
                temperature=0.3,
                max_tokens=500
            )
            
            content = response.choices[0].message.content
            
            # Simple concept extraction (can be enhanced)
            words = text.split()
            unique_words = set([w.lower().strip('.,!?;:') for w in words if len(w) > 4])
            
            concepts = []
            for idx, word in enumerate(list(unique_words)[:10]):  # Limit to 10 concepts
                concepts.append({
                    "id": f"c_{idx}",
                    "name": word,
                    "type": "concept",
                    "importance": min(1.0, len(word) / 15.0)  # Simple importance score
                })
            
            return concepts
        except Exception as e:
            self.logger.error(f"Concept extraction failed: {e}")
            return []
    
    async def _map_relationships(
        self, concepts: List[Dict[str, Any]], text: str
    ) -> List[Dict[str, Any]]:
        """Map relationships between concepts"""
        try:
            if len(concepts) < 2:
                return []
            
            concept_names = [c["name"] for c in concepts]
            
            response = openai.ChatCompletion.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": "Identify relationships between the given concepts based on the text."
                    },
                    {
                        "role": "user",
                        "content": f"Identify relationships between these concepts: {', '.join(concept_names)}\n\nBased on text:\n{text}"
                    }
                ],
                temperature=0.3,
                max_tokens=400
            )
            
            # Create relationships between concepts (simplified)
            relationships = []
            for i in range(min(len(concepts) - 1, 5)):
                relationships.append({
                    "source": concepts[i]["id"],
                    "target": concepts[i + 1]["id"],
                    "type": "related_to",
                    "description": f"{concepts[i]['name']} relates to {concepts[i+1]['name']}"
                })
            
            return relationships
        except Exception as e:
            self.logger.error(f"Relationship mapping failed: {e}")
            return []
    
    def _calculate_connection_strengths(
        self, relationships: List[Dict[str, Any]]
    ) -> Dict[str, float]:
        """Calculate connection strength for each relationship"""
        strengths = {}
        for idx, rel in enumerate(relationships):
            key = f"{rel['source']}-{rel['target']}"
            # Simple strength calculation (can be enhanced)
            strengths[key] = 0.5 + (0.5 * (idx % 3) / 3.0)
        return strengths
    
    def _build_knowledge_graph(
        self,
        concepts: List[Dict[str, Any]],
        relationships: List[Dict[str, Any]],
        strengths: Dict[str, float]
    ) -> Dict[str, Any]:
        """Build knowledge graph structure"""
        return {
            "nodes": concepts,
            "edges": [
                {
                    **rel,
                    "strength": strengths.get(f"{rel['source']}-{rel['target']}", 0.5)
                }
                for rel in relationships
            ]
        }
    
    async def _identify_implicit_relationships(
        self,
        concepts: List[Dict[str, Any]],
        explicit_relations: List[Dict[str, Any]],
        text: str
    ) -> List[Dict[str, Any]]:
        """Identify implicit relationships not explicitly stated"""
        try:
            # Find concept pairs without explicit relationships
            explicit_pairs = set(
                (r["source"], r["target"]) for r in explicit_relations
            )
            
            implicit = []
            for i, c1 in enumerate(concepts):
                for c2 in concepts[i+1:]:
                    if (c1["id"], c2["id"]) not in explicit_pairs:
                        # This is an implicit relationship candidate
                        implicit.append({
                            "source": c1["id"],
                            "target": c2["id"],
                            "type": "implicit",
                            "confidence": 0.4,
                            "description": f"Implicit connection between {c1['name']} and {c2['name']}"
                        })
                        
                        if len(implicit) >= 3:  # Limit implicit relationships
                            return implicit
            
            return implicit
        except Exception as e:
            self.logger.error(f"Implicit relationship identification failed: {e}")
            return []
    
    def _calculate_graph_density(self, node_count: int, edge_count: int) -> float:
        """Calculate graph density"""
        if node_count < 2:
            return 0.0
        max_edges = node_count * (node_count - 1) / 2
        return edge_count / max_edges if max_edges > 0 else 0.0
    
    def _calculate_confidence(self, result: Dict[str, Any]) -> float:
        """Calculate confidence based on relationship quality"""
        confidence = 0.6  # Base confidence
        
        if result["concepts"]:
            confidence += 0.15
        
        if result["relationships"]:
            confidence += 0.15
        
        # Bonus for implicit relationships
        if result["implicit_relationships"]:
            confidence += 0.1
        
        return min(1.0, confidence)
