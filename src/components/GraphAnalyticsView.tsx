import React from 'react';
import { CRESResult, CharacterNode } from '../types/cres';
import { GitBranch, BarChart3, Users, Zap, Shield, Compass, Network, Award } from 'lucide-react';

interface GraphAnalyticsViewProps {
  result: CRESResult;
  onSelectCharacter: (id: string) => void;
}

export const GraphAnalyticsView: React.FC<GraphAnalyticsViewProps> = ({
  result,
  onSelectCharacter,
}) => {
  const { characters, relationships, metrics, communities } = result;

  // Sorted rankings
  const byDegree = [...characters].sort((a, b) => b.centrality.degree - a.centrality.degree);
  const byBetweenness = [...characters].sort((a, b) => b.centrality.betweenness - a.centrality.betweenness);
  const byCloseness = [...characters].sort((a, b) => b.centrality.closeness - a.centrality.closeness);
  const byPageRank = [...characters].sort((a, b) => b.centrality.pagerank - a.centrality.pagerank);

  return (
    <div className="h-full flex flex-col bg-slate-950 border border-slate-800 rounded-xl overflow-y-auto p-5 text-slate-100 shadow-2xl space-y-6">
      {/* Top Overview Cards */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Network className="w-5 h-5 text-indigo-400" />
          <h3 className="font-bold text-base text-white">Network Topology & Structural Metrics</h3>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Entities</span>
            <span className="font-mono text-xl font-bold text-white mt-1 block">{metrics.nodeCount}</span>
            <span className="text-[10px] text-slate-400">Characters</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Edges</span>
            <span className="font-mono text-xl font-bold text-indigo-400 mt-1 block">{metrics.edgeCount}</span>
            <span className="text-[10px] text-slate-400">Interactions</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Graph Density</span>
            <span className="font-mono text-xl font-bold text-emerald-400 mt-1 block">{metrics.density}</span>
            <span className="text-[10px] text-slate-400">Cohesion ratio</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Average Degree</span>
            <span className="font-mono text-xl font-bold text-amber-400 mt-1 block">{metrics.averageDegree}</span>
            <span className="text-[10px] text-slate-400">Ties / character</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Graph Diameter</span>
            <span className="font-mono text-xl font-bold text-pink-400 mt-1 block">{metrics.diameter}</span>
            <span className="text-[10px] text-slate-400">Max shortest path</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Communities</span>
            <span className="font-mono text-xl font-bold text-cyan-400 mt-1 block">{metrics.communitiesCount}</span>
            <span className="text-[10px] text-slate-400">Modularity: {metrics.modularityScore}</span>
          </div>
        </div>
      </div>

      {/* Structural Key Characters: Hub vs Bridge */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 rounded-xl bg-gradient-to-br from-indigo-950/40 to-slate-900/60 border border-indigo-900/40 flex items-start gap-3.5">
          <div className="p-2.5 rounded-lg bg-indigo-500/20 text-indigo-400">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] uppercase font-bold text-indigo-300">Central Hub Character</span>
            <h4 className="font-bold text-lg text-white mt-0.5">{metrics.topHub}</h4>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
              Maintains the highest number of direct co-occurrences and relationships. Acts as the primary anchor around whom the majority of narrative scenes revolve.
            </p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-950/40 to-slate-900/60 border border-emerald-900/40 flex items-start gap-3.5">
          <div className="p-2.5 rounded-lg bg-emerald-500/20 text-emerald-400">
            <GitBranch className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] uppercase font-bold text-emerald-300">Key Narrative Bridge (Broker)</span>
            <h4 className="font-bold text-lg text-white mt-0.5">{metrics.topBridge}</h4>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
              Highest betweenness centrality score. Controls information and conflict flow between disparate factions or social circles that do not otherwise interact directly.
            </p>
          </div>
        </div>
      </div>

      {/* Centrality Rankings Columns */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="w-5 h-5 text-cyan-400" />
          <h3 className="font-bold text-base text-white">Character Centrality Leaderboards</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Degree Centrality */}
          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2.5">
            <div className="border-b border-slate-800 pb-2">
              <h4 className="text-xs font-bold uppercase text-indigo-300">Degree Centrality</h4>
              <p className="text-[10px] text-slate-400">Direct relationship count</p>
            </div>
            <div className="space-y-1.5">
              {byDegree.slice(0, 6).map((c, i) => (
                <div
                  key={c.id}
                  onClick={() => onSelectCharacter(c.id)}
                  className="flex items-center justify-between text-xs p-1.5 rounded hover:bg-slate-800/60 cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-slate-400 font-bold">{i + 1}.</span>
                    <span className="font-medium text-slate-200">{c.canonicalName}</span>
                  </span>
                  <span className="font-mono font-bold text-indigo-400">{c.centrality.degree}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Betweenness Centrality */}
          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2.5">
            <div className="border-b border-slate-800 pb-2">
              <h4 className="text-xs font-bold uppercase text-emerald-300">Betweenness (Brandes)</h4>
              <p className="text-[10px] text-slate-400">Shortest path gatekeeper</p>
            </div>
            <div className="space-y-1.5">
              {byBetweenness.slice(0, 6).map((c, i) => (
                <div
                  key={c.id}
                  onClick={() => onSelectCharacter(c.id)}
                  className="flex items-center justify-between text-xs p-1.5 rounded hover:bg-slate-800/60 cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-slate-400 font-bold">{i + 1}.</span>
                    <span className="font-medium text-slate-200">{c.canonicalName}</span>
                  </span>
                  <span className="font-mono font-bold text-emerald-400">
                    {c.centrality.betweenness.toFixed(3)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Closeness Centrality */}
          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2.5">
            <div className="border-b border-slate-800 pb-2">
              <h4 className="text-xs font-bold uppercase text-amber-300">Closeness Centrality</h4>
              <p className="text-[10px] text-slate-400">Global network reachability</p>
            </div>
            <div className="space-y-1.5">
              {byCloseness.slice(0, 6).map((c, i) => (
                <div
                  key={c.id}
                  onClick={() => onSelectCharacter(c.id)}
                  className="flex items-center justify-between text-xs p-1.5 rounded hover:bg-slate-800/60 cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-slate-400 font-bold">{i + 1}.</span>
                    <span className="font-medium text-slate-200">{c.canonicalName}</span>
                  </span>
                  <span className="font-mono font-bold text-amber-400">
                    {c.centrality.closeness.toFixed(3)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* PageRank Prestige */}
          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2.5">
            <div className="border-b border-slate-800 pb-2">
              <h4 className="text-xs font-bold uppercase text-pink-300">PageRank Prestige</h4>
              <p className="text-[10px] text-slate-400">Recursive tie prominence</p>
            </div>
            <div className="space-y-1.5">
              {byPageRank.slice(0, 6).map((c, i) => (
                <div
                  key={c.id}
                  onClick={() => onSelectCharacter(c.id)}
                  className="flex items-center justify-between text-xs p-1.5 rounded hover:bg-slate-800/60 cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-slate-400 font-bold">{i + 1}.</span>
                    <span className="font-medium text-slate-200">{c.canonicalName}</span>
                  </span>
                  <span className="font-mono font-bold text-pink-400">
                    {c.centrality.pagerank.toFixed(3)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Community / Factions Breakdown */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Users className="w-5 h-5 text-indigo-400" />
          <h3 className="font-bold text-base text-white">Detected Communities & Narrative Factions</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {communities.map((comm) => (
            <div
              key={comm.id}
              className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2.5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="w-3.5 h-3.5 rounded-full ring-2 ring-slate-800"
                    style={{ backgroundColor: comm.color }}
                  />
                  <h4 className="font-bold text-sm text-white">{comm.name}</h4>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                  {comm.members.length} members
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {comm.members.map((mName, mIdx) => (
                  <span
                    key={mIdx}
                    className="px-2 py-0.5 rounded-md bg-slate-950 text-xs text-slate-300 border border-slate-800"
                  >
                    {mName}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
