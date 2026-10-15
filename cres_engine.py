#!/usr/bin/env python3
"""
CRES (Character Relation Extraction System) - Graph Analytics & NLP Inference Engine
====================================================================================
Integrates:
1. NLP Preprocessing Pipeline (Sentence Boundary, Tokenization, POS Tagging, WordNet Lemmatization & Synsets)
2. Fine-grained Relation Classification via:
   - Local fine-tuned Flan-T5 model (cres-flan-t5-final) when checkpoint is present
   - Enhanced rule & lexicon NLP extraction when running offline/fallback
3. Pure Python Network Centrality Metrics (Degree, Brandes' Betweenness) & Community Detection.
"""

import os
import sys
import json
import re
from collections import deque, defaultdict

# Force UTF-8 on Windows stdin/stdout to prevent CP1252 mojibake (e.g. Anil's -> Anilâ€™s)
if sys.platform == "win32":
    try:
        sys.stdin.reconfigure(encoding="utf-8")
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

# -- Import NLP Preprocessing Pipeline -----------------------------------------
try:
    from nlp_preprocess import (
        preprocess,
        extract_character_candidates,
        normalize_text,
        is_valid_character_name,
        NLTK_AVAILABLE
    )
except Exception:
    NLTK_AVAILABLE = False
    preprocess = None
    extract_character_candidates = None
    def normalize_text(t: str) -> str:
        return t
    def is_valid_character_name(n: str) -> bool:
        return bool(n and len(n) > 2 and re.match(r"^[A-Z][a-zA-Z\s\.\-']+$", n))


# -- Fine-grained Relation Taxonomy & Lexicon Patterns -------------------------
FINE_GRAINED_PATTERNS = {
    # Kinship Group
    "sibling": [
        r"\b(?:brother|sister|brothers|sisters|sibling|siblings)\b",
        r"\b(?:my|his|her|their)\s+(?:brother|sister)\b",
    ],
    "parent-child": [
        r"\b(?:father|mother|son|daughter|dad|mom|papa|mama|parent|child|children)\b",
        r"\b(?:father's|mother's|son's|daughter's)\b",
        r"\b(?:gave\s+birth|bore\s+him|bore\s+her|raised\s+by|offspring)\b",
    ],
    "spouse": [
        r"\b(?:husband|wife|married|marry|marriage|wedding|spouse|wedded|bride|groom)\b",
    ],
    "cousin": [
        r"\b(?:cousin|cousins)\b",
    ],
    "uncle-nephew": [
        r"\b(?:uncle|nephew)\b",
    ],
    "aunt-niece": [
        r"\b(?:aunt|niece)\b",
    ],
    "adoptive-parent": [
        r"\b(?:adopted|adoptive|foster|ward|guardian)\b",
    ],
    # Romantic Group
    "betrothed": [
        r"\b(?:betrothed|fianc[eé]|fianc[eé]e|engaged|engagement|courtship|woo|wooing)\b",
    ],
    "lovers": [
        r"\b(?:lovers?|romance|beloved|darling|dearest|sweetheart|passion|passionate|embraced|kissed)\b",
    ],
    "former-lovers": [
        r"\b(?:former\s+lover|past\s+love|broken\s+engagement|once\s+loved|estranged\s+lover|parted)\b",
    ],
    # Adversarial Group
    "enemy": [
        r"\b(?:enemy|enemies|foe|hostile|antagonist|hated|loathed|combat|war|destroy|treachery)\b",
    ],
    "rival": [
        r"\b(?:rival|rivalry|competing|competition|jealous|jealousy|outdo)\b",
    ],
    "nemesis": [
        r"\b(?:nemesis|vendetta|avenge|revenge|murdered|murderer|slain|kill|killed)\b",
    ],
    # Hierarchical Group
    "master-servant": [
        r"\b(?:master|servant|maid|butler|valet|footman|housekeeper|mistress)\b",
    ],
    "employer-employee": [
        r"\b(?:employer|employee|hired|employ|clerk|worker|assistant|subordinate)\b",
    ],
    "mentor-student": [
        r"\b(?:mentor|pupil|student|teacher|disciple|apprentice|tutored|guided)\b",
    ],
    "lawyer-client": [
        r"\b(?:lawyer|attorney|counsel|client|will|estate|testament|legal|solicitor)\b",
    ],
    "doctor-patient": [
        r"\b(?:doctor|physician|surgeon|patient|illness|treated|cured|prescribed)\b",
    ],
    "commander-subordinate": [
        r"\b(?:captain|commander|officer|general|lieutenant|sergeant|soldier|ordered|commanded)\b",
    ],
    # Alliance Group
    "friend": [
        r"\b(?:friend|friends|friendship|companion|companions|pal|chum|intimate)\b",
    ],
    "confidant": [
        r"\b(?:confidant|confidante|confided|secret|trusted|shared\s+confidence)\b",
    ],
    "ally": [
        r"\b(?:ally|allies|alliance|united|comrade|comrades|co-conspirator|partner)\b",
    ],
    # Neutral Group
    "colleague": [
        r"\b(?:colleague|colleagues|associate|associates|coworker)\b",
    ],
    "acquaintance": [
        r"\b(?:acquaintance|acquaintances|met|introduced|nodded|greeted|spoke\s+briefly)\b",
    ],
}

