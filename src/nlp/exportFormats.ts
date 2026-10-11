import { CRESResult } from '../types/cres';

/**
 * Generates ready-to-run NetworkX Python script
 */
export function generateNetworkXPython(result: CRESResult): string {
  const { characters, relationships, metrics } = result;

  const nodeStatements = characters
    .map(
      (c) =>
        `    G.add_node("${c.canonicalName}", id="${c.id}", role="${c.primaryRole}", mentions=${c.mentionsCount}, community=${c.communityId}, betweenness=${c.centrality.betweenness})`
    )
    .join('\n');

  const edgeStatements = relationships
    .map(
      (e) => {
        const src = characters.find((c) => c.id === e.source)?.canonicalName || e.source;
        const tgt = characters.find((c) => c.id === e.target)?.canonicalName || e.target;
        return `    G.add_edge("${src}", "${tgt}", weight=${e.weight}, relation="${e.relationType}", sentiment=${e.sentiment})`;
      }
    )
    .join('\n');

  return `#!/usr/bin/env python3
"""
Character Relation Extraction System (CRES) - NetworkX Graph Export
Generated for narrative analysis with NetworkX, community detection, and visualization.
"""

import networkx as nx
import matplotlib.pyplot as plt

def build_character_graph():
    G = nx.Graph()

    # 1. Add Character Nodes
${nodeStatements}

    # 2. Add Interaction & Relationship Edges
${edgeStatements}

    return G

def analyze_graph(G):
    print("=" * 60)
    print("CHARACTER RELATION EXTRACTION SYSTEM (CRES) - GRAPH REPORT")
    print("=" * 60)
    print(f"Nodes (Characters): {G.number_of_nodes()}")
    print(f"Edges (Relations):  {G.number_of_edges()}")
    print(f"Graph Density:      {nx.density(G):.3f}")

    # Centrality metrics
    degree_cent = nx.degree_centrality(G)
    betweenness_cent = nx.betweenness_centrality(G, weight="weight")
    pagerank_val = nx.pagerank(G, weight="weight")

    print("\\nTop 5 Characters by Degree Centrality:")
    for node, val in sorted(degree_cent.items(), key=lambda x: x[1], reverse=True)[:5]:
        print(f"  - {node:<25} {val:.3f}")

    print("\\nTop 5 Characters by Betweenness Centrality (Bridge Characters):")
    for node, val in sorted(betweenness_cent.items(), key=lambda x: x[1], reverse=True)[:5]:
        print(f"  - {node:<25} {val:.3f}")

    return degree_cent, betweenness_cent

def visualize_graph(G):
    plt.figure(figsize=(12, 9))
    pos = nx.spring_layout(G, seed=42, k=0.5)

    # Edge colors by relation type
    color_map = {
        "kinship": "#10b981",
        "romantic": "#ec4899",
        "adversarial": "#ef4444",
        "hierarchical": "#f59e0b",
        "alliance": "#06b6d4",
        "neutral_interaction": "#94a3b8"
    }

    edge_colors = [color_map.get(G[u][v].get("relation", "neutral_interaction"), "#94a3b8") for u, v in G.edges()]
    edge_weights = [max(1.0, min(6.0, G[u][v].get("weight", 1) * 0.8)) for u, v in G.edges()]

    nx.draw_networkx_nodes(G, pos, node_size=1200, node_color="#6366f1", alpha=0.9)
    nx.draw_networkx_labels(G, pos, font_size=9, font_family="sans-serif", font_weight="bold", font_color="white")
    nx.draw_networkx_edges(G, pos, edge_color=edge_colors, width=edge_weights, alpha=0.7)

    plt.title("CRES Character Relationship Network", fontsize=16, fontweight="bold")
    plt.axis("off")
    plt.tight_layout()
    plt.savefig("character_network.png", dpi=300)
    print("\\nGraph visualization saved to character_network.png")
    plt.show()

if __name__ == "__main__":
    G = build_character_graph()
    analyze_graph(G)
    visualize_graph(G)
`;
}

/**
 * Generates GEXF (Graph Exchange XML Format) for Gephi
 */
