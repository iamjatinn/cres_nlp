import {
  CharacterNode,
  RelationshipEdge,
  EntityMention,
  InteractionWindow,
  PipelineConfig,
  CRESResult,
  RelationCategory,
  Directionality,
} from '../types/cres';
import { computeGraphAnalytics } from './graphAnalytics';

// Common titles and honorifics
const HONORIFICS = new Set([
  'mr', 'mr.', 'mrs', 'mrs.', 'ms', 'ms.', 'miss', 'dr', 'dr.', 'prof', 'prof.',
  'lord', 'lady', 'sir', 'dame', 'king', 'queen', 'prince', 'princess',
  'duke', 'duchess', 'earl', 'count', 'countess', 'baron', 'baroness',
  'captain', 'capt', 'capt.', 'colonel', 'col', 'major', 'sergeant',
  'father', 'mother', 'brother', 'sister', 'uncle', 'aunt',
  'detective', 'inspector', 'officer', 'constable', 'sheriff', 'judge',
]);

// Words to exclude that are often capitalized but are places, days, months, or generic
const NON_CHARACTER_WORDS = new Set([
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august',
  'september', 'october', 'november', 'december',
  'london', 'england', 'britain', 'france', 'paris', 'york', 'netherfield',
  'pemberley', 'longbourn', 'meryton', 'rosings', 'elsinore', 'denmark',
  'hogwarts', 'gryffindor', 'slytherin', 'ravenclaw', 'hufflepuff',
  'baker', 'street', 'hall', 'manor', 'cottage', 'house', 'castle', 'palace',
  'east', 'west', 'north', 'south', 'egg', 'valley', 'ashes', 'america',
  'christmas', 'easter', 'god', 'heaven', 'hell', 'lord', 'sir',
  'act', 'scene', 'chapter', 'part', 'book', 'volume',
  'however', 'meanwhile', 'perhaps', 'suddenly', 'therefore', 'furthermore',
  'although', 'indeed', 'moreover', 'nonetheless', 'afterwards', 'sometimes',
  'nothing', 'something', 'everything', 'everyone', 'nobody', 'somebody',
  'tomorrow', 'yesterday', 'today', 'morning', 'evening', 'night',
]);

// Known nicknames and alias associations across classic and modern narrative conventions
const COMMON_NICKNAMES: Record<string, string[]> = {
  elizabeth: ['lizzy', 'eliza', 'beth', 'bess', 'elizabeth'],
  william: ['bill', 'billy', 'will', 'willy', 'liam'],
  robert: ['bob', 'bobby', 'rob'],
  richard: ['dick', 'rick', 'ricky'],
  james: ['jim', 'jimmy'],
  john: ['jack', 'johnny'],
  anthony: ['tony'],
  edward: ['ed', 'eddie', 'ted'],
  margaret: ['peggy', 'maggie', 'meg'],
  catherine: ['kitty', 'cathy', 'kate', 'katie'],
  jane: ['janie'],
  mary: ['molly', 'polly'],
  ronald: ['ron'],
  harry: ['harold', 'henry'],
  tom: ['thomas'],
  riddle: ['voldemort', 'you-know-who', 'he-who-must-not-be-named'],
  holmes: ['sherlock'],
  watson: ['john'],
  gatsby: ['jay'],
  darcy: ['fitzwilliam'],
  bennet: ['elizabeth', 'jane', 'lydia', 'kitty', 'mary'],
};

