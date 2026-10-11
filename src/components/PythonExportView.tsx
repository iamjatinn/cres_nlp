import React, { useState } from 'react';
import { CharacterNode, RelationshipEdge } from '../types/cres';
import { Download, Copy, Check, Terminal, Play } from 'lucide-react';

interface PythonExportViewProps {
  characters: CharacterNode[];
  relationships: RelationshipEdge[];
}

export const PythonExportView: React.FC<PythonExportViewProps> = ({
  characters,
  relationships,
}) => {
  const [copied, setCopied] = useState<boolean>(false);

  const nodeStatements = characters
    .map(
      (c) =>
        `    G.add_node("${c.canonicalName}", role="${c.primaryRole}", degree=${c.centrality?.degree || 0}, betweenness=${c.centrality?.betweenness || 0.0})`
    )
    .join('\n');

  const edgeStatements = relationships
    .map((e) => {
      const src = characters.find((c) => c.id === e.source)?.canonicalName || e.source;
      const tgt = characters.find((c) => c.id === e.target)?.canonicalName || e.target;
      return `    G.add_edge("${src}", "${tgt}", weight=${e.weight || 1}, relation="${e.relationType}", sentiment=${e.sentiment || 0.0})`;
    })
    .join('\n');

  const pythonScript = `#!/usr/bin/env python3
"""
CRES: Character Relation Extraction System
NLP Mini Project - Python & NetworkX Script
"""

import networkx as nx
import matplotlib.pyplot as plt

def build_character_graph():
    G = nx.Graph()

    # 1. Add Characters (Nodes)
${nodeStatements}

    # 2. Add Relationships (Edges)
${edgeStatements}

    return G

def run_graph_analysis(G):
    print("=" * 60)
    print("CRES: Character Relationship Knowledge Graph")
    print("=" * 60)
    print(f"Total Characters: {G.number_of_nodes()}")
    print(f"Total Relationships: {G.number_of_edges()}")

    # Centrality Rankings
    deg_centrality = nx.degree_centrality(G)
    bet_centrality = nx.betweenness_centrality(G)

    print("\\n[Top Characters by Degree Centrality]:")
    for char, score in sorted(deg_centrality.items(), key=lambda x: x[1], reverse=True)[:5]:
        print(f"  • {char:<24} {score:.3f}")

    print("\\n[Top Bridge Characters (Betweenness)]: ")
    for char, score in sorted(bet_centrality.items(), key=lambda x: x[1], reverse=True)[:5]:
        print(f"  • {char:<24} {score:.3f}")

def visualize_graph(G):
    plt.figure(figsize=(10, 8))
    pos = nx.spring_layout(G, seed=42, k=0.6)

    color_map = {
        "kinship": "#10b981",
        "romantic": "#f43f5e",
        "adversarial": "#ef4444",
        "hierarchical": "#f59e0b",
        "alliance": "#06b6d4",
        "neutral_interaction": "#64748b"
    }

    edge_colors = [color_map.get(G[u][v].get("relation", "neutral_interaction"), "#64748b") for u, v in G.edges()]
    edge_weights = [max(1.0, min(5.0, G[u][v].get("weight", 1) * 0.8)) for u, v in G.edges()]

    nx.draw_networkx_nodes(G, pos, node_size=1100, node_color="#4f46e5", alpha=0.9)
    nx.draw_networkx_labels(G, pos, font_size=9, font_family="sans-serif", font_color="white", font_weight="bold")
    nx.draw_networkx_edges(G, pos, edge_color=edge_colors, width=edge_weights, alpha=0.8)

    plt.title("CRES Character Relationship Network", fontsize=14, fontweight="bold")
    plt.axis("off")
    plt.tight_layout()
    plt.savefig("character_graph.png", dpi=300)
    print("\\n[Output] Graph plot saved to character_graph.png")
    plt.show()

if __name__ == "__main__":
    graph = build_character_graph()
    run_graph_analysis(graph)
    visualize_graph(graph)
`;

  const copyCode = () => {
    navigator.clipboard.writeText(pythonScript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadPython = () => {
    const blob = new Blob([pythonScript], { type: 'text/x-python' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cres_project.py';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full flex flex-col bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
      {/* Top Bar */}
      <div className="p-3 border-b border-slate-800 bg-slate-900 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-slate-300">
          <Terminal className="w-4 h-4 text-indigo-400" />
          <span className="font-semibold text-white">Standalone Python Script (NetworkX & Matplotlib)</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={copyCode}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy Python Code'}</span>
          </button>

          <button
            onClick={downloadPython}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download .py</span>
          </button>
        </div>
      </div>

      {/* Code Viewer */}
      <div className="flex-1 p-4 overflow-y-auto font-mono text-xs bg-slate-950 text-emerald-400 leading-relaxed whitespace-pre-wrap select-text">
        {pythonScript}
      </div>
    </div>
  );
};