SYMMETRIC_RELATIONS = {
    "sibling", "spouse", "cousin", "friend", "enemy", "colleague",
    "acquaintance", "rival", "lovers", "betrothed", "former-lovers", "ally"
}

POSITIVE_WORDS = {
    'love', 'loved', 'loving', 'affection', 'friend', 'friendly', 'devoted',
    'kind', 'kindness', 'fond', 'fondness', 'adored', 'gentle', 'warm', 'trusted',
    'faithful', 'loyal', 'happy', 'rejoiced', 'smiled', 'laugh', 'peace', 'tender'
}

NEGATIVE_WORDS = {
    'hate', 'hated', 'hostile', 'enemy', 'anger', 'angry', 'bitter', 'cruel',
    'kill', 'killed', 'murder', 'betray', 'betrayed', 'distrust', 'scorn',
    'despise', 'furious', 'harsh', 'quarrel', 'fought', 'jealous', 'revenge'
}


# -- Local Fine-Tuned Model Loader ---------------------------------------------
_MODEL_CACHE = {}
HF_REPO_ID = "sagarsawlani/cres-flan-t5-literary-re"

def get_model_path():
    """Look for fine-tuned Flan-T5 model checkpoint directory with weights."""
    candidates = [
        os.environ.get("CRES_MODEL_PATH"),
        os.path.join(os.getcwd(), "cres-flan-t5-literary-re"),
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "cres-flan-t5-literary-re"),
        os.path.join(os.getcwd(), "cres-flan-t5-final"),
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "cres-flan-t5-final"),
        os.path.join(os.getcwd(), "model"),
        os.path.join(os.getcwd(), "cres_model")
    ]
    for c in candidates:
        if c and os.path.isdir(c):
            has_weights = (
                os.path.exists(os.path.join(c, "model.safetensors")) or 
                os.path.exists(os.path.join(c, "pytorch_model.bin"))
            )
            if has_weights:
                return c
    return None

def get_meta_file(model_path=None):
    """Find cres_label_meta.json in local directories."""
    candidates = []
    if model_path:
        candidates.append(os.path.join(model_path, "cres_label_meta.json"))
    candidates.extend([
        os.path.join(os.getcwd(), "cres-flan-t5-literary-re", "cres_label_meta.json"),
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "cres-flan-t5-literary-re", "cres_label_meta.json"),
        os.path.join(os.getcwd(), "cres-flan-t5-final", "cres_label_meta.json"),
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "cres-flan-t5-final", "cres_label_meta.json"),
        os.path.join(os.getcwd(), "cres_label_meta.json"),
    ])
    for p in candidates:
        if os.path.exists(p):
            return p
    return None

