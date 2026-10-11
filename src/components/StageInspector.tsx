import React, { useState } from 'react';
import {
  CRESResult,
  CharacterNode,
  RelationshipEdge,
  EntityMention,
  RelationCategory,
} from '../types/cres';
import {
  Layers,
  UserCheck,
  Split,
  Grid,
  Quote,
  Search,
  Plus,
  ArrowRight,
  Sparkles,
  CheckCircle,
  HelpCircle,
  Edit2,
} from 'lucide-react';

interface StageInspectorProps {
  result: CRESResult;
  onUpdateCharacter: (updated: CharacterNode) => void;
  onSelectCharacter: (id: string) => void;
  onSelectEdge: (id: string) => void;
}

export const StageInspector: React.FC<StageInspectorProps> = ({
  result,
  onUpdateCharacter,
  onSelectCharacter,
  onSelectEdge,
}) => {
  const [activeStage, setActiveStage] = useState<'stage1' | 'stage2' | 'stage3' | 'stage4'>('stage1');
  const [filterRelation, setFilterRelation] = useState<string>('all');
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [editingCharId, setEditingCharId] = useState<string | null>(null);
  const [newAliasInput, setNewAliasInput] = useState<string>('');

  const { characters, relationships, mentions, paragraphs, interactionWindows, coOccurrenceMatrix } = result;

  // Handle adding an alias manually to a character cluster
  const handleAddAlias = (charId: string) => {
    if (!newAliasInput.trim()) return;
    const char = characters.find((c) => c.id === charId);
    if (!char) return;

    if (!char.aliases.includes(newAliasInput.trim())) {
      const updated: CharacterNode = {
        ...char,
        aliases: [...char.aliases, newAliasInput.trim()],
      };
      onUpdateCharacter(updated);
    }
    setNewAliasInput('');
    setEditingCharId(null);
  };

  return (
    <div className="h-full flex flex-col bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
      {/* Stage Tab Navigation */}
      <div className="flex border-b border-slate-800 bg-slate-900/80 backdrop-blur-md px-3 pt-2 gap-2 overflow-x-auto">
        <button
          onClick={() => setActiveStage('stage1')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-all border-b-2 ${
            activeStage === 'stage1'
              ? 'border-indigo-500 text-white bg-slate-950 shadow-inner'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
          }`}
        >
          <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 font-mono text-[10px] flex items-center justify-center font-bold">
            1
          </span>
          <span>NER & Mentions</span>
          <span className="text-[10px] text-slate-400 font-mono">({mentions.length})</span>
        </button>

        <button
          onClick={() => setActiveStage('stage2')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-all border-b-2 ${
            activeStage === 'stage2'
              ? 'border-cyan-500 text-white bg-slate-950 shadow-inner'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
          }`}
        >
          <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 font-mono text-[10px] flex items-center justify-center font-bold">
            2
          </span>
          <span>Coreference & Alias Clusters</span>
          <span className="text-[10px] text-slate-400 font-mono">({characters.length})</span>
        </button>

        <button
          onClick={() => setActiveStage('stage3')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-all border-b-2 ${
            activeStage === 'stage3'
              ? 'border-amber-500 text-white bg-slate-950 shadow-inner'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
          }`}
        >
          <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 font-mono text-[10px] flex items-center justify-center font-bold">
            3
          </span>
          <span>Co-occurrence Matrix & Windows</span>
          <span className="text-[10px] text-slate-400 font-mono">({interactionWindows.length})</span>
        </button>

        <button
          onClick={() => setActiveStage('stage4')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-all border-b-2 ${
            activeStage === 'stage4'
              ? 'border-pink-500 text-white bg-slate-950 shadow-inner'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
          }`}
        >
          <span className="w-5 h-5 rounded-full bg-pink-500/20 text-pink-400 font-mono text-[10px] flex items-center justify-center font-bold">
            4
          </span>
          <span>Relation Extraction & Evidence</span>
          <span className="text-[10px] text-slate-400 font-mono">({relationships.length})</span>
        </button>
      </div>

      {/* Main Tab Content */}
      <div className="flex-1 overflow-y-auto p-4 text-slate-200 bg-slate-950">
        {/* ================= STAGE 1: NER & MENTIONS ================= */}
        {activeStage === 'stage1' && (
          <div className="space-y-5">
            <div className="bg-slate-900/60 p-3.5 rounded-lg border border-slate-800 text-xs text-slate-300 flex items-start gap-3">
              <UserCheck className="w-4 h-4 text-indigo-400 mt-0.5 flex-shrink-0" />
              <div>
                <strong className="text-white">Stage 1: Named Entity Recognition (NER)</strong>
                <p className="text-slate-400 mt-0.5">
                  Identifies proper noun character candidates, strips honorifics (Mr., Mrs., Lord, Lady, Dr.), detects dialogue attribution tags, and filters non-character proper nouns (places, months, days).
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Mentions Leaderboard */}
              <div className="bg-slate-900/50 p-3.5 rounded-lg border border-slate-800 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Extracted Surface Tokens ({mentions.length})
                </h4>
                <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
                  {mentions.slice(0, 35).map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between text-xs p-2 rounded bg-slate-950/70 border border-slate-800/80"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold text-indigo-300">"{m.surfaceText}"</span>
                        <span className="text-[10px] text-slate-400">→ {m.canonicalName}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">
                        P{m.paragraphIndex + 1}:S{m.sentenceIndex + 1}
                      </span>
                    </div>
                  ))}
                  {mentions.length > 35 && (
                    <div className="text-[11px] text-slate-400 text-center py-1">
                      + {mentions.length - 35} more surface mentions
                    </div>
                  )}
                </div>
              </div>

              {/* Annotated Text View */}
              <div className="lg:col-span-2 bg-slate-900/50 p-3.5 rounded-lg border border-slate-800 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Annotated Narrative Passage
                </h4>
                <div className="space-y-3 max-h-96 overflow-y-auto pr-2 text-xs leading-relaxed font-serif text-slate-300">
                  {paragraphs.slice(0, 10).map((para, pIdx) => {
                    const paraMentions = mentions.filter((m) => m.paragraphIndex === pIdx);
                    return (
                      <div key={pIdx} className="p-2.5 rounded bg-slate-950/40 border border-slate-800/40">
                        <span className="text-[10px] text-slate-400 font-mono font-bold block mb-1">
                          Paragraph {pIdx + 1} ({paraMentions.length} entities):
                        </span>
                        <p className="text-slate-200">
                          {para}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= STAGE 2: COREFERENCE & ALIAS CLUSTERS ================= */}
        {activeStage === 'stage2' && (
          <div className="space-y-5">
            <div className="bg-slate-900/60 p-3.5 rounded-lg border border-slate-800 text-xs text-slate-300 flex items-start gap-3">
              <Split className="w-4 h-4 text-cyan-400 mt-0.5 flex-shrink-0" />
              <div>
                <strong className="text-white">Stage 2: Coreference Resolution & Alias Clustering</strong>
                <p className="text-slate-400 mt-0.5">
                  Unifies surface variants, abbreviations, and nicknames (e.g. "Lizzy", "Elizabeth", "Miss Bennet") into canonical entity nodes via Jaro-Winkler string similarity, token containment, and nickname dictionaries.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {characters.map((char) => (
                <div
                  key={char.id}
                  className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-3 hover:border-slate-700 transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-white text-xs"
                          style={{ backgroundColor: char.color || '#6366f1' }}
                        >
                          {char.canonicalName.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <button
                            onClick={() => onSelectCharacter(char.id)}
                            className="font-bold text-sm text-white hover:text-cyan-400 transition-colors text-left"
                          >
                            {char.canonicalName}
                          </button>
                          <div className="text-[10px] text-slate-400 capitalize">
                            {char.primaryRole} • {char.gender}
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-cyan-300">
                        {char.mentionsCount} mentions
                      </span>
                    </div>

                    {/* Alias chips */}
                    <div className="mt-3">
                      <div className="text-[10px] uppercase font-bold text-slate-400 mb-1">
                        Resolved Surface Forms ({char.aliases.length}):
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {char.aliases.map((alias, aIdx) => (
                          <span
                            key={aIdx}
                            className="px-2 py-0.5 rounded bg-slate-950 text-[11px] text-slate-300 font-mono border border-slate-800"
                          >
                            "{alias}"
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Add Alias Tool */}
                  <div className="pt-2 border-t border-slate-800/80">
                    {editingCharId === char.id ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          placeholder="New alias name..."
                          value={newAliasInput}
                          onChange={(e) => setNewAliasInput(e.target.value)}
                          className="text-xs bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white flex-1 focus:outline-none focus:border-cyan-500"
                        />
                        <button
                          onClick={() => handleAddAlias(char.id)}
                          className="bg-cyan-600 hover:bg-cyan-500 text-white px-2 py-1 rounded text-xs font-semibold"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingCharId(null)}
                          className="text-slate-400 text-xs px-1 hover:text-white"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setEditingCharId(char.id);
                          setNewAliasInput('');
                        }}
                        className="text-[11px] text-slate-400 hover:text-cyan-300 flex items-center gap-1 transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Add alias variant</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ================= STAGE 3: CO-OCCURRENCE MATRIX & WINDOWS ================= */}
        {activeStage === 'stage3' && (
          <div className="space-y-5">
            <div className="bg-slate-900/60 p-3.5 rounded-lg border border-slate-800 text-xs text-slate-300 flex items-start gap-3">
              <Grid className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
              <div>
                <strong className="text-white">Stage 3: Co-occurrence Interaction Detection</strong>
                <p className="text-slate-400 mt-0.5">
                  Calculates scene/paragraph-level windowing co-occurrences to establish edge weights and narrative proximity.
                </p>
              </div>
            </div>

            {/* 2D Heatmap Matrix */}
            <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800 overflow-x-auto space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Co-occurrence Matrix Heatmap ({characters.length} x {characters.length})
              </h4>

              <table className="border-collapse text-xs">
                <thead>
                  <tr>
                    <th className="p-2 border border-slate-800 text-left font-mono text-[10px] text-slate-400 min-w-28">
                      Character
                    </th>
                    {characters.map((c) => (
                      <th
                        key={c.id}
                        className="p-2 border border-slate-800 font-mono text-[10px] text-slate-300 text-center min-w-16 max-w-20 truncate"
                        title={c.canonicalName}
                      >
                        {c.canonicalName.split(' ')[0]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {characters.map((rowChar, rIdx) => (
                    <tr key={rowChar.id}>
                      <td className="p-2 border border-slate-800 font-semibold text-slate-300 text-left whitespace-nowrap">
                        {rowChar.canonicalName}
                      </td>
                      {characters.map((colChar, cIdx) => {
                        const count = coOccurrenceMatrix.matrix[rIdx]?.[cIdx] || 0;
                        const isSelf = rIdx === cIdx;
                        let cellBg = 'bg-slate-950/40 text-slate-600';
                        if (isSelf) {
                          cellBg = 'bg-slate-800/30 text-slate-500 font-mono';
                        } else if (count > 4) {
                          cellBg = 'bg-amber-500/80 text-black font-bold';
                        } else if (count > 2) {
                          cellBg = 'bg-amber-600/40 text-amber-200 font-semibold';
                        } else if (count > 0) {
                          cellBg = 'bg-indigo-900/40 text-indigo-200';
                        }

                        return (
                          <td
                            key={colChar.id}
                            className={`p-2 border border-slate-800 text-center font-mono ${cellBg}`}
                            title={`${rowChar.canonicalName} & ${colChar.canonicalName}: ${count} co-occurrences`}
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

            {/* Interaction Windows Stream */}
            <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Scene Interaction Windows ({interactionWindows.length} detected multi-character scenes)
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-80 overflow-y-auto pr-1">
                {interactionWindows.map((win, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 text-xs space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-amber-400 font-bold">
                        Scene / Paragraph {win.paragraphIndex + 1}
                      </span>
                      <div className="flex gap-1">
                        {win.characters.map((cName, cIdx) => (
                          <span
                            key={cIdx}
                            className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-300 font-medium"
                          >
                            {cName.split(' ')[0]}
                          </span>
                        ))}
                      </div>
                    </div>
                    <p className="text-slate-300 italic font-serif leading-relaxed line-clamp-3">
                      "{win.snippet}"
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ================= STAGE 4: RELATION CLASSIFICATION & EVIDENCE ================= */}
        {activeStage === 'stage4' && (
          <div className="space-y-5">
            <div className="bg-slate-900/60 p-3.5 rounded-lg border border-slate-800 text-xs text-slate-300 flex items-start gap-3">
              <Quote className="w-4 h-4 text-pink-400 mt-0.5 flex-shrink-0" />
              <div>
                <strong className="text-white">Stage 4: Relation Classification & Textual Evidence</strong>
                <p className="text-slate-400 mt-0.5">
                  Classifies relational categories (kinship, romantic, adversarial, hierarchical, alliance), assigns sentiment polarity [-1.0 to 1.0], directionality, and links verbatim textual evidence passages.
                </p>
              </div>
            </div>

            {/* Relationship Filter Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-slate-400">Filter Category:</span>
                {['all', 'kinship', 'romantic', 'adversarial', 'hierarchical', 'alliance', 'neutral_interaction'].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setFilterRelation(cat)}
                    className={`px-2.5 py-1 rounded text-xs capitalize font-medium transition-all ${
                      filterRelation === cat
                        ? 'bg-pink-600 text-white shadow'
                        : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    {cat.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            {/* Relations List */}
            <div className="space-y-3">
              {relationships
                .filter((r) => filterRelation === 'all' || r.relationType === filterRelation)
                .map((rel) => {
                  const src = characters.find((c) => c.id === rel.source);
                  const tgt = characters.find((c) => c.id === rel.target);
                  if (!src || !tgt) return null;

                  const badgeColors: Record<RelationCategory, string> = {
                    kinship: 'bg-emerald-950/70 border-emerald-700 text-emerald-300',
                    romantic: 'bg-rose-950/70 border-rose-700 text-rose-300',
                    adversarial: 'bg-red-950/70 border-red-700 text-red-300',
                    hierarchical: 'bg-amber-950/70 border-amber-700 text-amber-300',
                    alliance: 'bg-cyan-950/70 border-cyan-700 text-cyan-300',
                    neutral_interaction: 'bg-slate-800 border-slate-700 text-slate-300',
                  };

                  return (
                    <div
                      key={rel.id}
                      className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-all space-y-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => onSelectCharacter(src.id)}
                            className="font-bold text-sm text-indigo-400 hover:underline"
                          >
                            {src.canonicalName}
                          </button>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                          <button
                            onClick={() => onSelectCharacter(tgt.id)}
                            className="font-bold text-sm text-pink-400 hover:underline"
                          >
                            {tgt.canonicalName}
                          </button>
                        </div>

                        <div className="flex items-center gap-2">
                          <span
                            className={`text-xs px-2.5 py-0.5 rounded-full border capitalize font-semibold ${
                              badgeColors[rel.relationType] || 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            {rel.relationType.replace('_', ' ')}
                          </span>
                          <span
                            className={`text-xs font-mono font-semibold px-2 py-0.5 rounded bg-slate-950 ${
                              rel.sentiment > 0.05
                                ? 'text-emerald-400'
                                : rel.sentiment < -0.05
                                ? 'text-rose-400'
                                : 'text-slate-400'
                            }`}
                          >
                            Sentiment: {rel.sentiment > 0 ? `+${rel.sentiment}` : rel.sentiment}
                          </span>
                          <span className="text-xs font-mono text-slate-400">
                            Weight: {rel.weight}
                          </span>
                        </div>
                      </div>

                      <p className="text-xs text-slate-300 italic">{rel.summary}</p>

                      {/* Evidence Quotes */}
                      {rel.evidenceQuotes.length > 0 && (
                        <div className="space-y-1.5 pl-3 border-l-2 border-indigo-500/40">
                          {rel.evidenceQuotes.map((q, qIdx) => (
                            <p key={qIdx} className="text-xs text-slate-400 font-serif leading-relaxed">
                              "{q}"
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
