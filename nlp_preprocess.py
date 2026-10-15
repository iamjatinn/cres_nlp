#!/usr/bin/env python3
"""
CRES NLP Preprocessing Pipeline
================================
Implements all required preprocessing stages before LLM inference or
fine-tuned model inference:

    Stage 1  ->  Sentence Boundary Identification  (nltk.sent_tokenize)
    Stage 2  ->  Tokenization                       (nltk.word_tokenize)
    Stage 3  ->  POS Tagging                        (nltk.pos_tag)          [COMPULSORY]
    Stage 4  ->  Lemmatization                      (WordNetLemmatizer)
    Stage 5  ->  Semantic Analysis                  (WordNet synsets)        [COMPULSORY]

Output is a structured PreprocessResult dataclass that downstream modules
(cres_engine.py, fine-tuning notebook, evaluation scripts) can consume.

Usage
-----
    from nlp_preprocess import preprocess, PreprocessResult

    result = preprocess("Elizabeth walked into the room. Darcy followed.")
    print(result.sentences)       # ['Elizabeth walked into the room.', 'Darcy followed.']
    print(result.pos_tags)        # [[('Elizabeth', 'NNP'), ...], ...]
    print(result.synset_map)      # {'walk': ['walk.v.01', ...], ...}
    print(result.clean_text)      # 'elizabeth walk room darcy follow'

CLI usage (for pipeline debugging)
-----------------------------------
    echo "Some text." | python nlp_preprocess.py
    python nlp_preprocess.py --text "Some text." --verbose
    python nlp_preprocess.py --file mynovel.txt --output results.json
"""

from __future__ import annotations

import re
import sys
import json
import argparse
import logging
from dataclasses import dataclass, field, asdict
from typing import Dict, List, Optional, Tuple

# -- NLTK imports --------------------------------------------------------------
try:
    import nltk
    from nltk.tokenize import sent_tokenize, word_tokenize
    from nltk.stem import WordNetLemmatizer
    from nltk.corpus import wordnet
    from nltk import pos_tag as nltk_pos_tag
    NLTK_AVAILABLE = True
except ImportError:
    NLTK_AVAILABLE = False


logger = logging.getLogger(__name__)

# -- NLTK resource bootstrapper ------------------------------------------------

NLTK_RESOURCES = [
    ("tokenizers/punkt",                      "punkt"),
    ("tokenizers/punkt_tab",                  "punkt_tab"),
    ("taggers/averaged_perceptron_tagger_eng", "averaged_perceptron_tagger_eng"),
    ("corpora/wordnet",                       "wordnet"),
    ("corpora/omw-1.4",                       "omw-1.4"),
]


def _ensure_nltk_resources() -> None:
    """Download any missing NLTK resources silently."""
    if not NLTK_AVAILABLE:
        raise ImportError(
            "nltk is not installed. Run: pip install nltk"
        )
    for resource_path, resource_name in NLTK_RESOURCES:
        try:
            nltk.data.find(resource_path)
        except LookupError:
            logger.info("Downloading NLTK resource: %s", resource_name)
            nltk.download(resource_name, quiet=True)


# -- Penn Treebank -> WordNet POS mapper ---------------------------------------

def penn_to_wordnet_pos(penn_tag: str) -> str:
    """
    Convert a Penn Treebank POS tag to a WordNet POS constant.

    Mapping:
        J* (adjective)  -> wordnet.ADJ  ('a')
        V* (verb)       -> wordnet.VERB ('v')
        N* (noun)       -> wordnet.NOUN ('n')
        R* (adverb)     -> wordnet.ADV  ('r')
        *   (fallback)  -> wordnet.NOUN ('n')

    This is used by WordNetLemmatizer to select the correct morphological
    form and by WordNet synset lookup to filter sense candidates.
    """
    if penn_tag.startswith("J"):
        return wordnet.ADJ
    elif penn_tag.startswith("V"):
        return wordnet.VERB
    elif penn_tag.startswith("N"):
        return wordnet.NOUN
    elif penn_tag.startswith("R"):
        return wordnet.ADV
    return wordnet.NOUN  # conservative default


# -- Output dataclass ----------------------------------------------------------