// Fine-grained relation cue dictionaries
// Each key is the fine-grained label the system will output.
const RELATION_PATTERNS: Record<string, string[]> = {
  // ── KINSHIP ──────────────────────────────────────────────────────────────
  sibling:              ['sister', 'brother', 'siblings', 'twin', 'half-brother', 'half-sister'],
  'parent-child':       ['father', 'mother', 'daughter', 'son', 'born to', 'begot', 'parent', 'child'],
  spouse:               ['wife', 'husband', 'married', 'marriage', 'wedding', 'wedded', 'widower', 'widow'],
  cousin:               ['cousin'],
  'uncle-nephew':       ['uncle', 'nephew'],
  'aunt-niece':         ['aunt', 'niece'],
  'adoptive-parent':    ['adopted', 'adoptive', 'ward', 'guardian'],
  'step-parent':        ['stepmother', 'stepfather', 'step-parent', 'stepson', 'stepdaughter'],
  'grandparent-grandchild': ['grandmother', 'grandfather', 'grandchild', 'grandson', 'granddaughter'],
  // ── ROMANTIC ─────────────────────────────────────────────────────────────
  lovers:               ['love', 'loved', 'loves', 'passion', 'heart', 'darling', 'beloved',
                         'sweetheart', 'adored', 'smitten', 'infatuated', 'romance',
                         'passionately', 'embraced', 'tenderly', 'kiss', 'kissed'],
  betrothed:            ['betrothed', 'fiancé', 'fiancée', 'engaged', 'engagement', 'proposal', 'proposed'],
  'former-lovers':      ['former', 'once loved', 'past affection', 'unrequited', 'ex-'],
  courtship:            ['courted', 'courtship', 'suitor', 'wooed', 'pursuing'],
  // ── ADVERSARIAL ───────────────────────────────────────────────────────────
  enemy:                ['enemy', 'enemies', 'hated', 'hate', 'despised', 'foe', 'despise', 'detest'],
  rival:                ['rival', 'rivalry', 'competed', 'compete', 'outdo', 'jealousy', 'jealous'],
  nemesis:              ['nemesis', 'revenge', 'avenge', 'vengeance', 'obsession'],
  'betrayer-betrayed':  ['betrayed', 'betrayal', 'traitor', 'treachery', 'deceived', 'falseness'],
  // ── HIERARCHICAL ─────────────────────────────────────────────────────────
  'employer-employee':  ['employed', 'hired', 'secretary', 'assistant', 'staff', 'worker', 'boss'],
  'master-servant':     ['master', 'servant', 'serves', 'served', 'obey', 'obeyed', 'fealty', 'vassal'],
  'mentor-student':     ['mentor', 'student', 'apprentice', 'pupil', 'taught', 'teacher', 'disciple'],
  'lawyer-client':      ['lawyer', 'attorney', 'client', 'counsel', 'solicitor', 'barrister'],
  'doctor-patient':     ['doctor', 'patient', 'physician', 'treated', 'medicine', 'diagnosis'],
  'lord-subject':       ['lord', 'liege', 'knight', 'vassal', 'king', 'queen', 'majesty', 'highness',
                         'commanded', 'command', 'fealty', 'subject', 'ruler'],
  // ── ALLIANCE ─────────────────────────────────────────────────────────────
  friend:               ['friend', 'friends', 'friendship', 'comrade', 'companion',
                         'trusted', 'trust', 'loyal', 'solidarity', 'stood with'],
  confidant:            ['confided', 'confidant', 'secret', 'whispered', 'confess'],
  ally:                 ['ally', 'allies', 'alliance', 'partner', 'aided', 'supported', 'support'],
  'co-conspirator':     ['conspired', 'plot', 'plotting', 'scheme', 'scheming', 'together planned'],
  // ── NEUTRAL ──────────────────────────────────────────────────────────────
  acquaintance:         ['acquaintance', 'met', 'encounter', 'introduced', 'knew briefly'],
  colleague:            ['colleague', 'fellow', 'peer', 'associate', 'co-worker'],
};

// Map fine-grained label → coarse display group (for summary generation only)
const FINE_TO_COARSE: Record<string, string> = {
  sibling: 'kinship', 'parent-child': 'kinship', spouse: 'kinship',
  cousin: 'kinship', 'uncle-nephew': 'kinship', 'aunt-niece': 'kinship',
  'adoptive-parent': 'kinship', 'step-parent': 'kinship', 'grandparent-grandchild': 'kinship',
  lovers: 'romantic', betrothed: 'romantic', 'former-lovers': 'romantic', courtship: 'romantic',
  enemy: 'adversarial', rival: 'adversarial', nemesis: 'adversarial', 'betrayer-betrayed': 'adversarial',
  'employer-employee': 'hierarchical', 'master-servant': 'hierarchical',
  'mentor-student': 'hierarchical', 'lawyer-client': 'hierarchical',
  'doctor-patient': 'hierarchical', 'lord-subject': 'hierarchical',
  friend: 'alliance', confidant: 'alliance', ally: 'alliance', 'co-conspirator': 'alliance',
  acquaintance: 'neutral_interaction', colleague: 'neutral_interaction',
};