def load_finetuned_model():
    """Load cached or new instance of fine-tuned Seq2Seq model."""
    if "model" in _MODEL_CACHE:
        return _MODEL_CACHE["model"], _MODEL_CACHE["tokenizer"], _MODEL_CACHE.get("meta")

    model_path = get_model_path()
    meta_path = get_meta_file(model_path)
    meta = None
    if meta_path:
        try:
            with open(meta_path, "r", encoding="utf-8") as f:
                meta = json.load(f)
        except Exception as e:
            sys.stderr.write(f"CRES meta loader notice: {e}\n")

    load_source = model_path
    if not load_source:
        # Check if local folder exists (even if git-lfs weights are pending) or load from HF Hub
        local_folder = os.path.join(os.getcwd(), "cres-flan-t5-literary-re")
        if os.path.isdir(local_folder) and os.path.exists(os.path.join(local_folder, "config.json")):
            load_source = HF_REPO_ID
        else:
            return None, None, None

    try:
        from transformers import AutoModelForSeq2SeqLM, AutoTokenizer
        import torch

        tokenizer = AutoTokenizer.from_pretrained(load_source)
        model = AutoModelForSeq2SeqLM.from_pretrained(load_source)
        if torch.cuda.is_available():
            model = model.to("cuda")
        model.eval()

        _MODEL_CACHE["model"] = model
        _MODEL_CACHE["tokenizer"] = tokenizer
        _MODEL_CACHE["meta"] = meta
        return model, tokenizer, meta
    except Exception as e:
        sys.stderr.write(f"CRES Model loader notice: {e}\n")
        return None, None, None

def predict_relation_with_model(model, tokenizer, meta, passage: str, entity1: str, entity2: str) -> str:
    """Predict fine-grained relation using fine-tuned Flan-T5 weights matching training format."""
    fine_labels = meta.get("fine_labels") if meta else None

    # Compact instruction prompt matching the fine-tuning notebook
    prompt = (
        "Task: Identify the directed semantic relationship from Entity 1 to Entity 2. "
        "Use the literary passage as evidence. Return only one fine-grained relation label "
        "in the dataset's label format.\n"
        f"Entity 1: {entity1}\n"
        f"Entity 2: {entity2}\n"
        f"Passage: {passage.strip()}"
    )

    try:
        import torch
        device = next(model.parameters()).device
        inputs = tokenizer(prompt, return_tensors="pt", max_length=384, truncation=True).to(device)
        with torch.no_grad():
            outputs = model.generate(**inputs, max_new_tokens=32, num_beams=4)
        pred = tokenizer.decode(outputs[0], skip_special_tokens=True).strip().lower()

        # If prediction directly matches fine labels inventory
        if fine_labels:
            if pred in fine_labels:
                return pred
            for l in fine_labels:
                if l == pred or l in pred or pred in l:
                    return l

        if pred and len(pred) >= 2:
            return pred

        return "acquaintance"
    except Exception as e:
        sys.stderr.write(f"Inference generation error: {e}\n")
        return classify_by_rules(passage)


# -- Rule & Context Based Fine-Grained Classifier ------------------------------
def classify_by_rules(context_text: str) -> str:
    """Classifies a passage into a fine-grained relationship using compiled regex patterns."""
    text_lower = context_text.lower()
    best_label = "acquaintance"
    best_score = 0

    for label, patterns in FINE_GRAINED_PATTERNS.items():
        score = 0
        for pat in patterns:
            matches = re.findall(pat, text_lower)
            score += len(matches) * 2
        if score > best_score:
            best_score = score
            best_label = label

    return best_label

def calculate_sentiment(text: str) -> float:
    """Calculates sentiment polarity between -1.0 and 1.0."""
    words = re.findall(r'\b[a-z]+\b', text.lower())
    pos_count = sum(1 for w in words if w in POSITIVE_WORDS)
    neg_count = sum(1 for w in words if w in NEGATIVE_WORDS)
    total = pos_count + neg_count
    if total == 0:
        return 0.0
    return round((pos_count - neg_count) / float(total), 2)


