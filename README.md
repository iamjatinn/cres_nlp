# Character Relation Extraction System (CRES)

An end-to-end computational linguistics system for extracting character-relationship knowledge graphs from unstructured narrative text and literary PDFs. The system pairs essential NLP preprocessing (Sentence Boundary Detection, Tokenization, POS Tagging, WordNet Lemmatization & Synsets) with a locally fine-tuned Seq2Seq Language Model (`google/flan-t5-base`), fine-grained relationship classification (`sibling`, `spouse`, `friend`, `enemy`, `companion_of`, etc.), and a Python NetworkX graph analytics engine for topological centrality modeling.

The application runs **100% locally and offline** without requiring external cloud LLMs or API keys.

---

## Architecture Overview

```
                                      Unstructured Story Text / PDF
                                                    │
                                                    ▼
                           ┌─────────────────────────────────────────────────┐
                           │   Stage 1: NLP Preprocessing Pipeline           │
                           │   • PDF Layer Extraction & Boilerplate Cleaning │
                           │   • Sentence Boundary Identification            │
                           │   • Tokenization (Word & Punctuation)           │
                           │   • POS Tagging (Penn Treebank - Compulsory)    │
                           │   • Lemmatization (POS-aware WordNet)           │
                           │   • Semantic Analysis (WordNet Synsets)         │
                           └─────────────────────────────────────────────────┘
                                                    │
                                                    ▼
                           ┌─────────────────────────────────────────────────┐
                           │   Stage 2: Character & Relation Extraction      │
                           │   • Local Fine-Tuned FLAN-T5 Model              │
                           │     (`cres-flan-t5-literary-re` in memory)      │
                           │   • Fine-grained Relationship Classification:   │
                           │     sibling, spouse, parent-child, cousin,      │
                           │     friend, enemy, companion_of, mentor, etc.   │
                           │   • Sentiment Polarity & Interaction Weights    │
                           └─────────────────────────────────────────────────┘
                                                    │
                                                    ▼
                           ┌─────────────────────────────────────────────────┐
                           │   Stage 3: Python Graph Centrality Engine       │
                           │   • Adjacency Matrix & Interaction Weighting    │
                           │   • Degree Centrality (Interaction Hubs)        │
                           │   • Brandes' Betweenness Centrality (Bridges)   │
                           │   • Louvain / Greedy Community Clustering       │
                           └─────────────────────────────────────────────────┘
                                                    │
                                                    ▼
                           ┌─────────────────────────────────────────────────┐
                           │   Stage 4: Interactive D3 Visualizer & UI       │
                           │   • Force-directed D3 Knowledge Graph Canvas    │
                           │   • Real-Time PDF & Text Upload Modal           │
                           │   • Characters & Relations Table Inspector      │
                           │   • Color-coded Community Factions & Centrality │
                           └─────────────────────────────────────────────────┘
```

---

## Key Features

1. **Essential NLP Preprocessing Pipeline (`nlp_preprocess.py`)**:
   - **Sentence Boundary Identification**: Detects sentence boundaries with period and abbreviation disambiguation.
   - **Tokenization**: Segments narrative text into word and punctuation tokens.
   - **Part-of-Speech (POS) Tagging [Compulsory]**: NNP/NNPS proper noun sequence detection with possessive clitic stripping (`'s`) and stopword filtering.
   - **Lemmatization**: POS-aware lemmatization mapping Penn tags to WordNet categories (`ADJ`, `VERB`, `NOUN`, `ADV`).
   - **Semantic Analysis [Compulsory]**: WordNet synset mapping, sense definitions, and semantic coverage statistics.

2. **Fine-Tuned Seq2Seq Model (`cres-flan-t5-literary-re`)**:
   - Fine-tuned checkpoint of `google/flan-t5-base` trained on narrative literary datasets (`project-gutenberg-fiction-relations`).
   - Fine-grained relation classification without lossy bucketing.
   - **Preloaded Persistent Worker**: The model weights stay warm in RAM for rapid sub-3 second local inference.
   - **Complete Privacy & Offline Execution**: Zero cloud API dependencies or `.env` requirements.

3. **Fine-Grained Relationship Taxonomy**:
   - **Kinship**: `sibling`, `parent-child`, `spouse`, `cousin`, `aunt-niece`, `uncle-nephew`, `relative_of`.
   - **Alliance & Social**: `friend`, `companion_of`, `confidant`, `ally`, `comrade`.
   - **Hierarchical**: `employer-employee`, `master-servant`, `mentor-student`, `doctor-patient`.
   - **Adversarial**: `enemy`, `rival`, `nemesis`, `adversary`.
   - **Spatial / Contextual**: `lives_in`, `associated_with`, `part_of`.