@dataclass
class PreprocessResult:
    """
    Structured output of the full NLP preprocessing pipeline.

    Attributes
    ----------
    sentences : List[str]
        Detected sentence boundaries (Stage 1).

    tokens : List[List[str]]
        Word tokens per sentence (Stage 2).

    pos_tags : List[List[Tuple[str, str]]]
        (token, Penn-Treebank-POS) pairs per sentence (Stage 3 -- compulsory).
        Example: [('Elizabeth', 'NNP'), ('walked', 'VBD'), ...]

    lemmas : List[List[str]]
        POS-aware lemmas per sentence (Stage 4).
        Example: [['elizabeth', 'walk', 'room'], ...]

    synset_map : Dict[str, List[str]]
        Maps each content-word lemma to its top-3 WordNet synset names
        (Stage 5 -- compulsory).
        Example: {'walk': ['walk.v.01', 'walk.v.02', 'walk.v.03'], ...}

    clean_text : str
        Flat, whitespace-joined, lowercased lemma string suitable as
        model input or for downstream bag-of-words features.

    named_entities : List[str]
        Proper-noun tokens (NNP / NNPS POS tags) detected during tagging.
        Used by cres_engine.py as a fast character candidate list.

    stats : Dict[str, int]
        Lightweight statistics: sentence count, token count, unique lemma count.
    """

    sentences      : List[str]                   = field(default_factory=list)
    tokens         : List[List[str]]             = field(default_factory=list)
    pos_tags       : List[List[Tuple[str, str]]] = field(default_factory=list)
    lemmas         : List[List[str]]             = field(default_factory=list)
    synset_map     : Dict[str, List[str]]        = field(default_factory=dict)
    clean_text     : str                         = ""
    named_entities : List[str]                   = field(default_factory=list)
    stats          : Dict[str, int]              = field(default_factory=dict)


# -- Core preprocessing function -----------------------------------------------

def preprocess(
    text: str,
    max_synsets: int = 3,
    min_lemma_len: int = 3,
    named_entity_pos: Tuple[str, ...] = ("NNP", "NNPS"),
) -> PreprocessResult:
    """
    Run the full CRES NLP preprocessing pipeline on a text string.

    Parameters
    ----------
    text : str
        Raw input text (one passage or a full chapter).
    max_synsets : int
        Maximum number of WordNet synsets to record per lemma.
    min_lemma_len : int
        Minimum character length for a lemma to be included in clean_text
        and synset_map (filters short tokens like 'a', 'be').
    named_entity_pos : tuple
        Penn Treebank POS tags considered as named entities.
        Default: ('NNP', 'NNPS') -- singular and plural proper nouns.

    Returns
    -------
    PreprocessResult
        Fully populated result object. See PreprocessResult docstring.

    Pipeline
    --------
    1. Sentence Boundary Identification   -- nltk.sent_tokenize
    2. Word Tokenization                  -- nltk.word_tokenize (per sentence)
    3. POS Tagging                        -- nltk.pos_tag       [COMPULSORY]
    4. Lemmatization                      -- WordNetLemmatizer  (POS-aware)
    5. Semantic Analysis                  -- wordnet.synsets    [COMPULSORY]
    """
    _ensure_nltk_resources()
    lemmatizer = WordNetLemmatizer()

    # -- Stage 1: Sentence Boundary Identification ----------------------------
    # sent_tokenize uses the Punkt unsupervised sentence boundary detector,
    # trained on English -- handles abbreviations, ellipses, etc.
    raw_text = text.strip()
    sentences: List[str] = sent_tokenize(raw_text)

    # -- Stage 2: Tokenization ------------------------------------------------
    # word_tokenize applies Penn Treebank tokenizer rules:
    # separates punctuation, handles contractions ("don't" -> "do", "n't"), etc.
    tokens: List[List[str]] = [word_tokenize(s) for s in sentences]

    # -- Stage 3: POS Tagging (COMPULSORY) ------------------------------------
    # nltk.pos_tag uses the averaged perceptron tagger (Penn WSJ corpus).
    # Tags follow Penn Treebank tagset: NN, NNP, VBD, JJ, RB, etc.
    pos_tags: List[List[Tuple[str, str]]] = [
        nltk_pos_tag(sent_tokens)
        for sent_tokens in tokens
    ]

    # -- Stage 4: Lemmatization (POS-aware) -----------------------------------
    # WordNetLemmatizer maps inflected forms to their base form using WordNet
    # morphological exception lists and stripping rules.
    # POS is converted from Penn Treebank to WordNet format for accuracy:
    #   "running" (VBG) -> lemmatize("running", pos='v') = "run"
    #   "better"  (JJR) -> lemmatize("better",  pos='a') = "good"
    lemmas: List[List[str]] = [
        [
            lemmatizer.lemmatize(tok, pos=penn_to_wordnet_pos(tag))
            for tok, tag in sent_tagged
        ]
        for sent_tagged in pos_tags
    ]

    # -- Stage 5: Semantic Analysis via WordNet (COMPULSORY) ------------------
    # For each unique alpha lemma above the minimum length threshold,
    # query WordNet for its synsets (ordered by corpus frequency).
    # Each synset is a set of cognitive synonyms with a gloss and examples.
    # Example: walk.v.01 -> "walk" (use your feet to move; advance by steps)
    # We store only the top-k synset names for memory efficiency.
    synset_map: Dict[str, List[str]] = {}
    named_entities: List[str] = []

    for sent_lemmas, sent_tagged in zip(lemmas, pos_tags):
        for lem, (orig_tok, tag) in zip(sent_lemmas, sent_tagged):
            # Collect named-entity candidates (proper nouns)
            if tag in named_entity_pos and orig_tok.isalpha():
                if orig_tok not in named_entities:
                    named_entities.append(orig_tok)

            # Build synset map for content words only
            if lem.isalpha() and len(lem) >= min_lemma_len and lem not in synset_map:
                wn_pos = penn_to_wordnet_pos(tag)
                synsets = wordnet.synsets(lem, pos=wn_pos)
                if synsets:
                    synset_map[lem] = [s.name() for s in synsets[:max_synsets]]
                elif wordnet.synsets(lem):
                    # fallback: try without POS filter
                    synset_map[lem] = [s.name() for s in wordnet.synsets(lem)[:max_synsets]]

    # -- Build clean_text -----------------------------------------------------
    # Flat lowercase lemma string -- used as model input or BoW feature vector.
    # Punctuation tokens are excluded via isalpha() filter.
    clean_text: str = " ".join(
        lem.lower()
        for sent_lemmas in lemmas
        for lem in sent_lemmas
        if lem.isalpha() and len(lem) >= min_lemma_len
    )

    # -- Stats ----------------------------------------------------------------
    all_tokens = [tok for sent in tokens for tok in sent]
    all_lemmas = [lem for sent in lemmas for lem in sent if lem.isalpha()]
    stats = {
        "sentence_count"     : len(sentences),
        "token_count"        : len(all_tokens),
        "unique_token_count" : len(set(t.lower() for t in all_tokens if t.isalpha())),
        "unique_lemma_count" : len(set(l.lower() for l in all_lemmas)),
        "named_entity_count" : len(named_entities),
        "synset_coverage"    : len(synset_map),
    }

    return PreprocessResult(
        sentences      = sentences,
        tokens         = tokens,
        pos_tags       = pos_tags,
        lemmas         = lemmas,
        synset_map     = synset_map,
        clean_text     = clean_text,
        named_entities = named_entities,
        stats          = stats,
    )


