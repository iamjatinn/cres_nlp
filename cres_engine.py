#!/usr/bin/env python3
"""
CRES (Character Relation Extraction System) - Graph Analytics & Network Engine
Pure Python standard library implementation of network metrics (Degree, Brandes Betweenness)
and NetworkX export generation.
"""

import sys
import json
import re
from collections import deque, defaultdict

def fallback_extract(text):
    """
    Fallback extractor in pure Python when the LLM service experiences high demand.
    Extracts prominent character proper nouns and scene co-occurrences.
    """
    paragraphs = [p.strip() for p in text.split('\n\n') if p.strip()]
    if not paragraphs:
        paragraphs = [text]

    stop_words = {
        'the', 'this', 'that', 'then', 'they', 'when', 'what', 'where', 'meanwhile',
        'however', 'suddenly', 'perhaps', 'chapter', 'monday', 'tuesday', 'january',
        'london', 'england', 'hall', 'park', 'house', 'room', 'street'
    }

    # Extract capitalized candidate entities
    char_counts = defaultdict(int)
    para_entities = []

    for p in paragraphs:
        matches = re.findall(r'\b(?:(?:Mr\.|Mrs\.|Miss|Lord|Lady|Sir|King|Queen|Prince|Dr\.)\s+)?[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b', p)
        valid = set()
        for m in matches:
            cleaned = m.strip()
            first_word = cleaned.split()[0].lower().replace('.', '')
            if first_word not in stop_words and len(cleaned) > 2:
                valid.add(cleaned)
                char_counts[cleaned] += 1
        para_entities.append(valid)

    # Top characters
    top_candidates = sorted(char_counts.keys(), key=lambda x: char_counts[x], reverse=True)[:8]
    if len(top_candidates) < 2 and char_counts:
        top_candidates = list(char_counts.keys())[:5]

    characters = []
    for idx, name in enumerate(top_candidates):
        characters.append({
            "id": f"c_{idx + 1}",
            "canonicalName": name,
            "aliases": [name],
            "primaryRole": "Protagonist" if idx == 0 else "Supporting",
            "gender": "unknown",
            "mentionsCount": char_counts[name]
        })

    # Co-occurrences
    pair_counts = defaultdict(int)
    pair_snippets = defaultdict(list)

    for p_idx, p in enumerate(paragraphs):
        present = [c for c in top_candidates if c in p]
        for i in range(len(present)):
            for j in range(i + 1, len(present)):
                pair = tuple(sorted([present[i], present[j]]))
                pair_counts[pair] += 1
                if len(pair_snippets[pair]) < 2:
                    pair_snippets[pair].append(p[:250] + ("..." if len(p) > 250 else ""))

    relationships = []
    edge_idx = 0
    for (src, tgt), count in pair_counts.items():
        edge_idx += 1
        relationships.append({
            "source": src,
            "target": tgt,
            "relationType": "alliance" if count > 2 else "neutral_interaction",
            "sentiment": 0.2 if count > 2 else 0.0,
            "weight": count,
            "evidenceQuotes": pair_snippets[(src, tgt)],
            "summary": f"{src} and {tgt} interact across scenes.",
            "directionality": "undirected"
        })

    return characters, relationships

