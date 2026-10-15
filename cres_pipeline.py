#!/usr/bin/env python3
"""
CRES: Character Relation Extraction System
NLP Mini Project (Python + NetworkX)

Pipeline:
1. Character Entity & Alias Recognition
2. Relationship Classification (Kinship, Romantic, Adversarial, Hierarchical, Alliance)
3. Sentiment & Evidence Analysis
4. Graph Centrality Analysis (Degree & Brandes Betweenness Centrality)
5. NetworkX Graph Visualization
"""

import os
import sys
import json
from collections import defaultdict, deque

# Default dataset: Ravenwood Estate Mystery (7 Chapters)
DEFAULT_DATA = {
    "story": "Ravenwood Estate: The Return",
    "characters": [
        {"canonicalName": "Adrian Blackwood", "aliases": ["Ade"], "primaryRole": "Protagonist"},
        {"canonicalName": "Lord Sebastian Blackwood", "aliases": ["Sebastian"], "primaryRole": "Catalyst"},
        {"canonicalName": "Catherine", "aliases": ["Cathy"], "primaryRole": "Deuteragonist"},
        {"canonicalName": "Margaret Blackwood", "aliases": ["Margaret"], "primaryRole": "Supporting"},
        {"canonicalName": "Thomas Ashford", "aliases": ["Thomas"], "primaryRole": "Antagonist"},
        {"canonicalName": "Victor Hale", "aliases": ["Victor"], "primaryRole": "Antagonist"},
        {"canonicalName": "Isabella Moore", "aliases": ["Bella"], "primaryRole": "Supporting"},
        {"canonicalName": "Daniel Cross", "aliases": ["Doctor Cross"], "primaryRole": "Supporting"},
        {"canonicalName": "Inspector Robert Shaw", "aliases": ["Inspector Shaw"], "primaryRole": "Supporting"},
        {"canonicalName": "Grace Shaw", "aliases": ["Grace"], "primaryRole": "Supporting"},
        {"canonicalName": "Jonathan Blackwood", "aliases": ["John Price"], "primaryRole": "Supporting"},
        {"canonicalName": "Laura Price", "aliases": ["Laura"], "primaryRole": "Supporting"},
        {"canonicalName": "Helen Ward", "aliases": ["Helen"], "primaryRole": "Supporting"},
        {"canonicalName": "Eleanor Price", "aliases": ["Eleanor"], "primaryRole": "Supporting"},
        {"canonicalName": "Elizabeth", "aliases": ["Elizabeth Blackwood"], "primaryRole": "Supporting"}
    ],
    "relationships": [
        {"source": "Lord Sebastian Blackwood", "target": "Adrian Blackwood", "relationType": "uncle-nephew", "sentiment": 0.6, "weight": 5, "summary": "Uncle and nephew; Sebastian secretly protected Adrian."},
        {"source": "Catherine", "target": "Adrian Blackwood", "relationType": "cousin", "sentiment": 0.4, "weight": 6, "summary": "Cousins navigating the estate mystery and secrets."},
        {"source": "Lord Sebastian Blackwood", "target": "Catherine", "relationType": "adoptive-parent", "sentiment": 0.8, "weight": 4, "summary": "Adoptive father and daughter; principal heir of his will."},
        {"source": "Margaret Blackwood", "target": "Thomas Ashford", "relationType": "spouse", "sentiment": -0.6, "weight": 7, "summary": "Unhappy marriage burdened by distrust, ending in separation."},
        {"source": "Victor Hale", "target": "Lord Sebastian Blackwood", "relationType": "enemy", "sentiment": -0.9, "weight": 6, "summary": "Former closest friends turned bitter enemies over property."},
        {"source": "Isabella Moore", "target": "Daniel Cross", "relationType": "betrothed", "sentiment": 0.7, "weight": 5, "summary": "Engaged couple defending each other through the murder probe."},
        {"source": "Isabella Moore", "target": "Adrian Blackwood", "relationType": "former-lovers", "sentiment": 0.2, "weight": 4, "summary": "Past romantic history and mutual secret-keeping."},
        {"source": "Inspector Robert Shaw", "target": "Grace Shaw", "relationType": "sibling", "sentiment": 0.7, "weight": 4, "summary": "Brother and sister; Grace confides the hidden vial."},
        {"source": "Jonathan Blackwood", "target": "Lord Sebastian Blackwood", "relationType": "parent-child", "sentiment": 0.1, "weight": 3, "summary": "Biological father and unacknowledged missing son."},
        {"source": "Jonathan Blackwood", "target": "Laura Price", "relationType": "spouse", "sentiment": 0.8, "weight": 4, "summary": "Devoted husband and wife supporting each other."},
        {"source": "Helen Ward", "target": "Daniel Cross", "relationType": "sibling", "sentiment": 0.3, "weight": 3, "summary": "Sister and brother on opposite sides of Victor's legal challenge."},
        {"source": "Helen Ward", "target": "Victor Hale", "relationType": "lawyer-client", "sentiment": -0.2, "weight": 4, "summary": "Attorney and client; Helen refuses unethical demands."},
        {"source": "Margaret Blackwood", "target": "Catherine", "relationType": "aunt-niece", "sentiment": 0.8, "weight": 5, "summary": "Aunt who lovingly raised Catherine as a second mother."},
        {"source": "Eleanor Price", "target": "Lord Sebastian Blackwood", "relationType": "former-lovers", "sentiment": 0.3, "weight": 3, "summary": "Former fiancée and mother of Jonathan Blackwood."}
    ]
}