# -- Batch preprocessing (for dataset-scale use) -------------------------------

def preprocess_batch(
    texts: List[str],
    **kwargs,
) -> List[PreprocessResult]:
    """
    Preprocess a list of passages (used during fine-tuning dataset prep).

    Parameters
    ----------
    texts : List[str]
        List of raw text passages.
    **kwargs
        Forwarded to preprocess().

    Returns
    -------
    List[PreprocessResult]
        One result per input text.
    """
    _ensure_nltk_resources()
    results = []
    for i, text in enumerate(texts):
        try:
            results.append(preprocess(text, **kwargs))
        except Exception as exc:
            logger.warning("preprocess_batch: skipping item %d -- %s", i, exc)
            results.append(PreprocessResult())
    return results


# -- Text normalization helper -------------------------------------------------

def normalize_text(text: str) -> str:
    """Normalize UTF-8 mojibake, smart quotes, and encoding artifacts."""
    if not text:
        return ""
    t = text
    # Fix UTF-8 decoded as CP1252/Latin-1 (e.g. â€™ -> ')
    t = t.replace("â€™", "'").replace("â€œ", '"').replace("â€\x9d", '"')
    t = t.replace("â€”", "—").replace("â€“", "–").replace("â€¦", "...")
    t = t.replace("â€˜", "'")
    # Normalize unicode curly punctuation to clean ASCII
    t = re.sub(r"[\u2018\u2019\u201A\u201B\u0060\u00B4]", "'", t)
    t = re.sub(r"[\u201C\u201D\u201E\u201F]", '"', t)
    t = re.sub(r"[\u2013\u2014]", "—", t)
    # Replace non-breaking spaces and box glyphs commonly produced by PDF converters
    t = re.sub(r"[\u2022\u25CF\u25CB\u25AA\u25AB\u25A0\u25A1\uFFFD\u00A0\uFEFF]", " ", t)
    return t


