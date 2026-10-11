import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import {
  CharacterNode,
  RelationshipEdge,
  RelationCategory,
  CommunityGroup,
} from '../types/cres';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Play,
  Pause,
  Search,
  Info,
} from 'lucide-react';

interface NetworkGraphProps {
  characters: CharacterNode[];
  relationships: RelationshipEdge[];
  communities: CommunityGroup[];
  selectedCharacterId: string | null;
  selectedEdgeId: string | null;
  onSelectCharacter: (charId: string | null) => void;
  onSelectEdge: (edgeId: string | null) => void;
}

const RELATION_COLORS: Record<RelationCategory, string> = {
  kinship: '#10b981', // Emerald
  romantic: '#f43f5e', // Rose
  adversarial: '#ef4444', // Red
  hierarchical: '#f59e0b', // Amber
  alliance: '#06b6d4', // Cyan
  neutral_interaction: '#64748b', // Slate
};

interface D3Node extends d3.SimulationNodeDatum, CharacterNode {}

interface D3Link extends d3.SimulationLinkDatum<D3Node> {
  id: string;
  source: D3Node | string;
  target: D3Node | string;
  relationType: RelationCategory;
  weight: number;
  sentiment: number;
  directionality: string;
}

export const NetworkGraph: React.FC<NetworkGraphProps> = ({
  characters,
  relationships,
  communities,
  selectedCharacterId,
  selectedEdgeId,
  onSelectCharacter,
  onSelectEdge,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<d3.Simulation<D3Node, D3Link> | null>(null);

  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [isPhysicsRunning, setIsPhysicsRunning] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Connected node IDs
  const connectedNodeIds = useMemo(() => {
    const activeFocus = hoveredNodeId || selectedCharacterId;
    if (!activeFocus) return null;
    const neighbors = new Set<string>([activeFocus]);
    for (const link of relationships) {
      const srcId = typeof link.source === 'object' ? (link.source as CharacterNode).id : link.source;
      const tgtId = typeof link.target === 'object' ? (link.target as CharacterNode).id : link.target;
      if (srcId === activeFocus) neighbors.add(tgtId);
      if (tgtId === activeFocus) neighbors.add(srcId);
    }
    return neighbors;
  }, [hoveredNodeId, selectedCharacterId, relationships]);

  const getNodeRadius = (char: CharacterNode): number => {
    const degree = char.centrality?.degree || 1;
    return Math.max(16, Math.min(36, 14 + degree * 3.5));
  };

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const width = containerRef.current.clientWidth || 800;
    const height = containerRef.current.clientHeight || 600;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // Defs for arrowheads
    const defs = svg.append('defs');
    Object.entries(RELATION_COLORS).forEach(([type, color]) => {
      defs
        .append('marker')
        .attr('id', `arrow-${type}`)
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 22)
        .attr('refY', 0)
        .attr('markerWidth', 6)
        .attr('markerHeight', 6)
        .attr('orient', 'auto')
        .append('path')
        .attr('d', 'M0,-4L9,0L0,4')
        .attr('fill', color);
    });

    const g = svg.append('g').attr('class', 'main-graph-group');

    // Zoom & Pan
    const zoomBehavior = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 3.5])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoomBehavior);

    const simNodes: D3Node[] = characters.map((c) => ({ ...c }));
    const simLinks: D3Link[] = relationships.map((l) => ({
      ...l,
      source: l.source,
      target: l.target,
    }));

    const simulation = d3
      .forceSimulation<D3Node>(simNodes)
      .force(
        'link',
        d3
          .forceLink<D3Node, D3Link>(simLinks)
          .id((d) => d.id)
          .distance((d) => Math.max(70, 150 - (d.weight || 1) * 8))
      )
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force(
        'collision',
        d3.forceCollide<D3Node>().radius((d) => getNodeRadius(d) + 16)
      );

    simulationRef.current = simulation;

    // Links
    const linkGroup = g.append('g').attr('class', 'links');
    const link = linkGroup
      .selectAll<SVGLineElement, D3Link>('line')
      .data(simLinks, (d) => d.id)
      .enter()
      .append('line')
      .attr('stroke', (d) => RELATION_COLORS[d.relationType] || '#64748b')
      .attr('stroke-width', (d) => Math.max(1.5, Math.min(6, 1 + (d.weight || 1) * 0.8)))
      .attr('stroke-opacity', 0.6)
      .attr('stroke-dasharray', (d) => (d.relationType === 'adversarial' ? '4,4' : 'none'))
      .attr('cursor', 'pointer')
      .on('click', (event, d) => {
        event.stopPropagation();
        onSelectEdge(d.id);
      });

    // Link Hit Area
    linkGroup
      .selectAll<SVGLineElement, D3Link>('.link-hit')
      .data(simLinks, (d) => `hit-${d.id}`)
      .enter()
      .append('line')
      .attr('stroke', 'transparent')
      .attr('stroke-width', 16)
      .attr('cursor', 'pointer')
      .on('click', (event, d) => {
        event.stopPropagation();
        onSelectEdge(d.id);
      })
      .on('mouseenter', (event, d) => {
        link.filter((l) => l.id === d.id).attr('stroke-opacity', 1).attr('stroke-width', 4);
      })
      .on('mouseleave', (event, d) => {
        link.filter((l) => l.id === d.id).attr('stroke-opacity', 0.6).attr('stroke-width', (l) => Math.max(1.5, Math.min(6, 1 + (l.weight || 1) * 0.8)));
      });

    // Nodes
    const nodeGroup = g.append('g').attr('class', 'nodes');
    const node = nodeGroup
      .selectAll<SVGGElement, D3Node>('g')
      .data(simNodes, (d) => d.id)
      .enter()
      .append('g')
      .attr('cursor', 'grab')
      .on('click', (event, d) => {
        event.stopPropagation();
        onSelectCharacter(d.id === selectedCharacterId ? null : d.id);
      })
      .on('mouseenter', (event, d) => setHoveredNodeId(d.id))
      .on('mouseleave', () => setHoveredNodeId(null))
      .call(
        d3
          .drag<SVGGElement, D3Node>()
          .on('start', (event, d) => {
            if (!event.active && isPhysicsRunning) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on('drag', (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on('end', (event, d) => {
            if (!event.active && isPhysicsRunning) simulation.alphaTarget(0);
          })
      );

    // Node outer halo
    node
      .append('circle')
      .attr('class', 'node-halo')
      .attr('r', (d) => getNodeRadius(d) + 3)
      .attr('fill', (d) => d.color || '#6366f1')
      .attr('fill-opacity', 0.2);

    // Node core circle
    node
      .append('circle')
      .attr('class', 'node-core')
      .attr('r', (d) => getNodeRadius(d))
      .attr('fill', (d) => d.color || '#4f46e5')
      .attr('stroke', '#0f172a')
      .attr('stroke-width', 2);

    // Node initials
    node
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .attr('font-size', (d) => Math.max(9, getNodeRadius(d) * 0.55))
      .attr('font-weight', 'bold')
      .attr('fill', '#ffffff')
      .attr('pointer-events', 'none')
      .text((d) => {
        const parts = d.canonicalName.split(' ');
        if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`;
        return d.canonicalName.slice(0, 2).toUpperCase();
      });

    // Node name label
    node
      .append('text')
      .attr('class', 'node-label')
      .attr('text-anchor', 'middle')
      .attr('dy', (d) => getNodeRadius(d) + 13)
      .attr('font-size', '11px')
      .attr('font-weight', '600')
      .attr('fill', '#e2e8f0')
      .attr('stroke', '#020617')
      .attr('stroke-width', 3)
      .attr('paint-order', 'stroke')
      .text((d) => d.canonicalName);

    // Simulation tick
    simulation.on('tick', () => {
      link
        .attr('x1', (d) => (d.source as D3Node).x || 0)
        .attr('y1', (d) => (d.source as D3Node).y || 0)
        .attr('x2', (d) => (d.target as D3Node).x || 0)
        .attr('y2', (d) => (d.target as D3Node).y || 0);

      node.attr('transform', (d) => `translate(${d.x || 0},${d.y || 0})`);
    });

    svg.on('click', () => {
      onSelectCharacter(null);
      onSelectEdge(null);
    });

    return () => {
      simulation.stop();
    };
  }, [characters, relationships]);

  // Highlight active neighborhood
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    const activeFocus = hoveredNodeId || selectedCharacterId;

    if (activeFocus && connectedNodeIds) {
      svg
        .selectAll<SVGGElement, D3Node>('.nodes g')
        .transition()
        .duration(150)
        .attr('opacity', (d) => (connectedNodeIds.has(d.id) ? 1.0 : 0.18));

      svg
        .selectAll<SVGLineElement, D3Link>('.links line')
        .transition()
        .duration(150)
        .attr('opacity', (d) => {
          const srcId = typeof d.source === 'object' ? (d.source as CharacterNode).id : d.source;
          const tgtId = typeof d.target === 'object' ? (d.target as CharacterNode).id : d.target;
          return srcId === activeFocus || tgtId === activeFocus ? 1.0 : 0.08;
        });
    } else {
      svg.selectAll('.nodes g').transition().duration(150).attr('opacity', 1.0);
      svg.selectAll('.links line').transition().duration(150).attr('opacity', 0.7);
    }
  }, [hoveredNodeId, selectedCharacterId, connectedNodeIds]);

  const handleZoom = (scaleFactor: number) => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.transition().duration(250).call(d3.zoom<SVGSVGElement, unknown>().scaleBy as any, scaleFactor);
  };

  const handleResetZoom = () => {
    if (!svgRef.current || !containerRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.transition().duration(350).call(d3.zoom<SVGSVGElement, unknown>().transform as any, d3.zoomIdentity);
  };

  const togglePhysics = () => {
    if (!simulationRef.current) return;
    if (isPhysicsRunning) {
      simulationRef.current.stop();
      setIsPhysicsRunning(false);
    } else {
      simulationRef.current.alpha(0.3).restart();
      setIsPhysicsRunning(true);
    }
  };

  const searchMatches = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return characters.filter((c) => c.canonicalName.toLowerCase().includes(q));
  }, [characters, searchQuery]);

  return (
    <div className="relative w-full h-full flex flex-col bg-slate-950 overflow-hidden border border-slate-800 rounded-xl">
      {/* Top Controls */}
      <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-2 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-800 pointer-events-auto">
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 pointer-events-none" />
            <input
              type="text"
              placeholder="Find character..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-950 text-xs text-slate-200 pl-7 pr-3 py-1 rounded border border-slate-700/60 focus:outline-none focus:border-indigo-500 w-36"
            />
            {searchMatches.length > 0 && searchQuery && (
              <div className="absolute top-8 left-0 w-44 bg-slate-900 border border-slate-700 rounded-lg shadow-xl max-h-40 overflow-y-auto z-30">
                {searchMatches.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => {
                      onSelectCharacter(m.id);
                      setSearchQuery('');
                    }}
                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-800 text-slate-200 border-b border-slate-800/50"
                  >
                    {m.canonicalName}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 bg-slate-900/90 backdrop-blur-md p-1 rounded-lg border border-slate-800 pointer-events-auto">
          <button
            onClick={togglePhysics}
            className={`p-1.5 rounded text-xs ${
              isPhysicsRunning ? 'bg-indigo-600/30 text-indigo-300' : 'text-slate-400 hover:text-white'
            }`}
            title="Toggle Physics"
          >
            {isPhysicsRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={() => handleZoom(1.25)}
            className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => handleZoom(0.8)}
            className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleResetZoom}
            className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800"
            title="Reset View"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* SVG Canvas */}
      <div ref={containerRef} className="w-full h-full flex-1 cursor-default select-none">
        <svg ref={svgRef} className="w-full h-full bg-slate-950" />
      </div>

      {/* Bottom Legend */}
      <div className="absolute bottom-3 left-3 right-3 z-10 flex items-center justify-between pointer-events-none">
        <div className="flex flex-wrap items-center gap-2 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-800 pointer-events-auto text-[11px]">
          <span className="text-[10px] font-bold text-slate-400 uppercase">Relations:</span>
          {Object.entries(RELATION_COLORS).map(([type, color]) => (
            <div key={type} className="flex items-center gap-1 text-slate-300 capitalize">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
              <span>{type.replace('_', ' ')}</span>
            </div>
          ))}
        </div>

        <div className="hidden sm:flex items-center gap-1 text-[11px] text-slate-400 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-800">
          <Info className="w-3 h-3 text-slate-400" />
          <span>Click character or edge to inspect</span>
        </div>
      </div>
    </div>
  );
};