# -- Full NLP Extraction Pipeline ---------------------------------------------
def fallback_extract(text: str):
    """
    NLP Preprocessing and Fine-grained Character & Relation Extraction.
    Uses:
      - NLTK Preprocessing Pipeline (Sentence Boundary, Tokenization, POS Tagging, WordNet Lemmatization)
      - Fine-tuned Seq2Seq model (if present) or Enhanced Lexicon Classifier
    """
    text = normalize_text(text)
    nlp_stats = None
    sentences = []

    # 1. Run Preprocessing Pipeline if available
    if NLTK_AVAILABLE and preprocess is not None:
        try:
            prep_res = preprocess(text)
            sentences = prep_res.sentences
            nlp_stats = prep_res.stats
            top_names = extract_character_candidates(text, top_n=10)
        except Exception as e:
            sys.stderr.write(f"NLP Preprocess error: {e}\n")
            top_names = []
    else:
        top_names = []

    # Fallback sentence tokenization if not produced
    if not sentences:
        paragraphs = [p.strip() for p in text.split('\n\n') if p.strip()]
        for p in (paragraphs or [text]):
            sents = re.split(r'(?<=[.!?])\s+', p)
            sentences.extend([s.strip() for s in sents if s.strip()])

    # Fallback proper noun detection if needed
    if not top_names:
        stop_words = {
            'the', 'this', 'that', 'then', 'they', 'when', 'what', 'where', 'meanwhile',
            'however', 'suddenly', 'perhaps', 'chapter', 'monday', 'tuesday', 'january',
            'london', 'england', 'hall', 'park', 'house', 'room', 'street', 'reprint',
            'footprints', 'feet', 'thief', 'story', 'glossary', 'read', 'find', 'page'
        }
        char_counts = defaultdict(int)
        for s in sentences:
            matches = re.findall(r'\b(?:(?:Mr\.|Mrs\.|Miss|Lord|Lady|Sir|King|Queen|Prince|Dr\.)\s+)?[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b', s)
            for m in matches:
                cleaned = re.sub(r"['’]s$", "", m.strip(), flags=re.IGNORECASE).strip()
                cleaned = re.sub(r"^['’\"“”\(\)\[\],.:;]+|['’\"“”\(\)\[\],.:;]+$", "", cleaned).strip()
                first_word = cleaned.split()[0].lower().replace('.', '')
                if first_word not in stop_words and len(cleaned) > 2:
                    char_counts[cleaned] += 1
        raw_candidates = sorted(char_counts.keys(), key=lambda x: char_counts[x], reverse=True)[:10]
    else:
        raw_candidates = top_names

    # Deduplicate possessives and validate candidates (e.g. Anil's -> Anil)
    cleaned_candidates = []
    seen_lower = set()
    for name in raw_candidates:
        clean_n = re.sub(r"['’]s$", "", name, flags=re.IGNORECASE).strip()
        clean_n = re.sub(r"^['’\"“”\(\)\[\],.:;]+|['’\"“”\(\)\[\],.:;]+$", "", clean_n).strip()
        if is_valid_character_name(clean_n) and clean_n.lower() not in seen_lower:
            seen_lower.add(clean_n.lower())
            cleaned_candidates.append(clean_n)

    top_candidates = cleaned_candidates[:8]
    if len(top_candidates) < 2:
        top_candidates = ["Protagonist", "Companion"]

    characters = []
    for idx, name in enumerate(top_candidates):
        characters.append({
            "id": f"c_{idx + 1}",
            "canonicalName": name,
            "aliases": [name],
            "primaryRole": "Protagonist" if idx == 0 else ("Deuteragonist" if idx == 1 else "Supporting"),
            "gender": "unknown",
            "mentionsCount": sum(1 for s in sentences if name in s)
        })

    # 2. Co-occurrences and Relation Classification
    pair_counts = defaultdict(int)
    pair_snippets = defaultdict(list)

    for s in sentences:
        present = [c for c in top_candidates if c in s]
        for i in range(len(present)):
            for j in range(i + 1, len(present)):
                pair = tuple(sorted([present[i], present[j]]))
                pair_counts[pair] += 1
                if len(pair_snippets[pair]) < 3:
                    pair_snippets[pair].append(s[:250])

    # Check for local fine-tuned model
    model, tokenizer, meta = load_finetuned_model()
    model_used = "cres-flan-t5-literary-re" if model is not None else "cres_nlp_preprocessing_engine"

    relationships = []
    for (src, tgt), count in pair_counts.items():
        combined_context = " ".join(pair_snippets[(src, tgt)])
        
        # Predict fine-grained relation type
        if model is not None and tokenizer is not None:
            fine_rel = predict_relation_with_model(model, tokenizer, meta, combined_context, src, tgt)
        else:
            fine_rel = classify_by_rules(combined_context)

        sentiment = calculate_sentiment(combined_context)
        directionality = "undirected" if fine_rel in SYMMETRIC_RELATIONS else "directed"

        relationships.append({
            "source": src,
            "target": tgt,
            "relationType": fine_rel,
            "sentiment": sentiment,
            "weight": min(10, max(1, count)),
            "evidenceQuotes": pair_snippets[(src, tgt)],
            "summary": f"{src} and {tgt} share a {fine_rel} relationship.",
            "directionality": directionality
        })

    return characters, relationships, nlp_stats, model_used