def analyze_character_graph(characters, relationships):
    """
    Builds adjacency network, computes degree and Brandes' betweenness centralities.
    """
    node_names = [c["canonicalName"] for c in characters]
    node_set = set(node_names)
    adj = defaultdict(list)
    edge_list = []

    for r in relationships:
        src = r.get("source")
        tgt = r.get("target")
        weight = r.get("weight", 1)
        rel_type = r.get("relationType", "neutral_interaction")
        sentiment = r.get("sentiment", 0.0)
        summary = r.get("summary", "")
        if src in node_set and tgt in node_set and src != tgt:
            if tgt not in adj[src]:
                adj[src].append(tgt)
            if src not in adj[tgt]:
                adj[tgt].append(src)
            edge_list.append((src, tgt, weight, rel_type, sentiment, summary))

    # 1. Degree Centrality
    degrees = {node: len(adj[node]) for node in node_names}

    # 2. Brandes' Betweenness Centrality
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
                delta[v] += (sigma[v] / (sigma[w] or 1)) * (1.0 + delta[w])
            if w != s:
                betweenness[w] += delta[w]

    n = len(node_names)
    norm = ((n - 1) * (n - 2)) / 2.0 if n > 2 else 1.0
    for node in node_names:
        betweenness[node] = round(betweenness[node] / (2.0 * norm), 3)

    return {
        "nodes": node_names,
        "degrees": degrees,
        "betweenness": betweenness,
        "edges": edge_list
    }

def print_project_summary(data):
    characters = data.get("characters", [])
    relationships = data.get("relationships", [])
    story_title = data.get("story", "Narrative Corpus")
    analysis = analyze_character_graph(characters, relationships)

    print("\n" + "=" * 65)
    print(f"CRES: Character Relation Extraction System")
    print(f"Story: {story_title}")
    print("=" * 65)
    print(f"Total Identified Characters:    {len(characters)}")
    print(f"Total Classified Relationships: {len(relationships)}")

    print("\n[Character Centrality Rankings]:")
    print(f"{'Character':<28} {'Role':<14} {'Degree':<8} {'Betweenness':<10}")
    print("-" * 65)
    # Sort by degree descending
    sorted_chars = sorted(characters, key=lambda c: analysis["degrees"].get(c["canonicalName"], 0), reverse=True)
    for c in sorted_chars:
        name = c.get("canonicalName")
        role = c.get("primaryRole", "Supporting")
        deg = analysis["degrees"].get(name, 0)
        bet = analysis["betweenness"].get(name, 0.0)
        print(f"{name:<28} {role:<14} {deg:<8} {bet:.3f}")

    print("\n[Classified Interpersonal Relationships]:")
    for r in relationships:
        src = r.get("source")
        tgt = r.get("target")
        rel = r.get("relationType", "neutral")
        sent = r.get("sentiment", 0.0)
        sign = "+" if sent > 0 else ""
        print(f"  • {src} <--> {tgt} : [{rel.upper()}] (Sentiment: {sign}{sent})")
        if "summary" in r and r["summary"]:
            print(f"    └─ {r['summary']}")

    print("=" * 65)
    return analysis

def plot_networkx(data):
    try:
        import networkx as nx
        import matplotlib.pyplot as plt
    except ImportError:
        print("\nNote: Install networkx and matplotlib to view graphical plots:")
        print("      pip install networkx matplotlib")
        return

    characters = data.get("characters", [])
    relationships = data.get("relationships", [])

    G = nx.Graph()
    for c in characters:
        G.add_node(c["canonicalName"], role=c.get("primaryRole", "Supporting"))

    for r in relationships:
        G.add_edge(r["source"], r["target"], weight=r.get("weight", 1), relation=r.get("relationType", "neutral"))

    plt.figure(figsize=(11, 8))
    pos = nx.spring_layout(G, seed=42, k=0.55)

    color_map = {
        "kinship": "#10b981",
        "romantic": "#f43f5e",
        "adversarial": "#ef4444",
        "hierarchical": "#f59e0b",
        "alliance": "#06b6d4",
        "neutral_interaction": "#64748b"
    }

    edge_colors = [color_map.get(G[u][v].get("relation", "neutral_interaction"), "#64748b") for u, v in G.edges()]
    edge_weights = [max(1.2, min(5.0, G[u][v].get("weight", 1) * 0.7)) for u, v in G.edges()]

    nx.draw_networkx_nodes(G, pos, node_size=1200, node_color="#4f46e5", alpha=0.9)
    nx.draw_networkx_labels(G, pos, font_size=8, font_family="sans-serif", font_color="white", font_weight="bold")
    nx.draw_networkx_edges(G, pos, edge_color=edge_colors, width=edge_weights, alpha=0.75)

    plt.title(f"CRES Character Network - {data.get('story', 'Narrative Graph')}", fontsize=13, fontweight="bold")
    plt.axis("off")
    plt.tight_layout()
    output_png = "character_graph.png"
    plt.savefig(output_png, dpi=300)
    print(f"\n[Saved Graph Plot]: {output_png}")
    plt.show()

if __name__ == "__main__":
    data_to_run = DEFAULT_DATA
    if len(sys.argv) > 1 and os.path.exists(sys.argv[1]):
        with open(sys.argv[1], "r") as f:
            data_to_run = json.load(f)

    print_project_summary(data_to_run)
    plot_networkx(data_to_run)