# Non-character book boilerplate, headings, locations, and common narrative noise words
NON_CHARACTER_WORDS = {
    'reprint', 'footprints', 'feet', 'chapter', 'story', 'thief', "thief's story",
    'thief story', 'glossary', 'read', 'find', 'page', 'question', 'questions',
    'exercises', 'think', 'talk', 'suggested', 'reading', 'book', 'author', 'notes',
    'the', 'this', 'that', 'then', 'they', 'when', 'what', 'where', 'meanwhile',
    'however', 'suddenly', 'perhaps', 'monday', 'tuesday', 'january', 'february',
    'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october',
    'november', 'december', 'london', 'england', 'india', 'room', 'street',
    'express', 'lucknow', 'bazaar', 'shop', 'clock', 'tower', 'hotel', 'station',
    'sweet shop', 'jumna sweet shop', 'jumna', 'who', 'how', 'why', 'part', 'volume',
    'and', 'or', 'out', 'without', 'about', 'did', 'do', 'does', 'had', 'has', 'have',
    'could', 'would', 'should', 'can', 'might', 'must', 'shall', 'will',
    'was', 'were', 'is', 'are', 'am', 'been', 'being', 'having', 'yes', 'no',
    'oh', 'ah', 'well', 'now', 'here', 'there', 'come', 'go', 'see', 'look',
    'paris', 'boston', 'berlin', 'french', 'german', 'american', 'british',
    'grange', 'shotover', 'shotover grange', 'triumph', 'surgery', 'trust',
    'hello', 'horlicks', 'poor', 'ther', 'pr', 'hay'
}


def is_valid_character_name(name: str) -> bool:
    """Strictly validate whether a candidate string can be a real character name."""
    if not name or len(name) < 2 or len(name) > 35:
        return False
    
    # Must only contain standard alphabet letters, spaces, hyphens, and periods (e.g. "Dr. Watson")
    # Filters out mojibake like â€¢, â€“ or symbols
    if re.search(r"[^a-zA-Z\s\.\-']", name):
        return False

    words = [w.strip(".'") for w in name.split() if w.strip(".'")]
    if not words or len(words) > 3:
        return False

    # Disallow spaced-out single letters (e.g. "R EAD", "F IND")
    if any(len(w) == 1 and w not in ("I", "A") for w in words):
        return False

    # Filter out stopwords and textbook noise words
    for w in words:
        wl = w.lower()
        if wl in NON_CHARACTER_WORDS:
            return False

    return True


# -- Entity extraction helper (used by cres_engine.py) ------------------------

def extract_character_candidates(text: str, top_n: int = 20) -> List[str]:
    """
    Fast proper-noun extraction using POS tagging.

    Identifies NNP / NNPS tokens, merges consecutive proper-noun sequences
    into full names (e.g. ['Elizabeth', 'Bennet'] -> 'Elizabeth Bennet'),
    strips possessive clitics ('s, ’s), strictly filters boilerplate, and returns top-N.
    """
    _ensure_nltk_resources()

    clean_narrative = normalize_text(text)
    sentences = sent_tokenize(clean_narrative)
    name_freq: Dict[str, int] = {}

    for sent in sentences:
        toks = word_tokenize(sent)
        tagged = nltk_pos_tag(toks)

        # Merge consecutive NNP/NNPS tokens into full name spans
        i = 0
        while i < len(tagged):
            tok, tag = tagged[i]
            if tag in ("NNP", "NNPS"):
                span = [tok]
                j = i + 1
                while j < len(tagged) and tagged[j][1] in ("NNP", "NNPS"):
                    span.append(tagged[j][0])
                    j += 1
                full_name = " ".join(span).strip()

                # Normalize and strip possessive 's or trailing punctuation
                full_name = re.sub(r"['’]s$", "", full_name, flags=re.IGNORECASE).strip()
                full_name = re.sub(r"^['’\"“”\(\)\[\],.:;]+|['’\"“”\(\)\[\],.:;]+$", "", full_name).strip()

                if is_valid_character_name(full_name):
                    name_freq[full_name] = name_freq.get(full_name, 0) + 1
                i = j
            else:
                i += 1

    sorted_names = sorted(name_freq, key=lambda x: name_freq[x], reverse=True)
    return sorted_names[:top_n]


