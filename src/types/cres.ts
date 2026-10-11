export type RelationCategory = 
  | 'kinship' 
  | 'romantic' 
  | 'adversarial' 
  | 'hierarchical' 
  | 'alliance' 
  | 'neutral_interaction';

export type Directionality = 'directed' | 'undirected' | 'bidirectional';

export interface EntityMention {
  id: string;
  surfaceText: string;
  canonicalId: string;
  canonicalName: string;
  startIndex: number;
  endIndex: number;
  paragraphIndex: number;
  sentenceIndex: number;
  confidence: number;
  isPronounResolution?: boolean;
}

export interface CharacterNode {
  id: string;
  canonicalName: string;
  aliases: string[];
  gender: 'male' | 'female' | 'other' | 'unknown';
  primaryRole: string; // Protagonist, Antagonist, Bridge, Supporting, etc.
  description?: string;
  mentionsCount: number;
  color?: string;
  communityId: number;
  // Graph centrality metrics
  centrality: {
    degree: number;
    weightedDegree: number;
    betweenness: number;
    closeness: number;
    pagerank: number;
  };
  // Position for visualization layout (persisted or force-assigned)
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

export interface InteractionWindow {
  paragraphIndex: number;
  sentenceIndex: number;
  snippet: string;
  characters: string[];
}

export interface RelationshipEdge {
  id: string;
  source: string; // Character ID
  target: string; // Character ID
  relationType: RelationCategory;
  sentiment: number; // -1.0 to 1.0
  directionality: Directionality;
  weight: number; // Co-occurrence count or LLM weighted intensity
  jaccardScore: number;
  confidence: number; // 0.0 to 1.0
  evidenceQuotes: string[];
  summary: string;
  coOccurrenceParagraphs: number[];
}

export interface CoOccurrenceCell {
  sourceId: string;
  targetId: string;
  count: number;
  jaccard: number;
}

export interface GraphMetrics {
  nodeCount: number;
  edgeCount: number;
  density: number;
  averageDegree: number;
  diameter: number;
  connectedComponents: number;
  communitiesCount: number;
  modularityScore: number;
  topHub: string;
  topBridge: string;
}

export interface CommunityGroup {
  id: number;
  name: string;
  color: string;
  members: string[]; // character canonical names
  description: string;
}

export type NLPEngineMode = 'algorithmic' | 'gemini' | 'hybrid';

export interface PipelineConfig {
  engine: NLPEngineMode;
  windowMode: 'paragraph' | 'sentence_sliding' | 'scene_break';
  sentenceWindowSize: number; // e.g. 2 or 3 sentences
  minInteractionWeight: number; // e.g. 1 or 2
  enablePronounCoreference: boolean;
  minMentionThreshold: number; // filter out one-off background names if needed
}

export interface CRESResult {
  text: string;
  characters: CharacterNode[];
  relationships: RelationshipEdge[];
  mentions: EntityMention[];
  paragraphs: string[];
  interactionWindows: InteractionWindow[];
  coOccurrenceMatrix: {
    characters: string[];
    matrix: number[][];
  };
  metrics: GraphMetrics;
  communities: CommunityGroup[];
  narrativeOverview?: string;
  executionTimeMs: number;
  engineUsed: NLPEngineMode;
}