4. **PDF & Story Upload Capabilities**:
   - Direct support for uploading `.pdf` and `.txt` narrative files.
   - Automatic textbook boilerplate stripping: cleans NCERT running headers/footers (`Footprints without Feet`, `Reprint 2026-27`, `READ AND FIND OUT`, study questions).
   - Real-time loading progress with modal synchronization.

5. **Graph Centrality & Community Analytics**:
   - **Degree Centrality**: Identifies high-interaction character hubs.
   - **Betweenness Centrality**: Exact Brandes' algorithm identifying plot bridges.
   - **Community Clustering**: Automatic faction detection with dedicated chromatic palettes.
   - **Interactive Inspector**: Inspect individual character nodes, degree distribution, and direct relationship ties.

---

## Project Structure

```
├── cres_finetune.ipynb        # 16-cell Google Colab fine-tuning & evaluation notebook
├── nlp_preprocess.py          # 5-stage NLP Preprocessing Pipeline (Tokenization, POS, WordNet)
├── cres_engine.py             # Python graph analytics, local model inference & persistent server worker
├── cres_pipeline.py           # Standalone Python CLI script for terminal graph plotting
├── test_pdf_pipeline.py       # Automated internal test harness for literature story PDFs
├── requirements.txt           # Python dependencies (NLTK, transformers, torch, networkx, pypdf)
├── server.ts                  # Express backend running warm in-memory model worker & Vite dev middleware
├── src/
│   ├── App.tsx                # Main workbench component (Graph & Table views)
│   ├── components/
│   │   ├── Header.tsx         # Top bar & view switcher
│   │   ├── NetworkGraph.tsx   # Interactive D3 force-directed graph canvas
│   │   ├── TableInspector.tsx # Characters & Relations searchable table inspector
│   │   ├── NodeDetailPanel.tsx# Character inspector with centrality metrics & direct ties
│   │   ├── EdgeDetailPanel.tsx# Relationship inspector with interaction weights & sentiments
│   │   └── StoryEditorModal.tsx# Story preset selector, text cleaner & PDF/TXT uploader
│   ├── nlp/
│   │   ├── nlpEngine.ts       # Client-side relation pattern matcher & tokenizer
│   │   └── sampleStories.ts   # Preset stories (The Thief's Story, Pride & Prejudice, etc.)
│   └── types/
│       └── cres.ts            # TypeScript interfaces for characters, edges, and graph metrics
```

---

## Setup & Running Locally

### Prerequisites
- **Node.js** (v18 or higher)
- **Python** (v3.10 or higher)

### 1. Install Dependencies

```bash
# 1. Install frontend & Node.js dependencies
npm install

# 2. Install Python dependencies (NLTK, PyTorch, Transformers, NetworkX, pypdf)
pip install -r requirements.txt
```

### 2. Download the Fine-Tuned Model Checkpoint

Clone the fine-tuned model repository directly from Hugging Face into the project root:

```bash
git clone https://huggingface.co/sagarsawlani/cres-flan-t5-literary-re
```

Ensure the fine-tuned model checkpoint is present at:
```
cres_nlp/cres-flan-t5-literary-re/
├── config.json
├── model.safetensors
├── tokenizer.json
├── spiece.model
└── cres_label_meta.json
```
*(Alternatively, run `cres_finetune.ipynb` in Google Colab to train fresh checkpoint weights).*

### 3. Start the Application

```bash
npm run dev
```

1. The server starts at `http://localhost:3000`.
2. The fine-tuned Flan-T5 model is automatically preloaded into RAM on startup.
3. Open `http://localhost:3000` in your browser.

---

## Usage

1. **Select or Upload a Story**:
   - Click **"Select / Input Story"** in the top navigation bar.
   - Choose one of the built-in literary presets or click **"Upload .txt or .pdf"** to upload any narrative file.
2. **Run Extraction**:
   - Click **"Run Extraction"**. The modal will show progress while the local NLP engine and model process the narrative.
3. **Explore Knowledge Graph**:
   - **Knowledge Graph View**: Drag nodes, zoom in/out, and click characters to inspect their centrality metrics, degree hubs, and direct connection ties.
   - **Characters & Relations View**: Switch views to inspect tabular statistics, aliases, sentiment polarity, and interaction weights.

---

## Standalone Terminal CLI

To run the pipeline and generate a standalone graph image without launching the web server:

```bash
python cres_pipeline.py
```
This computes NetworkX degree and betweenness centralities and exports `character_graph.png`.

---

## License
MIT License
