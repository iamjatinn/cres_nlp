import React from 'react';
import { CharacterNode, RelationshipEdge } from '../types/cres';
import { X, ArrowRight, Quote, FileText, Activity, ShieldCheck } from 'lucide-react';

interface EdgeDetailPanelProps {
  edge: RelationshipEdge;
  allCharacters: CharacterNode[];
  onClose: () => void;
  onSelectCharacter: (id: string) => void;
}

export const EdgeDetailPanel: React.FC<EdgeDetailPanelProps> = ({
  edge,
  allCharacters,
  onClose,
  onSelectCharacter,
}) => {
  const sourceChar = allCharacters.find((c) => c.id === edge.source);
  const targetChar = allCharacters.find((c) => c.id === edge.target);

  if (!sourceChar || !targetChar) return null;

  const relationBadgeColors: Record<string, { bg: string; text: string; border: string }> = {
    kinship: { bg: 'bg-emerald-950/80', text: 'text-emerald-300', border: 'border-emerald-700' },
    romantic: { bg: 'bg-rose-950/80', text: 'text-rose-300', border: 'border-rose-700' },
    adversarial: { bg: 'bg-red-950/80', text: 'text-red-300', border: 'border-red-700' },
    hierarchical: { bg: 'bg-amber-950/80', text: 'text-amber-300', border: 'border-amber-700' },
    alliance: { bg: 'bg-cyan-950/80', text: 'text-cyan-300', border: 'border-cyan-700' },
    neutral_interaction: { bg: 'bg-slate-800', text: 'text-slate-300', border: 'border-slate-700' },
  };

  const badge = relationBadgeColors[edge.relationType] || relationBadgeColors.neutral_interaction;

  return (
    <div className="h-full flex flex-col bg-slate-900 border-l border-slate-800 text-slate-100 overflow-y-auto w-80 lg:w-96 shadow-2xl">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 flex items-start justify-between bg-slate-950/60 sticky top-0 z-10 backdrop-blur-md">
        <div>
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Relationship Inspector</span>
          <div className="flex items-center gap-2 mt-1">
            <button
              onClick={() => onSelectCharacter(sourceChar.id)}
              className="font-bold text-sm text-indigo-400 hover:underline"
            >
              {sourceChar.canonicalName}
            </button>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <button
              onClick={() => onSelectCharacter(targetChar.id)}
              className="font-bold text-sm text-pink-400 hover:underline"
            >
              {targetChar.canonicalName}
            </button>
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
        {/* Classification Badge & Summary */}
        <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span
              className={`text-xs font-semibold px-2.5 py-1 rounded-full border capitalize ${badge.bg} ${badge.text} ${badge.border}`}
            >
              {edge.relationType.replace('_', ' ')}
            </span>
            <span className="text-[11px] text-slate-400 capitalize font-mono">
              {edge.directionality} edge
            </span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed italic">{edge.summary}</p>
        </div>

        {/* Interaction Weight */}
        <div className="bg-slate-950/80 p-2.5 rounded-lg border border-slate-800 flex items-center justify-between text-xs">
          <span className="text-slate-400">Interaction Frequency (Weight):</span>
          <span className="font-mono text-sm font-bold text-white">{edge.weight}</span>
        </div>

        {/* Sentiment Gauge */}
        <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-slate-400 text-[11px] font-medium">Relational Sentiment Polarity</span>
            <span
              className={`font-mono font-bold text-xs ${
                edge.sentiment > 0.05 ? 'text-emerald-400' : edge.sentiment < -0.05 ? 'text-rose-400' : 'text-slate-300'
              }`}
            >
              {edge.sentiment > 0 ? `+${edge.sentiment}` : edge.sentiment} ({edge.sentiment > 0.2 ? 'Affectionate / Supportive' : edge.sentiment < -0.2 ? 'Hostile / Antagonistic' : 'Neutral / Formal'})
            </span>
          </div>

          <div className="relative w-full h-2.5 bg-slate-800 rounded-full overflow-hidden mt-2">
            {/* Center zero line */}
            <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-slate-600 z-10" />
            {edge.sentiment >= 0 ? (
              <div
                className="absolute top-0 bottom-0 bg-emerald-500 rounded-r-full left-1/2 transition-all"
                style={{ width: `${Math.min(50, (edge.sentiment / 1.0) * 50)}%` }}
              />
            ) : (
              <div
                className="absolute top-0 bottom-0 bg-rose-500 rounded-l-full right-1/2 transition-all"
                style={{ width: `${Math.min(50, (Math.abs(edge.sentiment) / 1.0) * 50)}%` }}
              />
            )}
          </div>
          <div className="flex justify-between text-[9px] text-slate-400 mt-1 font-mono">
            <span>-1.0 Hostile</span>
            <span>0.0 Neutral</span>
            <span>+1.0 Harmonious</span>
          </div>
        </div>

        {/* Textual Evidence Quotes */}
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Quote className="w-3.5 h-3.5 text-amber-400" />
              <span>Textual Evidence Snippets ({edge.evidenceQuotes.length})</span>
            </span>
          </div>

          <div className="space-y-2.5">
            {edge.evidenceQuotes.map((quote, idx) => (
              <div
                key={idx}
                className="p-3 rounded-lg bg-slate-950/70 border border-slate-800/80 text-xs text-slate-300 leading-relaxed font-serif relative"
              >
                <span className="text-amber-500/40 text-lg absolute -top-1 left-1.5">“</span>
                <p className="pl-3">{quote}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Confidence rating */}
        <div className="flex items-center justify-between text-[11px] text-slate-400 p-2.5 rounded-lg bg-slate-950/50 border border-slate-800/60">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Classification Confidence:</span>
          </span>
          <span className="font-mono text-emerald-400 font-bold">{(edge.confidence * 100).toFixed(0)}%</span>
        </div>
      </div>
    </div>
  );
};
