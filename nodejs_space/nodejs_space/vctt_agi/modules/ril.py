
"""Relational Inference Layer (RIL) - Handle relational reasoning for agent decision-making"""
from typing import Dict, Any, List, Optional
import logging

logger = logging.getLogger(__name__)


class RelationalInferenceLayer:
    """
    RIL handles relational reasoning to support agent decision-making.
    It infers implicit relationships and provides reasoning support.
    """
    
    def __init__(self):
        self.inference_cache = {}
    
    def infer(
        self,
        concepts: List[Dict[str, Any]],
        relationships: List[Dict[str, Any]],
        context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Perform relational inference
        
        Args:
            concepts: List of concepts from relational agent
            relationships: List of relationships between concepts
            context: Optional context for inference
            
        Returns:
            Dictionary with inferred relationships and reasoning paths
        """
        logger.info("RIL: Performing relational inference")
        
        # Build relationship graph
        graph = self._build_graph(concepts, relationships)
        
        # Infer transitive relationships
        transitive = self._infer_transitive(graph)
        
        # Find reasoning paths
        paths = self._find_reasoning_paths(graph, concepts)
        
        # Identify key nodes (concepts)
        key_nodes = self._identify_key_nodes(graph)
        
        result = {
            "inferred_relationships": transitive,
            "reasoning_paths": paths,
            "key_concepts": key_nodes,
            "graph_structure": {
                "nodes": len(concepts),
                "edges": len(relationships),
                "inferred_edges": len(transitive)
            }
        }
        
        logger.info(f"RIL: Inferred {len(transitive)} relationships")
        return result
    
    def _build_graph(
        self,
        concepts: List[Dict[str, Any]],
        relationships: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Build internal graph representation"""
        graph = {
            "nodes": {c["id"]: c for c in concepts},
            "edges": {},
            "reverse_edges": {}
        }
        
        # Build adjacency lists
        for rel in relationships:
            source = rel["source"]
            target = rel["target"]
            
            if source not in graph["edges"]:
                graph["edges"][source] = []
            graph["edges"][source].append(rel)
            
            if target not in graph["reverse_edges"]:
                graph["reverse_edges"][target] = []
            graph["reverse_edges"][target].append(rel)
        
        return graph
    
    def _infer_transitive(self, graph: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Infer transitive relationships (A->B, B->C implies A->C)"""
        inferred = []
        edges = graph["edges"]
        
        # For each node with outgoing edges
        for source, source_edges in edges.items():
            for edge in source_edges:
                intermediate = edge["target"]
                
                # Check if intermediate has outgoing edges
                if intermediate in edges:
                    for next_edge in edges[intermediate]:
                        target = next_edge["target"]
                        
                        # Don't create self-loops or duplicates
                        if target != source:
                            # Check if direct relationship already exists
                            direct_exists = any(
                                e["target"] == target 
                                for e in source_edges
                            )
                            
                            if not direct_exists:
                                inferred.append({
                                    "source": source,
                                    "target": target,
                                    "type": "transitive",
                                    "path": [source, intermediate, target],
                                    "confidence": 0.6
                                })
        
        return inferred[:10]  # Limit to top 10 inferred relationships
    
    def _find_reasoning_paths(
        self,
        graph: Dict[str, Any],
        concepts: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Find interesting reasoning paths through the graph"""
        paths = []
        
        if len(concepts) < 2:
            return paths
        
        # Find paths between important concept pairs
        for i, start_concept in enumerate(concepts[:3]):  # Limit search
            for end_concept in concepts[i+1:i+3]:
                path = self._find_path(
                    graph,
                    start_concept["id"],
                    end_concept["id"]
                )
                
                if path:
                    paths.append({
                        "start": start_concept["name"],
                        "end": end_concept["name"],
                        "path": path,
                        "length": len(path)
                    })
        
        return paths
    
    def _find_path(
        self,
        graph: Dict[str, Any],
        start: str,
        end: str,
        max_depth: int = 3
    ) -> Optional[List[str]]:
        """Find path between two nodes using BFS"""
        if start == end:
            return [start]
        
        edges = graph["edges"]
        visited = set()
        queue = [(start, [start])]
        
        while queue:
            node, path = queue.pop(0)
            
            if len(path) > max_depth:
                continue
            
            if node in visited:
                continue
            
            visited.add(node)
            
            if node in edges:
                for edge in edges[node]:
                    target = edge["target"]
                    
                    if target == end:
                        return path + [target]
                    
                    if target not in visited:
                        queue.append((target, path + [target]))
        
        return None
    
    def _identify_key_nodes(self, graph: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Identify key concepts based on connectivity"""
        nodes = graph["nodes"]
        edges = graph["edges"]
        reverse_edges = graph["reverse_edges"]
        
        key_nodes = []
        
        for node_id, node in nodes.items():
            # Calculate degree (in + out)
            out_degree = len(edges.get(node_id, []))
            in_degree = len(reverse_edges.get(node_id, []))
            total_degree = out_degree + in_degree
            
            if total_degree > 0:
                key_nodes.append({
                    "id": node_id,
                    "name": node["name"],
                    "degree": total_degree,
                    "importance": min(total_degree / 5.0, 1.0)  # Normalize
                })
        
        # Sort by degree and return top nodes
        key_nodes.sort(key=lambda x: x["degree"], reverse=True)
        return key_nodes[:5]
    
    def clear_cache(self):
        """Clear inference cache"""
        self.inference_cache.clear()
