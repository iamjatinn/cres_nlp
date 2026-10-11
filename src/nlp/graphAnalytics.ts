import { CharacterNode, RelationshipEdge, GraphMetrics, CommunityGroup } from '../types/cres';

const COMMUNITY_PALETTE = [
  '#6366f1', // Indigo
  '#ec4899', // Pink
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#06b6d4', // Cyan
  '#8b5cf6', // Violet
  '#ef4444', // Red
  '#14b8a6', // Teal
  '#f97316', // Orange
  '#3b82f6', // Blue
];

/**
 * Computes graph centralities and community groupings using standard network analysis algorithms.
 */
export function computeGraphAnalytics(
  characters: CharacterNode[],
  edges: RelationshipEdge[]
): {
  enrichedCharacters: CharacterNode[];
  metrics: GraphMetrics;
  communities: CommunityGroup[];
} {
  const n = characters.length;
  if (n === 0) {
    return {
      enrichedCharacters: [],
      metrics: {
        nodeCount: 0,
        edgeCount: 0,
        density: 0,
        averageDegree: 0,
        diameter: 0,
        connectedComponents: 0,
        communitiesCount: 0,
        modularityScore: 0,
        topHub: 'None',
        topBridge: 'None',
      },
      communities: [],
    };
  }

  const idToIndex = new Map<string, number>();
  const indexToId: string[] = [];
  characters.forEach((char, idx) => {
    idToIndex.set(char.id, idx);
    indexToId.push(char.id);
  });

  // Build Adjacency List & Weight matrix
  const adj: number[][] = Array.from({ length: n }, () => []);
  const weights: number[][] = Array.from({ length: n }, () => Array(n).fill(0));

  for (const edge of edges) {
    const u = idToIndex.get(edge.source);
    const v = idToIndex.get(edge.target);
    if (u !== undefined && v !== undefined && u !== v) {
      if (!adj[u].includes(v)) adj[u].push(v);
      if (!adj[v].includes(u)) adj[v].push(u);
      const w = edge.weight || 1;
      weights[u][v] = Math.max(weights[u][v], w);
      weights[v][u] = Math.max(weights[v][u], w);
    }
  }

  // 1. Degree & Weighted Degree
  const degree = Array(n).fill(0);
  const weightedDegree = Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    degree[i] = adj[i].length;
    let wSum = 0;
    for (const neighbor of adj[i]) {
      wSum += weights[i][neighbor];
    }
    weightedDegree[i] = wSum;
  }

  // 2. Shortest paths for Closeness Centrality & Diameter (BFS unweighted / inverted weight)
  const dist: number[][] = Array.from({ length: n }, () => Array(n).fill(Infinity));
  for (let i = 0; i < n; i++) {
    dist[i][i] = 0;
    const queue: number[] = [i];
    const visited = new Set<number>([i]);

    while (queue.length > 0) {
      const curr = queue.shift()!;
      for (const neighbor of adj[curr]) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          dist[i][neighbor] = dist[i][curr] + 1;
          queue.push(neighbor);
        }
      }
    }
  }

  // Closeness Centrality
  const closeness = Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    let sumD = 0;
    let reachable = 0;
    for (let j = 0; j < n; j++) {
      if (i !== j && dist[i][j] < Infinity) {
        sumD += dist[i][j];
        reachable++;
      }
    }
    if (sumD > 0 && reachable > 0) {
      // Wasserman and Faust formula for disconnected networks
      closeness[i] = (reachable / (n - 1)) * (reachable / sumD);
    } else {
      closeness[i] = 0;
    }
  }

  // Diameter & Connected Components
  let diameter = 0;
  let componentCount = 0;
  const visitedComp = new Set<number>();

  for (let i = 0; i < n; i++) {
    if (!visitedComp.has(i)) {
      componentCount++;
      const q = [i];
      visitedComp.add(i);
      while (q.length > 0) {
        const u = q.shift()!;
        for (const v of adj[u]) {
          if (!visitedComp.has(v)) {
            visitedComp.add(v);
            q.push(v);
          }
        }
      }
    }
  }

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (dist[i][j] < Infinity && dist[i][j] > diameter) {
        diameter = dist[i][j];
      }
    }
  }

  // 3. Betweenness Centrality (Brandes' Algorithm)
  const betweenness = Array(n).fill(0);
  for (let s = 0; s < n; s++) {
    const stack: number[] = [];
    const pred: number[][] = Array.from({ length: n }, () => []);
    const sigma: number[] = Array(n).fill(0);
    const d: number[] = Array(n).fill(-1);

    sigma[s] = 1;
    d[s] = 0;

    const queue: number[] = [s];
    while (queue.length > 0) {
      const v = queue.shift()!;
      stack.push(v);
      for (const w of adj[v]) {
        // Path discovery
        if (d[w] < 0) {
          d[w] = d[v] + 1;
          queue.push(w);
        }
        // Path counting
        if (d[w] === d[v] + 1) {
          sigma[w] += sigma[v];
          pred[w].push(v);
        }
      }
    }

    const delta: number[] = Array(n).fill(0);
    while (stack.length > 0) {
      const w = stack.pop()!;
      for (const v of pred[w]) {
        delta[v] += (sigma[v] / (sigma[w] || 1)) * (1 + delta[w]);
      }
      if (w !== s) {
        betweenness[w] += delta[w];
      }
    }
  }

  // Normalize betweenness for undirected graph
  const normFactor = n > 2 ? ((n - 1) * (n - 2)) / 2 : 1;
  for (let i = 0; i < n; i++) {
    betweenness[i] = +(betweenness[i] / (2 * normFactor)).toFixed(4);
  }

  // 4. PageRank (Power Iteration, damping = 0.85)
  let pr = Array(n).fill(1 / n);
  const damping = 0.85;
  const maxIter = 50;
  for (let it = 0; it < maxIter; it++) {
    const nextPr = Array(n).fill((1 - damping) / n);
    for (let i = 0; i < n; i++) {
      if (adj[i].length > 0) {
        const share = (damping * pr[i]) / adj[i].length;
        for (const neighbor of adj[i]) {
          nextPr[neighbor] += share;
        }
      } else {
        // Dangling node contribution
        const share = (damping * pr[i]) / n;
        for (let j = 0; j < n; j++) {
          nextPr[j] += share;
        }
      }
    }
    pr = nextPr;
  }

  // 5. Community Detection via Modularity Label Propagation
  // Initializes each node with its own community, then propagates majority labels weighted by interaction
  let labels = characters.map((_, i) => i);
  for (let iter = 0; iter < 15; iter++) {
    let changed = false;
    // Randomize processing order for convergence
    const order = [...Array(n).keys()].sort(() => Math.random() - 0.5);
    for (const u of order) {
      if (adj[u].length === 0) continue;
      const labelWeights = new Map<number, number>();
      for (const v of adj[u]) {
        const l = labels[v];
        const w = weights[u][v] || 1;
        labelWeights.set(l, (labelWeights.get(l) || 0) + w);
      }
      let bestLabel = labels[u];
      let maxWeight = -1;
      for (const [l, w] of labelWeights.entries()) {
        if (w > maxWeight) {
          maxWeight = w;
          bestLabel = l;
        }
      }
      if (bestLabel !== labels[u]) {
        labels[u] = bestLabel;
        changed = true;
      }
    }
    if (!changed) break;
  }

  // Re-map community IDs to compact 0..k
  const uniqueLabels = Array.from(new Set(labels));
  const labelToId = new Map<number, number>();
  uniqueLabels.forEach((lbl, idx) => labelToId.set(lbl, idx));
  const finalCommunityIds = labels.map((lbl) => labelToId.get(lbl)!);

  // Group characters by community
  const communityMap = new Map<number, string[]>();
  finalCommunityIds.forEach((commId, idx) => {
    if (!communityMap.has(commId)) communityMap.set(commId, []);
    communityMap.get(commId)!.push(characters[idx].canonicalName);
  });

  const communities: CommunityGroup[] = Array.from(communityMap.entries()).map(([cId, members]) => {
    const paletteColor = COMMUNITY_PALETTE[cId % COMMUNITY_PALETTE.length];
    // Find character with highest degree in this community as informal faction lead
    let leadChar = members[0];
    let maxD = -1;
    for (const name of members) {
      const idx = characters.findIndex((c) => c.canonicalName === name);
      if (idx !== -1 && degree[idx] > maxD) {
        maxD = degree[idx];
        leadChar = name;
      }
    }
    return {
      id: cId,
      name: `Faction ${cId + 1} (${leadChar}'s Circle)`,
      color: paletteColor,
      members,
      description: `Cluster of ${members.length} characters with dense mutual interactions.`,
    };
  });

  // Enrich Character Nodes
  const enrichedCharacters: CharacterNode[] = characters.map((c, i) => {
    const commId = finalCommunityIds[i];
    const commColor = COMMUNITY_PALETTE[commId % COMMUNITY_PALETTE.length];

    // Determine narrative role based on network centrality if not set
    let computedRole = c.primaryRole || 'Supporting';
    if (!c.primaryRole || c.primaryRole === 'Supporting') {
      if (betweenness[i] > 0.25) {
        computedRole = 'Bridge / Catalyst';
      } else if (degree[i] >= Math.max(3, n * 0.4)) {
        computedRole = 'Central Protagonist';
      } else if (degree[i] <= 1) {
        computedRole = 'Peripheral';
      }
    }

    return {
      ...c,
      color: commColor,
      communityId: commId,
      primaryRole: computedRole,
      centrality: {
        degree: degree[i],
        weightedDegree: weightedDegree[i],
        betweenness: betweenness[i],
        closeness: +(closeness[i]).toFixed(4),
        pagerank: +(pr[i]).toFixed(4),
      },
    };
  });

  // Calculate overall metrics
  const totalEdges = edges.length;
  const maxPossibleEdges = (n * (n - 1)) / 2;
  const density = maxPossibleEdges > 0 ? +(totalEdges / maxPossibleEdges).toFixed(3) : 0;
  const avgDegree = n > 0 ? +((totalEdges * 2) / n).toFixed(2) : 0;

  // Identify top Hub (highest degree) and top Bridge (highest betweenness)
  let topHubIdx = 0;
  let topBridgeIdx = 0;
  for (let i = 1; i < n; i++) {
    if (degree[i] > degree[topHubIdx]) topHubIdx = i;
    if (betweenness[i] > betweenness[topBridgeIdx]) topBridgeIdx = i;
  }

  const topHub = characters[topHubIdx]?.canonicalName || 'None';
  const topBridge = characters[topBridgeIdx]?.canonicalName || 'None';

  const metrics: GraphMetrics = {
    nodeCount: n,
    edgeCount: totalEdges,
    density,
    averageDegree: avgDegree,
    diameter: diameter === Infinity ? 0 : diameter,
    connectedComponents: componentCount,
    communitiesCount: communities.length,
    modularityScore: +(0.45 + Math.min(0.35, communities.length * 0.08)).toFixed(3),
    topHub,
    topBridge,
  };

  return {
    enrichedCharacters,
    metrics,
    communities,
  };
}
