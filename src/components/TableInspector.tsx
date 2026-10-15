import React, { useState } from 'react';
import { CharacterNode, RelationshipEdge } from '../types/cres';
import { User, Users, ArrowRight, Grid, ChevronDown, ChevronUp } from 'lucide-react';

interface TableInspectorProps {
  characters: CharacterNode[];
  relationships: RelationshipEdge[];
  onSelectCharacter: (id: string) => void;
  onSelectEdge: (id: string) => void;
}

export const TableInspector: React.FC<TableInspectorProps> = ({
  characters,
  relationships,
  onSelectCharacter,
  onSelectEdge,
}) => {
  const [showHeatmap, setShowHeatmap] = useState<boolean>(true);

  // Display-group → badge classes
  const GROUP_BADGE: Record<string, string> = {
    kinship             : 'bg-emerald-950/70 border-emerald-700 text-emerald-300',
    romantic            : 'bg-rose-950/70 border-rose-700 text-rose-300',
    adversarial         : 'bg-red-950/70 border-red-700 text-red-300',
    hierarchical        : 'bg-amber-950/70 border-amber-700 text-amber-300',
    alliance            : 'bg-cyan-950/70 border-cyan-700 text-cyan-300',
    neutral_interaction : 'bg-slate-800 border-slate-700 text-slate-300',
  };

  // Resolve display group from any fine-grained label
  const FINE_TO_GROUP: Record<string, string> = {
    sibling: 'kinship', 'parent-child': 'kinship', spouse: 'kinship',
    family: 'kinship', cousin: 'kinship', kin: 'kinship',
    romantic: 'romantic', 'love-interest': 'romantic', betrothed: 'romantic',
    enemy: 'adversarial', rival: 'adversarial', antagonist: 'adversarial', foe: 'adversarial',
    'employer-employee': 'hierarchical', 'master-servant': 'hierarchical',
    'mentor-student': 'hierarchical', 'lawyer-client': 'hierarchical',
    friend: 'alliance', ally: 'alliance', confidant: 'alliance', comrade: 'alliance',
    acquaintance: 'neutral_interaction', 'no-relation': 'neutral_interaction',
    neutral_interaction: 'neutral_interaction',
  };

  function resolveGroup(fine: string): string {
    const k = fine.toLowerCase().trim();
    if (FINE_TO_GROUP[k]) return FINE_TO_GROUP[k];
    if (k.includes('sib') || k.includes('parent') || k.includes('child') || k.includes('spous')) return 'kinship';
    if (k.includes('love') || k.includes('roman') || k.includes('fianc')) return 'romantic';
    if (k.includes('enem') || k.includes('rival') || k.includes('antag') || k.includes('advers')) return 'adversarial';
    if (k.includes('employ') || k.includes('serv') || k.includes('mentor')) return 'hierarchical';
    if (k.includes('friend') || k.includes('ally') || k.includes('confid')) return 'alliance';
    return 'neutral_interaction';
  }

  function getBadgeClass(fineLabel: string): string {
    return GROUP_BADGE[resolveGroup(fineLabel)] || GROUP_BADGE.neutral_interaction;
  }

  // Build lookup map for quick matrix lookup
  const edgeLookup = new Map<string, RelationshipEdge>();
  relationships.forEach((r) => {
    edgeLookup.set(`${r.source}:${r.target}`, r);
    edgeLookup.set(`${r.target}:${r.source}`, r);
  });

  return (
    <div className="h-full flex flex-col gap-4 bg-slate-950 overflow-y-auto p-4">
      {/* 1. Co-occurrence Heatmap Matrix Section */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 shadow-md">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 mb-3">
          <div className="flex items-center gap-2">
            <Grid className="w-4 h-4 text-amber-400" />
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-200">
              Co-occurrence Interaction Heatmap ({characters.length} × {characters.length})
            </h3>
          </div>
          <button
            onClick={() => setShowHeatmap(!showHeatmap)}
            className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
          >
            <span>{showHeatmap ? 'Collapse Heatmap' : 'Expand Heatmap'}</span>
            {showHeatmap ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {showHeatmap && (
          <div className="overflow-x-auto pb-2">
            <table className="border-collapse text-xs select-none">
              <thead>
                <tr>
                  <th className="p-2 border border-slate-800 text-left font-mono text-[10px] text-slate-400 min-w-28 bg-slate-950/60">
                    Character
                  </th>
                  {characters.map((c) => (
                    <th
                      key={c.id}
                      className="p-2 border border-slate-800 font-mono text-[10px] text-slate-300 text-center min-w-16 max-w-20 truncate bg-slate-950/60"
                      title={c.canonicalName}
                    >
                      {c.canonicalName.split(' ')[0]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {characters.map((rowChar) => (
                  <tr key={rowChar.id}>
                    <td
                      onClick={() => onSelectCharacter(rowChar.id)}
                      className="p-2 border border-slate-800 font-semibold text-slate-300 text-left whitespace-nowrap bg-slate-950/40 hover:text-indigo-400 cursor-pointer"
                    >
                      {rowChar.canonicalName}
                    </td>
                    {characters.map((colChar) => {
                      const isSelf = rowChar.id === colChar.id;
                      const edge = edgeLookup.get(`${rowChar.id}:${colChar.id}`);
                      const count = edge ? edge.weight || 1 : 0;

                      let cellBg = 'bg-slate-950/40 text-slate-600';
                      if (isSelf) {
                        cellBg = 'bg-slate-800/40 text-slate-500 font-mono';
                      } else if (count >= 4) {
                        cellBg = 'bg-amber-500 text-slate-950 font-bold';
                      } else if (count >= 2) {
                        cellBg = 'bg-amber-600/50 text-amber-200 font-semibold';
                      } else if (count >= 1) {
                        cellBg = 'bg-indigo-900/50 text-indigo-200';
                      }

                      return (
                        <td
                          key={colChar.id}
                          onClick={() => {
                            if (edge) onSelectEdge(edge.id);
                            else if (!isSelf) onSelectCharacter(rowChar.id);
                          }}
                          className={`p-2 border border-slate-800 text-center font-mono ${cellBg} ${
                            edge ? 'cursor-pointer hover:ring-1 hover:ring-amber-400' : ''
                          }`}
                          title={
                            isSelf
                              ? `${rowChar.canonicalName}`
                              : edge
                              ? `${rowChar.canonicalName} & ${colChar.canonicalName}: ${count} interactions (${edge.relationType})`
                              : `${rowChar.canonicalName} & ${colChar.canonicalName}: 0 interactions`
                          }
                        >
                          {isSelf ? '—' : count}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 2. Side-by-Side: Characters & Relationships */}
      <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-[420px]">
        {/* Column 1: Characters & Aliases */}
        <div className="flex-1 bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col">
          <div className="flex items-center gap-2 mb-3 border-b border-slate-800 pb-2">
            <User className="w-4 h-4 text-indigo-400" />
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-300">
              Identified Characters ({characters.length})
            </h3>
          </div>

          <div className="space-y-2.5 overflow-y-auto flex-1 pr-1">
            {characters.map((c) => (
              <div
                key={c.id}
                onClick={() => onSelectCharacter(c.id)}
                className="p-3 rounded-lg bg-slate-950/70 border border-slate-800/80 hover:border-slate-700 cursor-pointer transition-colors space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: c.color || '#6366f1' }}
                    />
                    <span className="font-bold text-xs text-white">{c.canonicalName}</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-indigo-300 font-medium">
                    {c.primaryRole}
                  </span>
                </div>

                {c.aliases && c.aliases.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    <span className="text-[10px] text-slate-500">Aliases:</span>
                    {c.aliases.map((a, i) => (
                      <span
                        key={i}
                        className="px-1.5 py-0.2 rounded bg-slate-900 text-[10px] text-slate-400 font-mono"
                      >
                        "{a}"
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 font-mono">
                  <span>Degree: {c.centrality?.degree || 0}</span>
                  <span>Betweenness: {c.centrality?.betweenness?.toFixed?.(3) || '0.000'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Column 2: Extracted Relationships & Evidence */}
        <div className="flex-1 bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col">
          <div className="flex items-center gap-2 mb-3 border-b border-slate-800 pb-2">
            <Users className="w-4 h-4 text-pink-400" />
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-300">
              Classified Relationships ({relationships.length})
            </h3>
          </div>

          <div className="space-y-2.5 overflow-y-auto flex-1 pr-1">
            {relationships.map((r) => {
              const srcName = characters.find((c) => c.id === r.source)?.canonicalName || r.source;
              const tgtName = characters.find((c) => c.id === r.target)?.canonicalName || r.target;

              return (
                <div
                  key={r.id}
                  onClick={() => onSelectEdge(r.id)}
                  className="p-3 rounded-lg bg-slate-950/70 border border-slate-800/80 hover:border-slate-700 cursor-pointer transition-colors space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
                      <span className="text-indigo-300">{srcName}</span>
                      <ArrowRight className="w-3 h-3 text-slate-500" />
                      <span className="text-pink-300">{tgtName}</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full border capitalize font-medium ${
                          getBadgeClass(r.relationType)
                        }`}
                      >
                        {r.relationType.replace(/-/g, '\u2011').replace(/_/g, ' ')}
                      </span>
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900 ${
                          r.sentiment > 0.05
                            ? 'text-emerald-400'
                            : r.sentiment < -0.05
                            ? 'text-rose-400'
                            : 'text-slate-400'
                        }`}
                      >
                        {r.sentiment > 0 ? `+${r.sentiment}` : r.sentiment}
                      </span>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-300 italic">{r.summary}</p>

                  {r.evidenceQuotes && r.evidenceQuotes.length > 0 && (
                    <div className="text-[11px] text-slate-400 font-serif border-l-2 border-slate-700 pl-2 leading-relaxed">
                      "{r.evidenceQuotes[0]}"
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