def compute_graph_metrics(characters, relationships):
    """
    Computes graph centrality metrics and community factions in pure Python.
    """
    node_names = [c["canonicalName"] for c in characters]
    node_set = set(node_names)
    
    # Map both ID and lowercased name to canonicalName
    id_map = {}
    for c in characters:
        c_name = c["canonicalName"]
        id_map[c_name] = c_name
        id_map[c_name.lower()] = c_name
        if "id" in c:
            id_map[c["id"]] = c_name
            id_map[c["id"].lower()] = c_name

    adj = defaultdict(list)
    edge_weights = defaultdict(int)
    
    for r in relationships:
        raw_src = r.get("source", "")
        raw_tgt = r.get("target", "")
        src = id_map.get(raw_src) or id_map.get(str(raw_src).lower()) or raw_src
        tgt = id_map.get(raw_tgt) or id_map.get(str(raw_tgt).lower()) or raw_tgt
        weight = r.get("weight", 1)
        if src in node_set and tgt in node_set and src != tgt:
            if tgt not in adj[src]:
                adj[src].append(tgt)
            if src not in adj[tgt]:
                adj[tgt].append(src)
            edge_weights[(src, tgt)] = weight
            edge_weights[(tgt, src)] = weight

    degrees = {node: len(adj[node]) for node in node_names}
    
    # Brandes' Betweenness Centrality
    betweenness = {node: 0.0 for node in node_names}
    for s in node_names:
        stack = []
        pred = defaultdict(list)
        sigma = dict.fromkeys(node_names, 0)
        d = dict.fromkeys(node_names, -1)
        
        sigma[s] = 1
        d[s] = 0
        queue = deque([s])
        
        while queue:
            v = queue.popleft()
            stack.append(v)
            for w in adj[v]:
                if d[w] < 0:
                    d[w] = d[v] + 1
                    queue.append(w)
                if d[w] == d[v] + 1:
                    sigma[w] += sigma[v]
                    pred[w].append(v)
                    
        delta = dict.fromkeys(node_names, 0.0)
        while stack:
            w = stack.pop()
            for v in pred[w]:
                c_val = (sigma[v] / (sigma[w] or 1)) * (1.0 + delta[w])
                delta[v] += c_val
            if w != s:
                betweenness[w] += delta[w]

    n = len(node_names)
    norm = ((n - 1) * (n - 2)) / 2.0 if n > 2 else 1.0
    for node in node_names:
        betweenness[node] = round(betweenness[node] / (2.0 * norm), 3)

    # Community Clustering
    visited = set()
    communities = []
    comm_palette = ["#6366f1", "#ec4899", "#10b981", "#f59e0b", "#06b6d4", "#8b5cf6", "#ef4444"]
    comm_id = 0
    node_to_comm = {}
    
    for node in node_names:
        if node not in visited:
            component = []
            q = deque([node])
            visited.add(node)
            while q:
                curr = q.popleft()
                component.append(curr)
                node_to_comm[curr] = comm_id
                for neighbor in adj[curr]:
                    if neighbor not in visited:
                        visited.add(neighbor)
                        q.append(neighbor)
            
            communities.append({
                "id": comm_id,
                "name": f"Group {comm_id + 1}",
                "color": comm_palette[comm_id % len(comm_palette)],
                "members": component
            })
            comm_id += 1

    enriched_characters = []
    for c in characters:
        name = c["canonicalName"]
        c_copy = dict(c)
        c_copy["communityId"] = node_to_comm.get(name, 0)
        c_copy["color"] = comm_palette[node_to_comm.get(name, 0) % len(comm_palette)]
        c_copy["centrality"] = {
            "degree": degrees.get(name, 0),
            "betweenness": betweenness.get(name, 0.0)
        }
        enriched_characters.append(c_copy)

    top_hub = max(node_names, key=lambda x: degrees.get(x, 0)) if node_names else "None"
    top_bridge = max(node_names, key=lambda x: betweenness.get(x, 0)) if node_names else "None"

    return {
        "characters": enriched_characters,
        "relationships": relationships,
        "communities": communities,
        "metrics": {
            "nodeCount": len(node_names),
            "edgeCount": len(relationships),
            "topHub": top_hub,
            "topBridge": top_bridge
        }
    }

def main():
    try:
        raw_input = sys.stdin.read()
        if not raw_input.strip():
            print(json.dumps({"error": "Empty input"}))
            return
            
        data = json.loads(raw_input)
        chars = data.get("characters", [])
        rels = data.get("relationships", [])
        text = data.get("text", "")

        # If characters are empty, run Python fallback extraction
        if not chars and text:
            chars, rels = fallback_extract(text)
        
        result = compute_graph_metrics(chars, rels)
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