# -- Graph Centrality & Faction Analytics --------------------------------------
def compute_graph_metrics(characters, relationships):
    """
    Computes graph centrality metrics and community factions in pure Python.
    """
    node_names = [c["canonicalName"] for c in characters]
    node_set = set(node_names)
    
    # Map both ID and lowercased name to canonicalName
    id_map = {}
    for c in characters:
        c_name = c["canonicalName"]
        id_map[c_name] = c_name
        id_map[c_name.lower()] = c_name
        if "id" in c:
            id_map[c["id"]] = c_name
            id_map[c["id"].lower()] = c_name

    adj = defaultdict(list)
    edge_weights = defaultdict(int)
    
    for r in relationships:
        raw_src = r.get("source", "")
        raw_tgt = r.get("target", "")
        src = id_map.get(raw_src) or id_map.get(str(raw_src).lower()) or raw_src
        tgt = id_map.get(raw_tgt) or id_map.get(str(raw_tgt).lower()) or raw_tgt
        weight = r.get("weight", 1)
        if src in node_set and tgt in node_set and src != tgt:
            if tgt not in adj[src]:
                adj[src].append(tgt)
            if src not in adj[tgt]:
                adj[tgt].append(src)
            edge_weights[(src, tgt)] = weight
            edge_weights[(tgt, src)] = weight

    degrees = {node: len(adj[node]) for node in node_names}
    
    # Brandes' Betweenness Centrality
    betweenness = {node: 0.0 for node in node_names}
    for s in node_names:
        stack = []
        pred = defaultdict(list)
        sigma = dict.fromkeys(node_names, 0)
        d = dict.fromkeys(node_names, -1)
        
        sigma[s] = 1
        d[s] = 0
        queue = deque([s])
        
        while queue:
            v = queue.popleft()
            stack.append(v)
            for w in adj[v]:
                if d[w] < 0:
                    d[w] = d[v] + 1
                    queue.append(w)
                if d[w] == d[v] + 1:
                    sigma[w] += sigma[v]
                    pred[w].append(v)
                    
        delta = dict.fromkeys(node_names, 0.0)
        while stack:
            w = stack.pop()
            for v in pred[w]:
                c_val = (sigma[v] / (sigma[w] or 1)) * (1.0 + delta[w])
                delta[v] += c_val
            if w != s:
                betweenness[w] += delta[w]

    n = len(node_names)
    norm = ((n - 1) * (n - 2)) / 2.0 if n > 2 else 1.0
    for node in node_names:
        betweenness[node] = round(betweenness[node] / (2.0 * norm), 3)

    # Community Clustering
    visited = set()
    communities = []
    comm_palette = ["#6366f1", "#ec4899", "#10b981", "#f59e0b", "#06b6d4", "#8b5cf6", "#ef4444"]
    comm_id = 0
    node_to_comm = {}
    
    for node in node_names:
        if node not in visited:
            component = []
            q = deque([node])
            visited.add(node)
            while q:
                curr = q.popleft()
                component.append(curr)
                node_to_comm[curr] = comm_id
                for neighbor in adj[curr]:
                    if neighbor not in visited:
                        visited.add(neighbor)
                        q.append(neighbor)
            
            communities.append({
                "id": comm_id,
                "name": f"Group {comm_id + 1}",
                "color": comm_palette[comm_id % len(comm_palette)],
                "members": component
            })
            comm_id += 1

    enriched_characters = []
    for c in characters:
        name = c["canonicalName"]
        c_copy = dict(c)
        c_copy["communityId"] = node_to_comm.get(name, 0)
        c_copy["color"] = comm_palette[node_to_comm.get(name, 0) % len(comm_palette)]
        c_copy["centrality"] = {
            "degree": degrees.get(name, 0),
            "betweenness": betweenness.get(name, 0.0)
        }
        enriched_characters.append(c_copy)

    top_hub = max(node_names, key=lambda x: degrees.get(x, 0)) if node_names else "None"
    top_bridge = max(node_names, key=lambda x: betweenness.get(x, 0)) if node_names else "None"

    return {
        "characters": enriched_characters,
        "relationships": relationships,
        "communities": communities,
        "metrics": {
            "nodeCount": len(node_names),
            "edgeCount": len(relationships),
            "topHub": top_hub,
            "topBridge": top_bridge
        }
    }


