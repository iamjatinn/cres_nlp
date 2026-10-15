import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  CharacterNode,
  RelationshipEdge,
  CommunityGroup,
} from './types/cres';
import { SAMPLE_STORIES } from './nlp/sampleStories';
import { Header } from './components/Header';
import { NetworkGraph } from './components/NetworkGraph';
import { NodeDetailPanel } from './components/NodeDetailPanel';
import { EdgeDetailPanel } from './components/EdgeDetailPanel';
import { TableInspector } from './components/TableInspector';
import { StoryEditorModal } from './components/StoryEditorModal';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

export default function App() {
  const [currentText, setCurrentText] = useState<string>(SAMPLE_STORIES[0].text);
  const [storyTitle, setStoryTitle] = useState<string>(SAMPLE_STORIES[0].title);
  const [activeView, setActiveView] = useState<'graph' | 'table'>('graph');

  // Selected node or edge in graph
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  // Extracted entities and relationships
  const [characters, setCharacters] = useState<CharacterNode[]>([]);
  const [relationships, setRelationships] = useState<RelationshipEdge[]>([]);
  const [communities, setCommunities] = useState<CommunityGroup[]>([]);

  // Status & loading
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [isStoryEditorOpen, setIsStoryEditorOpen] = useState<boolean>(false);

  // Extract relations using LLM (Gemini 3.8 Flash)
  const runExtraction = useCallback(async (textToExtract: string) => {
    setIsLoading(true);
    setStatusMessage(null);
    try {
      const response = await fetch('/api/extract-relations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textToExtract }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Extraction failed');
      }

      const data = await response.json();
      const rawChars: any[] = data.characters || [];
      const rawRels: any[] = data.relationships || [];

      // Format characters
      const formattedChars: CharacterNode[] = rawChars.map((c, i) => ({
        id: c.id || `c_${i + 1}`,
        canonicalName: c.canonicalName || `Character ${i + 1}`,
        aliases: c.aliases || [c.canonicalName],
        gender: c.gender || 'unknown',
        primaryRole: c.primaryRole || 'Supporting',
        mentionsCount: c.mentionsCount || 5,
        communityId: c.communityId || 0,
        color: c.color || '#6366f1',
        centrality: {
          degree: c.centrality?.degree || 0,
          weightedDegree: 0,
          betweenness: c.centrality?.betweenness || 0.0,
          closeness: 0,
          pagerank: 0,
        },
      }));

      const nameToId = new Map<string, string>();
      formattedChars.forEach((c) => {
        nameToId.set(c.canonicalName.toLowerCase(), c.id);
        c.aliases.forEach((a) => nameToId.set(a.toLowerCase(), c.id));
      });

      // Format relationships
      const formattedEdges: RelationshipEdge[] = rawRels
        .map((r: any, i: number): RelationshipEdge | null => {
          const srcId = nameToId.get(r.source?.toLowerCase?.()) || formattedChars[0]?.id;
          const tgtId = nameToId.get(r.target?.toLowerCase?.()) || formattedChars[1]?.id;
          if (!srcId || !tgtId || srcId === tgtId) return null;

          return {
            id: `e_${i + 1}`,
            source: srcId,
            target: tgtId,
            relationType: r.relationType || 'neutral_interaction',
            sentiment: typeof r.sentiment === 'number' ? r.sentiment : 0.0,
            directionality: r.directionality || 'undirected',
            weight: r.weight || 2,
            jaccardScore: 0.5,
            confidence: 0.95,
            evidenceQuotes: r.evidenceQuotes || [],
            summary: r.summary || `${r.source} and ${r.target} interact.`,
            coOccurrenceParagraphs: [] as number[],
          };
        })
        .filter((e): e is RelationshipEdge => e !== null);

      setCharacters(formattedChars);
      setRelationships(formattedEdges);
      setCommunities(data.communities || []);
      setCurrentText(textToExtract);
      const modelLabel = data.modelUsed ? `(${data.modelUsed})` : '';
      setStatusMessage({
        text: `Extracted ${formattedChars.length} characters & ${formattedEdges.length} relationships ${modelLabel}!`,
        type: 'success',
      });
    } catch (err: any) {
      console.error('Extraction error:', err);
      setStatusMessage({
        text: err.message || 'Failed to extract relations',
        type: 'error',
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial extraction on load
  useEffect(() => {
    runExtraction(SAMPLE_STORIES[0].text);
  }, [runExtraction]);

  const selectedCharacter = useMemo(() => {
    if (!selectedCharacterId) return null;
    return characters.find((c) => c.id === selectedCharacterId) || null;
  }, [selectedCharacterId, characters]);

  const selectedEdge = useMemo(() => {
    if (!selectedEdgeId) return null;
    return relationships.find((e) => e.id === selectedEdgeId) || null;
  }, [selectedEdgeId, relationships]);

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      <Header
        activeView={activeView}
        setActiveView={setActiveView}
        storyTitle={storyTitle}
        charactersCount={characters.length}
        relationshipsCount={relationships.length}
        onOpenStoryEditor={() => setIsStoryEditorOpen(true)}
        onRefresh={() => runExtraction(currentText)}
        isLoading={isLoading}
      />

      {statusMessage && (
        <div
          className={`px-4 py-1.5 text-xs flex items-center justify-between border-b ${
            statusMessage.type === 'error'
              ? 'bg-red-950/70 border-red-800 text-red-200'
              : 'bg-emerald-950/70 border-emerald-800 text-emerald-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMessage.type === 'error' ? (
              <AlertCircle className="w-3.5 h-3.5 text-red-400" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button
            onClick={() => setStatusMessage(null)}
            className="text-slate-400 hover:text-white text-[11px] underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden relative">
        <main className="flex-1 h-full p-3 overflow-hidden flex flex-col">
          {activeView === 'graph' && (
            <NetworkGraph
              characters={characters}
              relationships={relationships}
              communities={communities}
              selectedCharacterId={selectedCharacterId}
              selectedEdgeId={selectedEdgeId}
              onSelectCharacter={(id) => {
                setSelectedCharacterId(id);
                if (id) setSelectedEdgeId(null);
              }}
              onSelectEdge={(id) => {
                setSelectedEdgeId(id);
                if (id) setSelectedCharacterId(null);
              }}
            />
          )}

          {activeView === 'table' && (
            <TableInspector
              characters={characters}
              relationships={relationships}
              onSelectCharacter={(id) => {
                setSelectedCharacterId(id);
                setSelectedEdgeId(null);
                setActiveView('graph');
              }}
              onSelectEdge={(id) => {
                setSelectedEdgeId(id);
                setSelectedCharacterId(null);
                setActiveView('graph');
              }}
            />
          )}
        </main>

        {/* Side Panels */}
        {selectedCharacter && activeView === 'graph' && (
          <NodeDetailPanel
            character={selectedCharacter}
            allCharacters={characters}
            relationships={relationships}
            communities={communities}
            onClose={() => setSelectedCharacterId(null)}
            onSelectCharacter={(id) => setSelectedCharacterId(id)}
            onSelectEdge={(id) => {
              setSelectedCharacterId(null);
              setSelectedEdgeId(id);
            }}
          />
        )}

        {selectedEdge && activeView === 'graph' && (
          <EdgeDetailPanel
            edge={selectedEdge}
            allCharacters={characters}
            onClose={() => setSelectedEdgeId(null)}
            onSelectCharacter={(id) => {
              setSelectedEdgeId(null);
              setSelectedCharacterId(id);
            }}
          />
        )}
      </div>

      <StoryEditorModal
        currentText={currentText}
        isOpen={isStoryEditorOpen}
        onClose={() => setIsStoryEditorOpen(false)}
        onRunPipeline={async (newText) => {
          const matched = SAMPLE_STORIES.find((s) => s.text === newText);
          setStoryTitle(matched ? matched.title : 'Custom Story');
          await runExtraction(newText);
        }}
        isLoading={isLoading}
      />
    </div>
  );
}
