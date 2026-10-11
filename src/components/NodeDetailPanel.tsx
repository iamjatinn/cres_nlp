import React from 'react';
import { CharacterNode, RelationshipEdge, CommunityGroup } from '../types/cres';
import { X, User, GitBranch, Heart, Shield, Swords, Crown, Users, Sparkles, MessageSquare } from 'lucide-react';

interface NodeDetailPanelProps {
  character: CharacterNode;
  allCharacters: CharacterNode[];
  relationships: RelationshipEdge[];
  communities: CommunityGroup[];
  onClose: () => void;
  onSelectCharacter: (id: string) => void;
  onSelectEdge: (id: string) => void;
}

export const NodeDetailPanel: React.FC<NodeDetailPanelProps> = ({
  character,
  allCharacters,
  relationships,
  communities,
  onClose,
  onSelectCharacter,
  onSelectEdge,
}) => {
  // Find all edges connected to this character
  const connectedEdges = relationships.filter(
    (e) => e.source === character.id || e.target === character.id
  );

  const community = communities.find((c) => c.id === character.communityId);

  // Compute sentiment breakdown
  const avgSentiment =
    connectedEdges.length > 0
      ? connectedEdges.reduce((sum, e) => sum + e.sentiment, 0) / connectedEdges.length
      : 0;

  return (
    <div className="h-full flex flex-col bg-slate-900 border-l border-slate-800 text-slate-100 overflow-y-auto w-80 lg:w-96 shadow-2xl">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 flex items-start justify-between bg-slate-950/60 sticky top-0 z-10 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shadow-lg text-sm"
            style={{ backgroundColor: character.color || '#6366f1' }}
          >
            {character.canonicalName.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h3 className="font-bold text-base text-white leading-tight">{character.canonicalName}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-indigo-300 font-medium">
                {character.primaryRole}
              </span>
              <span className="text-[11px] text-slate-400 capitalize">{character.gender}</span>
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-5 flex-1">
        {/* Resolved Aliases & Coreferences */}
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-indigo-400" />
            <span>Resolved Aliases & Mentions ({character.aliases.length})</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {character.aliases.map((alias, idx) => (
              <span
                key={idx}
                className="px-2.5 py-1 rounded-md bg-slate-800/80 border border-slate-700/60 text-xs text-slate-300 font-mono"
              >
                "{alias}"
              </span>
            ))}
          </div>
          <div className="mt-2 text-xs text-slate-400">
            Total Narrative Mentions: <strong className="text-white font-mono">{character.mentionsCount}</strong>
          </div>
        </div>

        {/* Network Centrality Metrics (Degree & Betweenness) */}
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2.5 flex items-center gap-1.5">
            <GitBranch className="w-3.5 h-3.5 text-cyan-400" />
            <span>Graph Centrality (Computed via Python)</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-slate-950/80 p-2.5 rounded-lg border border-slate-800">
              <span className="text-[10px] text-slate-400 block">Degree Centrality</span>
              <span className="font-mono text-base font-bold text-indigo-400">
                {character.centrality?.degree || 0}
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Connected characters</span>
            </div>

            <div className="bg-slate-950/80 p-2.5 rounded-lg border border-slate-800">
              <span className="text-[10px] text-slate-400 block">Betweenness (Bridge)</span>
              <span className="font-mono text-base font-bold text-emerald-400">
                {(character.centrality?.betweenness || 0.0).toFixed(3)}
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Plot bridge score</span>
            </div>
          </div>
        </div>

        {/* Narrative Sentiment Polarity */}
        <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-slate-400 text-[11px] font-medium">Average Relational Sentiment</span>
            <span
              className={`font-mono font-bold text-xs ${
                avgSentiment > 0.1 ? 'text-emerald-400' : avgSentiment < -0.1 ? 'text-rose-400' : 'text-slate-300'
              }`}
            >
              {avgSentiment > 0 ? `+${avgSentiment.toFixed(2)}` : avgSentiment.toFixed(2)}
            </span>
          </div>
          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden relative">
            <div
              className={`h-full rounded-full transition-all ${
                avgSentiment > 0 ? 'bg-emerald-500' : avgSentiment < 0 ? 'bg-rose-500' : 'bg-slate-600'
              }`}
              style={{
                width: `${Math.min(100, Math.max(10, Math.abs(avgSentiment) * 100))}%`,
              }}
            />
          </div>
        </div>

        {/* Direct Connections List */}
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-emerald-400" />
              <span>Direct Character Ties ({connectedEdges.length})</span>
            </span>
          </div>

          <div className="space-y-2">
            {connectedEdges.map((edge) => {
              const otherCharId = edge.source === character.id ? edge.target : edge.source;
              const otherChar = allCharacters.find((c) => c.id === otherCharId);
              if (!otherChar) return null;

              const relationBadgeColors: Record<string, string> = {
                kinship: 'bg-emerald-950/70 border-emerald-800 text-emerald-300',
                romantic: 'bg-rose-950/70 border-rose-800 text-rose-300',
                adversarial: 'bg-red-950/70 border-red-800 text-red-300',
                hierarchical: 'bg-amber-950/70 border-amber-800 text-amber-300',
                alliance: 'bg-cyan-950/70 border-cyan-800 text-cyan-300',
                neutral_interaction: 'bg-slate-800 border-slate-700 text-slate-300',
              };

              return (
                <div
                  key={edge.id}
                  className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800 hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => onSelectCharacter(otherChar.id)}
                      className="font-semibold text-xs text-white hover:text-indigo-400 text-left transition-colors"
                    >
                      {otherChar.canonicalName}
                    </button>
                    <span
                      className={`text-[10px] font-medium px-2 py-0.5 rounded-full border capitalize ${
                        relationBadgeColors[edge.relationType] || 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {edge.relationType.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1.5">
                    <span>
                      Weight: <strong className="text-white font-mono">{edge.weight}</strong>
                    </span>
                    <span
                      className={`font-mono text-[10px] ${
                        edge.sentiment > 0.1 ? 'text-emerald-400' : edge.sentiment < -0.1 ? 'text-rose-400' : 'text-slate-400'
                      }`}
                    >
                      Sentiment: {edge.sentiment > 0 ? `+${edge.sentiment}` : edge.sentiment}
                    </span>
                    <button
                      onClick={() => onSelectEdge(edge.id)}
                      className="text-indigo-400 hover:text-indigo-300 underline text-[10px]"
                    >
                      Inspect Evidence
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
