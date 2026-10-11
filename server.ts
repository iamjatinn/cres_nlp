import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import { spawn } from 'child_process';

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '25mb' }));

// Initialize Gemini SDK with User-Agent as instructed by guidelines
const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;
if (apiKey) {
  ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Function to run Python graph engine
function runPythonEngine(data: { characters?: any[]; relationships?: any[]; text?: string }): Promise<any> {
  return new Promise((resolve) => {
    const py = spawn('python3', [path.resolve(process.cwd(), 'cres_engine.py')]);
    let output = '';
    let errorOutput = '';

    py.stdout.on('data', (chunk) => {
      output += chunk.toString();
    });

    py.stderr.on('data', (chunk) => {
      errorOutput += chunk.toString();
    });

    py.on('close', (code) => {
      if (code !== 0) {
        console.warn('Python engine error:', errorOutput);
        resolve(data);
      } else {
        try {
          const parsed = JSON.parse(output);
          resolve(parsed);
        } catch (e) {
          console.warn('Failed to parse Python engine output:', e);
          resolve(data);
        }
      }
    });

    py.stdin.write(JSON.stringify(data));
    py.stdin.end();
  });
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    hasGeminiKey: !!process.env.GEMINI_API_KEY,
  });
});

// Candidate models cascade for high-availability fallback
const CANDIDATE_MODELS = [
  'gemini-3.8-flash',
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
];

// Primary CRES Extraction endpoint
app.post('/api/extract-relations', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Story text content is required' });
    }

    const trimmedText = text.slice(0, 40000);

    let rawCharacters: any[] = [];
    let rawRelationships: any[] = [];
    let modelUsed: string = 'python_fallback';

    if (ai) {
      const prompt = `You are an expert computational linguist executing the Character Relation Extraction System (CRES) pipeline on narrative literature.

Carefully and exhaustively read through the ENTIRE story across ALL chapters (including all beginning, middle, and final chapters).

TASK 1: EXHAUSTIVE CHARACTER & ALIAS EXTRACTION
- Extract EVERY named sentient human character who speaks, acts, or holds narrative significance across the full text.
- Do NOT omit characters who appear only in later chapters (e.g. John Price/Jonathan, Laura Price, Helen Ward, Grace Shaw, etc.).
- Do NOT confuse family members sharing the same surname into one person (e.g., Margaret Blackwood, Sebastian Blackwood, Adrian Blackwood, and Elizabeth are distinct entities!).
- Merge all surface nicknames, titles, and variants into the single full canonicalName, and list every variant in the "aliases" array.
  * Examples of aliases: "Ade" -> Adrian Blackwood; "Cathy" -> Catherine; "Bella" -> Isabella Moore; "Inspector Shaw" -> Robert Shaw; "John Price" -> Jonathan Blackwood; "Lord Sebastian" -> Sebastian Blackwood.
- Assign primaryRole (Protagonist, Antagonist, Supporting, Catalyst, Deuteragonist).
- Assign gender (male, female, other, unknown).

TASK 2: RELATIONSHIP CLASSIFICATION & EVIDENCE
- Identify all meaningful interpersonal relationships and direct interactions between the characters.
- Classify each relationType strictly into one of:
  * "kinship" (spouses, siblings, parent-child, aunt/uncle-niece/nephew, in-laws, adoptive relations)
  * "romantic" (lovers, fiancés, courting, unrequited/past affection)
  * "adversarial" (enemies, rivals, murder suspects, legal antagonists, bitter feuds)
  * "hierarchical" (lawyer-client, doctor-patient, employer-secretary, inspector-witness)
  * "alliance" (trusted friends, conspirators, mutual confidants)
  * "neutral_interaction" (casual formal acquaintance)
- Sentiment Polarity: Float between -1.0 (intensely hostile/hateful) and +1.0 (deeply loving/supportive). 0.0 is neutral/formal.
- Interaction Weight: Integer from 1 to 10 reflecting narrative frequency and emotional intensity.
- Evidence Quotes: Include 1 to 2 EXACT verbatim quote snippets from the narrative text demonstrating the relation.
- Summary: A concise 1-sentence description of their dynamic across the story.

NARRATIVE STORY:
"""
${trimmedText}
"""
`;

      const responseSchema = {
        type: Type.OBJECT,
        properties: {
          characters: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                canonicalName: { type: Type.STRING, description: 'Full canonical name of the character' },
                aliases: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: 'All nicknames, diminutives, and surface forms',
                },
                gender: { type: Type.STRING },
                primaryRole: { type: Type.STRING },
                description: { type: Type.STRING },
              },
              required: ['id', 'canonicalName', 'aliases', 'primaryRole'],
            },
          },
          relationships: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                source: { type: Type.STRING, description: 'canonicalName of first character' },
                target: { type: Type.STRING, description: 'canonicalName of second character' },
                relationType: { type: Type.STRING, description: 'kinship, romantic, adversarial, hierarchical, alliance, or neutral_interaction' },
                sentiment: { type: Type.NUMBER, description: 'Float between -1.0 and 1.0' },
                weight: { type: Type.INTEGER, description: 'Integer from 1 to 10' },
                evidenceQuotes: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: 'Verbatim quotes from story text',
                },
                summary: { type: Type.STRING },
              },
              required: ['source', 'target', 'relationType', 'sentiment', 'weight', 'evidenceQuotes', 'summary'],
            },
          },
        },
        required: ['characters', 'relationships'],
      };

      for (const model of CANDIDATE_MODELS) {
        try {
          const response = await ai.models.generateContent({
            model,
            contents: prompt,
            config: {
              responseMimeType: 'application/json',
              responseSchema,
            },
          });

          const parsedLLM = JSON.parse(response.text || '{}');
          if (Array.isArray(parsedLLM.characters) && parsedLLM.characters.length > 0) {
            rawCharacters = parsedLLM.characters;
            rawRelationships = parsedLLM.relationships || [];
            modelUsed = model;
            break;
          }
        } catch (modelErr: any) {
          console.warn(`Model ${model} was unavailable or spiked, falling back:`, modelErr.message);
        }
      }
    }

    // Process graph metrics and community factions in Python
    const pythonResult = await runPythonEngine({
      characters: rawCharacters,
      relationships: rawRelationships,
      text: rawCharacters.length === 0 ? trimmedText : undefined,
    });

    res.json({
      characters: pythonResult.characters || rawCharacters,
      relationships: pythonResult.relationships || rawRelationships,
      communities: pythonResult.communities || [],
      modelUsed,
      metrics: pythonResult.metrics || {
        nodeCount: rawCharacters.length,
        edgeCount: rawRelationships.length,
        topHub: rawCharacters[0]?.canonicalName || 'None',
        topBridge: rawCharacters[0]?.canonicalName || 'None',
      },
    });
  } catch (err: unknown) {
    console.error('Extraction error:', err);
    const message = err instanceof Error ? err.message : 'Unknown server error';
    res.status(500).json({ error: message });
  }
});

// Mount Vite or static server
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(process.cwd(), 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(process.cwd(), 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CRES Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
