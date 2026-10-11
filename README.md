# Character Relation Extraction System (CRES)

An end-to-end NLP system for extracting character-relationship knowledge graphs from unstructured narrative text. The system leverages Large Language Models (Gemini) for robust named entity recognition, coreference resolution, and relationship classification, paired with a Python graph analytics engine for NetworkX topological modeling.

---

## Architecture Overview

```
                                      Unstructured Narrative Text
                                                  │
                                                  ▼
                         ┌─────────────────────────────────────────────────┐
                         │   Stage 1: LLM Extraction Pipeline              │
                         │   • Character Named Entity Recognition          │
                         │   • Coreference Resolution & Alias Clustering   │
                         │   • Relationship Classification (Kinship,       │
                         │     Romantic, Adversarial, Hierarchical, etc.)  │
                         │   • Sentiment Polarity (-1.0 to +1.0)           │
                         │   • Verbatim Quote Evidence Extraction          │
                         └─────────────────────────────────────────────────┘
                                                  │
                                                  ▼
                         ┌─────────────────────────────────────────────────┐
                         │   Stage 2: Python Graph Engine                  │
                         │   • Adjacency & Interaction Weighting           │
                         │   • Degree Centrality (Hubs)                    │
                         │   • Brandes' Betweenness Centrality (Bridges)   │
                         │   • Co-occurrence Interaction Matrix            │
                         └─────────────────────────────────────────────────┘
                                                  │
                                                  ▼
                         ┌─────────────────────────────────────────────────┐
                         │   Stage 3: Interactive Visualization & Export   │
                         │   • Force-directed D3 Knowledge Graph Canvas    │
                         │   • Co-occurrence Heatmap Matrix                │
                         │   • Standalone NetworkX Python Script Export    │
                         └─────────────────────────────────────────────────┘
```

---

## Key Features

1. **Multi-Chapter Literary Narrative Processing**:
   - Accurately processes complex, multi-chapter stories (such as the 7-chapter *Ravenwood Estate Mystery*).
   - Resolves surface-form aliases (e.g., *Ade &rarr; Adrian Blackwood*, *Cathy &rarr; Catherine*, *Bella &rarr; Isabella Moore*, *Inspector Shaw &rarr; Robert Shaw*, *John Price &rarr; Jonathan Blackwood*).
   - Preserves distinct entities sharing family surnames (*e.g., Margaret Blackwood vs. Sebastian Blackwood vs. Adrian Blackwood*).

2. **Standardized Relationship Taxonomy**:
   - **Kinship**: Spouses, siblings, parent-child, aunt-niece, adoptive ties.
   - **Romantic**: Lovers, fiancés, past affection.
   - **Adversarial**: Legal disputes, bitter rivalries, murder conspiracies.
   - **Hierarchical**: Lawyer-client, doctor-patient, employer-secretary.
   - **Alliance**: Trusted friends, mutual confidants.

3. **Python Graph Analytics**:
   - **Degree Centrality**: Identifies high-interaction character hubs.
   - **Betweenness Centrality**: Exact Brandes' algorithm identifying plot bridges.
   - **Interactive Co-occurrence Heatmap**: 2D grid matrix visualising interaction intensity.

4. **NetworkX Python Export**:
   - Generates ready-to-run Python code (`networkx` + `matplotlib`) to visualize and analyze the extracted graph locally.

---

## Project Structure

```
├── cres_engine.py             # Pure Python graph analytics & centrality engine
├── cres_pipeline.py           # Standalone Python CLI script for terminal usage
├── requirements.txt           # Python dependencies (networkx, matplotlib, google-genai)
├── .env.example               # Environment variables template
├── package.json               # Node.js dependencies & scripts
├── server.ts                  # Express backend with Gemini API proxy & Python bridge
├── src/
│   ├── App.tsx                # Main interactive workbench component
│   ├── components/
│   │   ├── Header.tsx         # Clean top bar
│   │   ├── NetworkGraph.tsx   # Interactive D3 force-directed graph
│   │   ├── TableInspector.tsx # Co-occurrence Heatmap & Character/Relation tables
│   │   ├── NodeDetailPanel.tsx# Character inspector with centrality & direct ties
│   │   ├── EdgeDetailPanel.tsx# Relationship inspector with quotes & sentiment
│   │   ├── PythonExportView.tsx# Standalone Python code viewer & downloader
│   │   └── StoryEditorModal.tsx# Story preset selector & text input
│   ├── nlp/
│   │   └── sampleStories.ts   # Curated test stories (including Ravenwood 7-Chapter Mystery)
│   └── types/
│       └── cres.ts            # TypeScript interfaces
```

---

## Setup & Running

### Option 1: Web Interface (Full-Stack)

1. **Clone repository**:
   ```bash
   git clone https://github.com/your-username/cres-project.git
   cd cres-project
   ```

2. **Install Node.js dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Copy `.env.example` to `.env` and insert your Gemini API Key:
   ```bash
   cp .env.example .env
   ```
   Add your key:
   ```env
   GEMINI_API_KEY="your_api_key_here"
   ```

4. **Start the development server**:
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` in your browser.

---

### Option 2: Standalone Python Script (Terminal CLI)

1. **Install Python dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

2. **Run analysis**:
   ```bash
   python3 cres_pipeline.py
   ```
   This will compute Degree & Betweenness centralities and generate `character_graph.png` using NetworkX and Matplotlib.

---

## License
MIT License