# -- Serialisation helper ------------------------------------------------------

def result_to_dict(result: PreprocessResult) -> dict:
    """
    Serialise a PreprocessResult to a plain dict for JSON output.
    Converts tuples (in pos_tags) to lists for JSON compatibility.
    """
    d = asdict(result)
    # pos_tags: List[List[Tuple]] -> List[List[List]] for JSON
    d["pos_tags"] = [
        [[tok, tag] for tok, tag in sent]
        for sent in result.pos_tags
    ]
    return d


# -- Pretty-print helper -------------------------------------------------------

def print_report(result: PreprocessResult, verbose: bool = False) -> None:
    """Print a human-readable pipeline report to stdout."""
    sep = "-" * 60
    print(sep)
    print("CRES NLP Preprocessing Report")
    print(sep)
    for k, v in result.stats.items():
        print(f"  {k:25s}: {v}")

    print(f"\nSentences ({len(result.sentences)} detected):")
    for i, s in enumerate(result.sentences[:5]):
        print(f"  [{i}] {s[:110]}{'...' if len(s) > 110 else ''}")
    if len(result.sentences) > 5:
        print(f"  ... ({len(result.sentences) - 5} more)")

    if verbose:
        print(f"\nTokens (sent 0, first 12):")
        print(f"  {result.tokens[0][:12] if result.tokens else []}")

        print(f"\nPOS Tags (sent 0, first 12):  [STAGE 3 - COMPULSORY]")
        print(f"  {result.pos_tags[0][:12] if result.pos_tags else []}")

        print(f"\nLemmas (sent 0, first 12):")
        print(f"  {result.lemmas[0][:12] if result.lemmas else []}")

        print(f"\nNamed Entities (first 15):  (NNP / NNPS tokens)")
        print(f"  {result.named_entities[:15]}")

        print(f"\nWordNet Synsets (sample 8):  [STAGE 5 - COMPULSORY]")
        for word, syns in list(result.synset_map.items())[:8]:
            print(f"  {word:18s} -> {syns}")

        print(f"\nClean Text (first 200 chars):")
        print(f"  {result.clean_text[:200]}...")

    print(sep)


# -- CLI entry point -----------------------------------------------------------

def _build_arg_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        description="CRES NLP Preprocessing Pipeline",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  echo "Elizabeth walked in." | python nlp_preprocess.py
  python nlp_preprocess.py --text "Some text here." --verbose
  python nlp_preprocess.py --file chapter1.txt --output results.json
  python nlp_preprocess.py --file novel.txt --candidates
        """,
    )
    src = p.add_mutually_exclusive_group()
    src.add_argument("--text",       type=str, help="Text to preprocess (inline)")
    src.add_argument("--file",       type=str, help="Path to a .txt file to preprocess")
    p.add_argument("--output",       type=str, default=None,
                   help="Write JSON output to this file")
    p.add_argument("--verbose", "-v", action="store_true",
                   help="Print full pipeline report")
    p.add_argument("--candidates",   action="store_true",
                   help="Only print character name candidates (NNP extraction)")
    p.add_argument("--top-n",        type=int, default=20,
                   help="Top-N character candidates to extract (default: 20)")
    return p


def main() -> None:
    logging.basicConfig(level=logging.WARNING, format="%(levelname)s: %(message)s")

    parser = _build_arg_parser()
    args = parser.parse_args()

    # Determine input source
    if args.text:
        raw = args.text
    elif args.file:
        with open(args.file, "r", encoding="utf-8") as fh:
            raw = fh.read()
    elif not sys.stdin.isatty():
        raw = sys.stdin.read()
    else:
        parser.print_help()
        sys.exit(0)

    if not raw.strip():
        print("Error: empty input.", file=sys.stderr)
        sys.exit(1)

    # Character-candidate-only mode
    if args.candidates:
        candidates = extract_character_candidates(raw, top_n=args.top_n)
        print(json.dumps(candidates, indent=2, ensure_ascii=False))
        return

    # Full preprocessing
    result = preprocess(raw)

    if args.output:
        with open(args.output, "w", encoding="utf-8") as fh:
            json.dump(result_to_dict(result), fh, indent=2, ensure_ascii=False)
        print(f"Results written to: {args.output}")
    else:
        print_report(result, verbose=args.verbose)
        if not args.verbose:
            print("\n[JSON Output]")
            print(json.dumps(result_to_dict(result), indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
