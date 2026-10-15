import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { spawn } from 'child_process';

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '25mb' }));

// Determine Python binary across Windows and Unix (checks .venv first)
function getPythonBin(): string {
  if (process.env.PYTHON_BIN) return process.env.PYTHON_BIN;
  const venvWin = path.resolve(process.cwd(), '.venv', 'Scripts', 'python.exe');
  const venvPosix = path.resolve(process.cwd(), '.venv', 'bin', 'python');
  if (process.platform === 'win32') {
    return fs.existsSync(venvWin) ? venvWin : 'python';
  }
  return fs.existsSync(venvPosix) ? venvPosix : 'python3';
}


// Persistent Python Engine Worker with Preloaded Model
let pythonWorker: ReturnType<typeof spawn> | null = null;
let pythonWorkerReady = false;
const pendingWorkerRequests = new Map<string, (data: any) => void>();
let workerRequestId = 0;
let workerBuffer = '';

function startPythonWorker() {
  try {
    const pythonBin = getPythonBin();
    const scriptPath = path.resolve(process.cwd(), 'cres_engine.py');

    console.log(`[CRES Server] Preloading fine-tuned model with Python (${pythonBin})...`);
    pythonWorker = spawn(pythonBin, [scriptPath, '--server']);

    pythonWorker.stdout?.on('data', (chunk) => {
      workerBuffer += chunk.toString();
      const lines = workerBuffer.split('\n');
      workerBuffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        if (trimmed === 'READY') {
          pythonWorkerReady = true;
          console.log('⚡ [CRES Server] Local model is preloaded into memory & ready for instant inference!');
          continue;
        }
        try {
          const parsed = JSON.parse(trimmed);
          if (parsed.id && pendingWorkerRequests.has(parsed.id)) {
            const resolve = pendingWorkerRequests.get(parsed.id)!;
            pendingWorkerRequests.delete(parsed.id);
            resolve(parsed.data || parsed);
          }
        } catch (err) {
          // ignore non-json worker output
        }
      }
    });

    pythonWorker.stderr?.on('data', (chunk) => {
      process.stderr.write(chunk.toString());
    });

    pythonWorker.on('close', (code) => {
      if (code !== 0 && code !== null) {
        console.warn(`[CRES Server] Python worker closed with code ${code}`);
      }
      pythonWorkerReady = false;
      pythonWorker = null;
    });

    // Cleanup child process on server exit
    process.on('exit', () => {
      if (pythonWorker) pythonWorker.kill();
    });
    process.on('SIGINT', () => {
      if (pythonWorker) pythonWorker.kill();
      process.exit();
    });
  } catch (err) {
    console.warn('[CRES Server] Could not launch persistent Python worker, falling back to on-demand execution:', err);
  }
}

// Function to run Python graph engine & local extraction
function runPythonEngine(data: { characters?: any[]; relationships?: any[]; text?: string }): Promise<any> {
  // Use warm persistent worker if ready
  if (pythonWorker && pythonWorkerReady) {
    return new Promise((resolve) => {
      const id = `req_${++workerRequestId}_${Date.now()}`;
      pendingWorkerRequests.set(id, resolve);
      pythonWorker!.stdin?.write(JSON.stringify({ id, payload: data }) + '\n');
    });
  }

  // Graceful fallback to on-demand process
  return new Promise((resolve) => {
    const pythonBin = getPythonBin();
    const py = spawn(pythonBin, [path.resolve(process.cwd(), 'cres_engine.py')]);
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
        console.warn('Python engine notice/error:', errorOutput);
      }
      try {
        const parsed = JSON.parse(output);
        resolve(parsed);
      } catch (e) {
        if (code !== 0) {
          console.warn('Failed to parse Python engine output:', e);
        }
        resolve(data);
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
    localModelReady: pythonWorkerReady,
    engine: 'cres-flan-t5-literary-re',
  });
});

// Primary CRES Extraction endpoint - Runs fine-tuned Flan-T5 model + NLTK pipeline
app.post('/api/extract-relations', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Story text content is required' });
    }

    const trimmedText = text.slice(0, 40000);

    // Process extraction with local fine-tuned model (cres-flan-t5-literary-re)
    const pythonResult = await runPythonEngine({
      characters: [],
      relationships: [],
      text: trimmedText,
    });

    const finalCharacters = pythonResult.characters || [];
    const finalRelationships = pythonResult.relationships || [];
    const finalModelUsed = pythonResult.modelUsed || 'cres-flan-t5-literary-re';

    res.json({
      characters: finalCharacters,
      relationships: finalRelationships,
      communities: pythonResult.communities || [],
      modelUsed: finalModelUsed,
      nlpStats: pythonResult.nlpStats || null,
      metrics: pythonResult.metrics || {
        nodeCount: finalCharacters.length,
        edgeCount: finalRelationships.length,
        topHub: finalCharacters[0]?.canonicalName || 'None',
        topBridge: finalCharacters[0]?.canonicalName || 'None',
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
  // Pre-load the fine-tuned Flan-T5 model immediately at server startup
  startPythonWorker();

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