// Valence lexicon for sentiment scoring
const POSITIVE_LEXICON = new Set([
  'love', 'loved', 'admire', 'adored', 'fond', 'happy', 'pleased', 'kind',
  'smile', 'smiled', 'laughed', 'joy', 'gentle', 'noble', 'devoted', 'sweet',
  'affection', 'warm', 'warmly', 'honor', 'honored', 'friend', 'delight',
  'beauty', 'radiant', 'tender', 'embraced', 'trust', 'cheered', 'grateful',
]);

const NEGATIVE_LEXICON = new Set([
  'hate', 'hated', 'bitter', 'cruel', 'cold', 'angry', 'furious', 'rage',
  'wrath', 'revenge', 'spite', 'jealous', 'gloomy', 'scorn', 'disdain',
  'murder', 'kill', 'killed', 'struck', 'insult', 'insulted', 'poison',
  'betray', 'betrayed', 'traitor', 'shame', 'despise', 'detest', 'grim',
  'terror', 'horror', 'sorrow', 'grief', 'enemy', 'foe', 'dread', 'falseness',
]);

/**
 * Robust sentence splitter that preserves periods in common honorifics & initials
 */
export function splitSentences(paragraph: string): string[] {
  if (!paragraph.trim()) return [];

  // Protect honorifics and initials with placeholders
  let text = paragraph;
  text = text.replace(/\b(Mr|Mrs|Ms|Dr|Prof|Lord|Lady|Sir|Capt|Col|St|Lt|Gen|Rev)\./gi, '$1_DOT_');
  text = text.replace(/\b([A-Z])\./g, '$1_DOT_'); // e.g. "J. K. Rowling"

  // Split on sentence terminals
  const rawSentences = text.split(/(?<=[.!?])\s+(?=[A-Z"'\u201C\u2018])/);

  return rawSentences
    .map((s) => s.replace(/_DOT_/g, '.').trim())
    .filter((s) => s.length > 0);
}

/**
 * Stage 1: Named Entity Recognition
 * Identifies character candidates with surface positions, honorifics, and dialogue tags
 */
export function extractEntityMentions(paragraphs: string[]): {
  rawMentions: EntityMention[];
  cleanedParagraphs: string[];
} {
  const mentions: EntityMention[] = [];
  let mentionCounter = 0;

  paragraphs.forEach((para, pIdx) => {
    const sentences = splitSentences(para);

    sentences.forEach((sentence, sIdx) => {
      // Regex for Proper Noun sequences: optional honorific + capitalized words
      const entityRegex = /\b(?:(?:Mr|Mrs|Ms|Miss|Dr|Prof|Lord|Lady|Sir|King|Queen|Prince|Princess|Captain|Father|Brother|Sister|Uncle|Aunt|Detective|Inspector)\.?\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g;

      let match: RegExpExecArray | null;
      while ((match = entityRegex.exec(sentence)) !== null) {
        const fullSurface = match[0].trim();
        const baseName = match[1].trim();
        const lowerBase = baseName.toLowerCase();

        // Check if candidate is in exclusion blacklist
        const words = lowerBase.split(/\s+/);
        if (words.some((w) => NON_CHARACTER_WORDS.has(w))) {
          continue;
        }

        // Avoid single-word tokens at the very start of a sentence unless followed by dialogue verb or title
        const isSentenceStart = match.index === 0;
        const isSingleWord = !baseName.includes(' ') && !fullSurface.includes(' ');
        if (isSentenceStart && isSingleWord) {
          // Check if followed by dialogue verbs like 'said', 'cried', 'looked', 'asked'
          const followingSlice = sentence.slice(match.index + match[0].length, match.index + match[0].length + 20);
          const hasDialogueVerb = /\b(said|cried|whispered|asked|replied|exclaimed|smiled|shouted|murmured|gazed|walked|stood)\b/i.test(followingSlice);
          if (!hasDialogueVerb) {
            continue;
          }
        }

        mentions.push({
          id: `m_${++mentionCounter}`,
          surfaceText: fullSurface,
          canonicalId: '', // To be filled in Stage 2
          canonicalName: '',
          startIndex: match.index,
          endIndex: match.index + fullSurface.length,
          paragraphIndex: pIdx,
          sentenceIndex: sIdx,
          confidence: fullSurface.includes(' ') || HONORIFICS.has(fullSurface.split(' ')[0].toLowerCase().replace('.', '')) ? 0.95 : 0.8,
        });
      }
    });
  });

  return { rawMentions: mentions, cleanedParagraphs: paragraphs };
}

/**
 * Computes Jaro-Winkler string similarity
 */
function jaroWinkler(s1: string, s2: string): number {
  if (s1 === s2) return 1.0;
  const len1 = s1.length;
  const len2 = s2.length;
  if (len1 === 0 || len2 === 0) return 0.0;

  const matchDistance = Math.floor(Math.max(len1, len2) / 2) - 1;
  const s1Matches = new Array(len1).fill(false);
  const s2Matches = new Array(len2).fill(false);

  let matches = 0;
  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, len2);
    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0.0;

  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < len1; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }

  const jaro = (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3;

  // Winkler prefix adjustment
  let prefix = 0;
  for (let i = 0; i < Math.min(4, len1, len2); i++) {
    if (s1[i] === s2[i]) prefix++;
    else break;
  }

  return jaro + prefix * 0.1 * (1 - jaro);
}

/**
 * Strips titles/honorifics from name for comparison
 */
function stripHonorific(name: string): string {
  const parts = name.split(/\s+/);
  if (parts.length > 1 && HONORIFICS.has(parts[0].toLowerCase().replace('.', ''))) {
    return parts.slice(1).join(' ');
  }
  return name;
}

/**
 * Checks if two surface names refer to the same entity
 */
function areAliases(nameA: string, nameB: string): boolean {
  const cleanA = stripHonorific(nameA).toLowerCase();
  const cleanB = stripHonorific(nameB).toLowerCase();

  if (cleanA === cleanB) return true;

  // Token containment (e.g. "Elizabeth" inside "Elizabeth Bennet")
  const tokensA = cleanA.split(/\s+/);
  const tokensB = cleanB.split(/\s+/);

  // If one is full name (First Last) and other is First or Last
  if (tokensA.length === 1 && tokensB.includes(tokensA[0])) return true;
  if (tokensB.length === 1 && tokensA.includes(tokensB[0])) return true;

  // Title + Last Name matching (e.g. "Mr. Darcy" matches "Fitzwilliam Darcy")
  const lastA = tokensA[tokensA.length - 1];
  const lastB = tokensB[tokensB.length - 1];
  if (lastA.length > 2 && lastA === lastB) {
    // Both have same last name
    return true;
  }

  // Check known nickname table
  for (const [canonical, nicknames] of Object.entries(COMMON_NICKNAMES)) {
    const matchesA = tokensA.some((t) => t === canonical || nicknames.includes(t));
    const matchesB = tokensB.some((t) => t === canonical || nicknames.includes(t));
    if (matchesA && matchesB) {
      // If last name is also compatible or absent
      if (tokensA.length === 1 || tokensB.length === 1 || lastA === lastB) {
        return true;
      }
    }
  }

  // Fuzzy match on single token
  if (cleanA.length > 4 && cleanB.length > 4 && jaroWinkler(cleanA, cleanB) > 0.88) {
    return true;
  }

  return false;
}

/**
 * Stage 2: Coreference Resolution & Alias Clustering
 * Merges surface forms into canonical character entities
 */
export function clusterAliases(mentions: EntityMention[]): {
  characters: CharacterNode[];
  resolvedMentions: EntityMention[];
} {
  // Count frequency of each unique surface text
  const surfaceCounts = new Map<string, number>();
  for (const m of mentions) {
    surfaceCounts.set(m.surfaceText, (surfaceCounts.get(m.surfaceText) || 0) + 1);
  }

  // Sort unique surfaces by frequency descending
  const uniqueSurfaces = Array.from(surfaceCounts.keys()).sort(
    (a, b) => (surfaceCounts.get(b) || 0) - (surfaceCounts.get(a) || 0)
  );

  interface Cluster {
    canonicalName: string;
    aliases: Set<string>;
    totalMentions: number;
  }

  const clusters: Cluster[] = [];

  for (const surface of uniqueSurfaces) {
    const count = surfaceCounts.get(surface) || 1;
    let matchedCluster: Cluster | null = null;

    for (const c of clusters) {
      if (areAliases(surface, c.canonicalName) || Array.from(c.aliases).some((alias) => areAliases(surface, alias))) {
        matchedCluster = c;
        break;
      }
    }

    if (matchedCluster) {
      matchedCluster.aliases.add(surface);
      matchedCluster.totalMentions += count;
      // Upgrade canonical name to the most specific / informative form
      const cleanSurface = stripHonorific(surface);
      const cleanCurrent = stripHonorific(matchedCluster.canonicalName);
      if (
        (cleanSurface.includes(' ') && !cleanCurrent.includes(' ')) ||
        (cleanSurface.length > cleanCurrent.length && !cleanCurrent.includes(' '))
      ) {
        matchedCluster.canonicalName = surface;
      }
    } else {
      clusters.push({
        canonicalName: surface,
        aliases: new Set([surface]),
        totalMentions: count,
      });
    }
  }

  // Filter out noise: characters with only 1 mention unless text is short or fewer than 2 total characters
  let validClusters = clusters;
  if (clusters.length > 8) {
    validClusters = clusters.filter((c) => c.totalMentions >= 2);
    if (validClusters.length < 3) validClusters = clusters.slice(0, 5);
  }

  // Infer basic gender cues from common names or titles
  const inferGender = (name: string): 'male' | 'female' | 'other' | 'unknown' => {
    const lower = name.toLowerCase();
    if (/\b(mr|lord|sir|king|prince|father|brother|uncle|duke|count|baron|he|him|his)\b/i.test(lower)) return 'male';
    if (/\b(mrs|ms|miss|lady|queen|princess|mother|sister|aunt|duchess|countess|she|her|hers)\b/i.test(lower)) return 'female';
    if (/\b(elizabeth|jane|mary|kitty|lydia|ophelia|gertrude|daisy|jordan|myrtle|irene|hermione)\b/i.test(lower)) return 'female';
    if (/\b(hamlet|claudius|polonius|laertes|horatio|darcy|bingley|wickham|collins|gatsby|nick|tom|sherlock|watson|harry|ron|snape|dumbledore|draco)\b/i.test(lower)) return 'male';
    return 'unknown';
  };

  // Build Character Nodes
  const characters: CharacterNode[] = validClusters.map((c, idx) => {
    const id = `c_${idx + 1}`;
    return {
      id,
      canonicalName: c.canonicalName,
      aliases: Array.from(c.aliases),
      gender: inferGender(c.canonicalName),
      primaryRole: 'Supporting', // Will be recomputed during graph analytics
      mentionsCount: c.totalMentions,
      communityId: 0,
      centrality: {
        degree: 0,
        weightedDegree: 0,
        betweenness: 0,
        closeness: 0,
        pagerank: 0,
      },
    };
  });

  // Map surface forms to canonical ID
  const surfaceToChar = new Map<string, CharacterNode>();
  for (const char of characters) {
    for (const alias of char.aliases) {
      surfaceToChar.set(alias, char);
    }
  }

  // Update mentions with canonical pointers
  const resolvedMentions: EntityMention[] = mentions
    .map((m) => {
      const char = surfaceToChar.get(m.surfaceText);
      if (!char) return null;
      return {
        ...m,
        canonicalId: char.id,
        canonicalName: char.canonicalName,
      };
    })
    .filter((m): m is EntityMention => m !== null);

  return { characters, resolvedMentions };
}

/**
 * Stage 3: Co-occurrence & Interaction Detection
 * Groups character co-presences within paragraph / sliding windows
 */
export function detectCoOccurrences(
  paragraphs: string[],
  mentions: EntityMention[],
  characters: CharacterNode[],
  config: PipelineConfig
): {
  interactionWindows: InteractionWindow[];
  coOccurrenceMatrix: { characters: string[]; matrix: number[][] };
  coPresenceMap: Map<string, { count: number; paragraphs: Set<number>; snippets: string[] }>;
} {
  const n = characters.length;
  const charToIndex = new Map<string, number>();
  characters.forEach((c, i) => charToIndex.set(c.id, i));

  // Initialize matrix
  const matrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  const coPresenceMap = new Map<string, { count: number; paragraphs: Set<number>; snippets: string[] }>();

  const interactionWindows: InteractionWindow[] = [];

  // Windowing logic: paragraph-based or sliding sentences
  if (config.windowMode === 'sentence_sliding') {
    // Group mentions by paragraph then sliding sentences
    paragraphs.forEach((para, pIdx) => {
      const sentences = splitSentences(para);
      const windowSize = config.sentenceWindowSize || 2;

      for (let s = 0; s < sentences.length; s++) {
        const sentenceSlice = sentences.slice(s, s + windowSize).join(' ');
        const activeMentions = mentions.filter(
          (m) => m.paragraphIndex === pIdx && m.sentenceIndex >= s && m.sentenceIndex < s + windowSize
        );
        const uniqueCharIds = Array.from(new Set(activeMentions.map((m) => m.canonicalId)));

        if (uniqueCharIds.length >= 2) {
          interactionWindows.push({
            paragraphIndex: pIdx,
            sentenceIndex: s,
            snippet: sentenceSlice,
            characters: uniqueCharIds.map((id) => characters.find((c) => c.id === id)?.canonicalName || id),
          });

          // Register pairs
          for (let i = 0; i < uniqueCharIds.length; i++) {
            for (let j = i + 1; j < uniqueCharIds.length; j++) {
              const u = uniqueCharIds[i];
              const v = uniqueCharIds[j];
              const pairKey = u < v ? `${u}:${v}` : `${v}:${u}`;

              if (!coPresenceMap.has(pairKey)) {
                coPresenceMap.set(pairKey, { count: 0, paragraphs: new Set(), snippets: [] });
              }
              const entry = coPresenceMap.get(pairKey)!;
              entry.count += 1;
              entry.paragraphs.add(pIdx);
              if (entry.snippets.length < 5) {
                entry.snippets.push(sentenceSlice);
              }
            }
          }
        }
      }
    });
  } else {
    // Default: Paragraph-level scene windowing
    paragraphs.forEach((para, pIdx) => {
      const paraMentions = mentions.filter((m) => m.paragraphIndex === pIdx);
      const uniqueCharIds = Array.from(new Set(paraMentions.map((m) => m.canonicalId)));

      if (uniqueCharIds.length >= 2) {
        interactionWindows.push({
          paragraphIndex: pIdx,
          sentenceIndex: 0,
          snippet: para.length > 280 ? para.slice(0, 277) + '...' : para,
          characters: uniqueCharIds.map((id) => characters.find((c) => c.id === id)?.canonicalName || id),
        });

        // Register pairs
        for (let i = 0; i < uniqueCharIds.length; i++) {
          for (let j = i + 1; j < uniqueCharIds.length; j++) {
            const u = uniqueCharIds[i];
            const v = uniqueCharIds[j];
            const pairKey = u < v ? `${u}:${v}` : `${v}:${u}`;

            if (!coPresenceMap.has(pairKey)) {
              coPresenceMap.set(pairKey, { count: 0, paragraphs: new Set(), snippets: [] });
            }
            const entry = coPresenceMap.get(pairKey)!;
            entry.count += 1;
            entry.paragraphs.add(pIdx);
            if (entry.snippets.length < 5) {
              entry.snippets.push(para);
            }
          }
        }
      }
    });
  }

  // Populate symmetric co-occurrence matrix
  for (const [pairKey, entry] of coPresenceMap.entries()) {
    const [u, v] = pairKey.split(':');
    const idxU = charToIndex.get(u);
    const idxV = charToIndex.get(v);
    if (idxU !== undefined && idxV !== undefined) {
      matrix[idxU][idxV] = entry.count;
      matrix[idxV][idxU] = entry.count;
    }
  }

  return {
    interactionWindows,
    coOccurrenceMatrix: {
      characters: characters.map((c) => c.canonicalName),
      matrix,
    },
    coPresenceMap,
  };
}

/**
 * Stage 4: Relation Classification & Sentiment Analysis
 * Classifies relation type and polarity using lexical patterns and co-occurrence evidence
 */
export function classifyRelationships(
  characters: CharacterNode[],
  coPresenceMap: Map<string, { count: number; paragraphs: Set<number>; snippets: string[] }>,
  totalParagraphs: number,
  config: PipelineConfig
): RelationshipEdge[] {
  const edges: RelationshipEdge[] = [];
  const charMap = new Map<string, CharacterNode>();
  characters.forEach((c) => charMap.set(c.id, c));

  let edgeCounter = 0;

  for (const [pairKey, entry] of coPresenceMap.entries()) {
    if (entry.count < config.minInteractionWeight) {
      continue;
    }

    const [sourceId, targetId] = pairKey.split(':');
    const sourceChar = charMap.get(sourceId);
    const targetChar = charMap.get(targetId);
    if (!sourceChar || !targetChar) continue;

    // Join all snippets for text analysis
    const combinedText = entry.snippets.join(' ').toLowerCase();

    // Pattern matching scores — one entry per fine-grained label
    const categoryScores: Record<string, number> = { acquaintance: 0.1 }; // base default
    for (const label of Object.keys(RELATION_PATTERNS)) {
      if (!(label in categoryScores)) categoryScores[label] = 0;
    }

    for (const [label, words] of Object.entries(RELATION_PATTERNS)) {
      for (const word of words) {
        const regex = new RegExp(`\\b${word.replace('-', '\\-')}\\b`, 'gi');
        const matches = combinedText.match(regex);
        if (matches) {
          categoryScores[label] += matches.length * 1.5;
        }
      }
    }

    // Pick the highest-scoring fine-grained label
    let bestCategory: string = 'acquaintance';
    let maxCatScore = 0;
    for (const [label, score] of Object.entries(categoryScores)) {
      if (score > maxCatScore) {
        maxCatScore = score;
        bestCategory = label;
      }
    }

    // Compute sentiment polarity score (-1.0 to 1.0)
    let posScore = 0;
    let negScore = 0;
    const tokens = combinedText.split(/\W+/);
    for (const t of tokens) {
      if (POSITIVE_LEXICON.has(t)) posScore += 1;
      if (NEGATIVE_LEXICON.has(t)) negScore += 1;
    }

    // Sentiment bias based on coarse group
    const coarseGroup = FINE_TO_COARSE[bestCategory] || 'neutral_interaction';
    if (coarseGroup === 'adversarial') negScore += 3;
    if (coarseGroup === 'romantic' || coarseGroup === 'alliance') posScore += 3;
    if (coarseGroup === 'kinship') posScore += 1;

    let sentiment = 0;
    const totalSentimentTokens = posScore + negScore;
    if (totalSentimentTokens > 0) {
      sentiment = +((posScore - negScore) / totalSentimentTokens).toFixed(2);
    }

    // Directionality heuristic — based on coarse group
    let directionality: Directionality = 'undirected';
    if (coarseGroup === 'hierarchical') {
      directionality = 'directed';
    } else if (coarseGroup === 'romantic' && sentiment < 0) {
      directionality = 'directed';
    } else if (coarseGroup === 'adversarial' && Math.random() > 0.5) {
      directionality = 'bidirectional';
    }

    // Jaccard similarity across scenes
    const sourceParas = sourceChar.mentionsCount;
    const targetParas = targetChar.mentionsCount;
    const intersection = entry.paragraphs.size;
    const union = sourceParas + targetParas - intersection;
    const jaccardScore = union > 0 ? +(intersection / union).toFixed(3) : 0;

    // Generate summary using fine-grained label
    const labelDisplay = bestCategory.replace(/-/g, ' ');
    let summary = `${sourceChar.canonicalName} and ${targetChar.canonicalName} interact across ${entry.count} narrative scenes.`;
    if (coarseGroup === 'kinship') {
      summary = `${sourceChar.canonicalName} and ${targetChar.canonicalName} share a ${labelDisplay} relationship.`;
    } else if (coarseGroup === 'romantic') {
      summary = `${sourceChar.canonicalName} and ${targetChar.canonicalName} are connected by a ${labelDisplay} bond.`;
    } else if (coarseGroup === 'adversarial') {
      summary = `${sourceChar.canonicalName} and ${targetChar.canonicalName} are in a ${labelDisplay} conflict.`;
    } else if (coarseGroup === 'hierarchical') {
      summary = `${sourceChar.canonicalName} and ${targetChar.canonicalName} share a ${labelDisplay} dynamic.`;
    } else if (coarseGroup === 'alliance') {
      summary = `${sourceChar.canonicalName} and ${targetChar.canonicalName} share a ${labelDisplay} partnership.`;
    }

    edges.push({
      id: `e_${++edgeCounter}`,
      source: sourceChar.id,
      target: targetChar.id,
      relationType: bestCategory,
      sentiment,
      directionality,
      weight: entry.count,
      jaccardScore,
      confidence: +(0.75 + Math.min(0.24, entry.count * 0.05)).toFixed(2),
      evidenceQuotes: entry.snippets.slice(0, 3).map((s) => s.trim().slice(0, 300)),
      summary,
      coOccurrenceParagraphs: Array.from(entry.paragraphs),
    });
  }

  return edges;
}

/**
 * End-to-end Algorithmic Pipeline Execution
 */
export function runAlgorithmicCRES(text: string, config: PipelineConfig): CRESResult {
  const startTime = performance.now();

  // Split into raw paragraphs
  const rawParagraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  // Fallback if no double newlines
  const paragraphs = rawParagraphs.length > 0 ? rawParagraphs : [text];

  // Stage 1: NER
  const { rawMentions } = extractEntityMentions(paragraphs);

  // Stage 2: Alias Clustering & Coreference
  const { characters: rawCharacters, resolvedMentions } = clusterAliases(rawMentions);

  // Stage 3: Co-occurrence & Interaction
  const { interactionWindows, coOccurrenceMatrix, coPresenceMap } = detectCoOccurrences(
    paragraphs,
    resolvedMentions,
    rawCharacters,
    config
  );

  // Stage 4: Relation Classification
  const initialEdges = classifyRelationships(
    rawCharacters,
    coPresenceMap,
    paragraphs.length,
    config
  );

  // Stage 5: Downstream Graph Analytics
  const { enrichedCharacters, metrics, communities } = computeGraphAnalytics(
    rawCharacters,
    initialEdges
  );

  const endTime = performance.now();

  return {
    text,
    characters: enrichedCharacters,
    relationships: initialEdges,
    mentions: resolvedMentions,
    paragraphs,
    interactionWindows,
    coOccurrenceMatrix,
    metrics,
    communities,
    narrativeOverview: `Extracted ${enrichedCharacters.length} character entities across ${initialEdges.length} interaction edges. Network exhibits ${communities.length} natural character clusters with network density of ${metrics.density}. Top structural hub is ${metrics.topHub}, bridging key narrative subplots.`,
    executionTimeMs: Math.round(endTime - startTime),
    engineUsed: 'algorithmic',
  };
}