export function generateGEXF(result: CRESResult): string {
  const { characters, relationships } = result;

  const nodeXML = characters
    .map(
      (c) => `      <node id="${c.id}" label="${escapeXml(c.canonicalName)}">
        <attvalues>
          <attvalue for="role" value="${escapeXml(c.primaryRole)}"/>
          <attvalue for="mentions" value="${c.mentionsCount}"/>
          <attvalue for="community" value="${c.communityId}"/>
          <attvalue for="betweenness" value="${c.centrality.betweenness}"/>
          <attvalue for="closeness" value="${c.centrality.closeness}"/>
          <attvalue for="pagerank" value="${c.centrality.pagerank}"/>
        </attvalues>
      </node>`
    )
    .join('\n');

  const edgeXML = relationships
    .map(
      (e, idx) => `      <edge id="e_${idx}" source="${e.source}" target="${e.target}" weight="${e.weight}">
        <attvalues>
          <attvalue for="relation_type" value="${escapeXml(e.relationType)}"/>
          <attvalue for="sentiment" value="${e.sentiment}"/>
          <attvalue for="confidence" value="${e.confidence}"/>
        </attvalues>
      </edge>`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<gexf xmlns="http://www.gexf.net/1.2draft" version="1.2">
  <meta lastmodifieddate="${new Date().toISOString().slice(0, 10)}">
    <creator>CRES - Character Relation Extraction System</creator>
    <description>Character Relationship Knowledge Graph</description>
  </meta>
  <graph defaultedgetype="undirected" mode="static">
    <attributes class="node">
      <attribute id="role" title="Narrative Role" type="string"/>
      <attribute id="mentions" title="Mentions Count" type="integer"/>
      <attribute id="community" title="Community ID" type="integer"/>
      <attribute id="betweenness" title="Betweenness Centrality" type="float"/>
      <attribute id="closeness" title="Closeness Centrality" type="float"/>
      <attribute id="pagerank" title="PageRank" type="float"/>
    </attributes>
    <attributes class="edge">
      <attribute id="relation_type" title="Relation Type" type="string"/>
      <attribute id="sentiment" title="Sentiment Polarity" type="float"/>
      <attribute id="confidence" title="Confidence Score" type="float"/>
    </attributes>
    <nodes>
${nodeXML}
    </nodes>
    <edges>
${edgeXML}
    </edges>
  </graph>
</gexf>`;
}

/**
 * Generates Cytoscape / D3 Node-Link JSON format
 */
export function generateGraphJSON(result: CRESResult): string {
  const { characters, relationships, metrics, communities } = result;

  const data = {
    metadata: {
      generatedAt: new Date().toISOString(),
      generator: 'Character Relation Extraction System (CRES)',
      metrics,
    },
    communities,
    nodes: characters.map((c) => ({
      id: c.id,
      name: c.canonicalName,
      aliases: c.aliases,
      role: c.primaryRole,
      gender: c.gender,
      mentions: c.mentionsCount,
      community: c.communityId,
      centrality: c.centrality,
    })),
    links: relationships.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      weight: e.weight,
      relationType: e.relationType,
      sentiment: e.sentiment,
      directionality: e.directionality,
      confidence: e.confidence,
      summary: e.summary,
      evidenceQuotes: e.evidenceQuotes,
    })),
  };

  return JSON.stringify(data, null, 2);
}

/**
 * Generates CSV for Nodes and Edges
 */
export function generateCSV(result: CRESResult): { nodesCSV: string; edgesCSV: string } {
  const { characters, relationships } = result;

  const nodeHeader = 'Id,Label,Role,Gender,Mentions,Community,Degree,Betweenness,Closeness,PageRank\n';
  const nodeRows = characters
    .map(
      (c) =>
        `"${c.id}","${escapeCsv(c.canonicalName)}","${escapeCsv(c.primaryRole)}","${c.gender}",${c.mentionsCount},${c.communityId},${c.centrality.degree},${c.centrality.betweenness},${c.centrality.closeness},${c.centrality.pagerank}`
    )
    .join('\n');

  const edgeHeader = 'Source,Target,Type,Weight,RelationType,Sentiment,Confidence,Summary\n';
  const edgeRows = relationships
    .map(
      (e) =>
        `"${e.source}","${e.target}","${e.directionality}",${e.weight},"${e.relationType}",${e.sentiment},${e.confidence},"${escapeCsv(e.summary)}"`
    )
    .join('\n');

  return {
    nodesCSV: nodeHeader + nodeRows,
    edgesCSV: edgeHeader + edgeRows,
  };
}

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

function escapeCsv(val: string): string {
  return val.replace(/"/g, '""');
}