def process_payload(data: dict) -> dict:
    chars = data.get("characters", [])
    rels = data.get("relationships", [])
    text = data.get("text", "")
    nlp_stats = None
    model_used = None

    # If characters are empty, run full NLP preprocessing & relation extraction
    if not chars and text:
        chars, rels, nlp_stats, model_used = fallback_extract(text)
    
    result = compute_graph_metrics(chars, rels)
    if nlp_stats:
        result["nlpStats"] = nlp_stats
    if model_used:
        result["modelUsed"] = model_used

    return result


def server_loop():
    """Persistent worker mode: preloads model into memory on startup and streams requests."""
    sys.stderr.write("[CRES Engine] Initializing persistent worker...\n")
    sys.stderr.write("[CRES Engine] Preloading fine-tuned Flan-T5 model ('cres-flan-t5-literary-re') into RAM/VRAM...\n")
    sys.stderr.flush()
    
    # Preload model right now!
    model, tokenizer, meta = load_finetuned_model()
    if model is not None:
        sys.stderr.write("✅ [CRES Engine] Fine-tuned model 'cres-flan-t5-literary-re' preloaded and ready for instant inference!\n")
    else:
        sys.stderr.write("ℹ️ [CRES Engine] Local model weights not found, worker ready with algorithmic NLP engine.\n")
    sys.stderr.flush()

    # Inform Node server that model is loaded and ready
    print("READY", flush=True)

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
            req_id = req.get("id")
            payload = req.get("payload", {})
            res = process_payload(payload)
            print(json.dumps({"id": req_id, "data": res}), flush=True)
        except Exception as e:
            sys.stderr.write(f"[CRES Engine Error] {e}\n")
            sys.stderr.flush()
            req_id = req.get("id") if "req" in locals() and isinstance(req, dict) else None
            print(json.dumps({"id": req_id, "error": str(e)}), flush=True)


def main():
    if "--server" in sys.argv or "--daemon" in sys.argv:
        server_loop()
        return

    try:
        raw_input = sys.stdin.read()
        if not raw_input.strip():
            print(json.dumps({"error": "Empty input"}))
            return
            
        data = json.loads(raw_input)
        result = process_payload(data)
        print(json.dumps(result))
    except Exception as e:
        sys.stderr.write(f"CRES engine error: {e}\n")
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
