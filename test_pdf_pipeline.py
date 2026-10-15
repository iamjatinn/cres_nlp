import re
import sys
import json
import time
import urllib.request
from pathlib import Path
from pypdf import PdfReader

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

def clean_story_text(raw_text: str) -> str:
    """Mirrors the exact cleaning pipeline implemented in StoryEditorModal.tsx"""
    text = raw_text
    # Remove standard NCERT running headers/footers
    text = re.sub(r"\d+\s*/\s*Footprints without Feet.*", "", text, flags=re.IGNORECASE)
    text = re.sub(r"Footprints without Feet.*", "", text, flags=re.IGNORECASE)
    text = re.sub(r"Reprint\s*\d{4}-\d{2}", "", text, flags=re.IGNORECASE)
    text = re.sub(r"Rationalised\s*\d{4}-\d{2}", "", text, flags=re.IGNORECASE)
    text = re.sub(r"READ AND FIND OUT.*", "", text, flags=re.IGNORECASE)
    text = re.sub(r"THINK ABOUT IT.*", "", text, flags=re.IGNORECASE)
    text = re.sub(r"TALK ABOUT IT.*", "", text, flags=re.IGNORECASE)
    text = re.sub(r"SUGGESTED READINGS.*", "", text, flags=re.IGNORECASE)
    text = re.sub(r"[\u2022\u25CF\u25CB\u25AA\u25AB\u25A0\u25A1\uFFFD\u00A0\uFEFF•●▪■]", " ", text)
    # Collapse multiple whitespaces and excessive newlines
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n\s*\n\s*\n+", "\n\n", text)
    return text.strip()

def extract_pdf_story(pdf_path: str, max_pages: int = 4) -> str:
    reader = PdfReader(pdf_path)
    extracted = []
    # Read the narrative pages (first several pages contain the full narrative before study questions)
    pages_to_read = min(len(reader.pages), max_pages)
    for p_idx in range(pages_to_read):
        page = reader.pages[p_idx]
        extracted.append(page.extract_text() or "")
    
    combined = "\n\n".join(extracted)
    cleaned = clean_story_text(combined)
    return cleaned

def test_pdf_story(title: str, pdf_filename: str):
    pdf_path = Path("c:/cres_nlp") / pdf_filename
    if not pdf_path.exists():
        print(f"❌ File not found: {pdf_filename}")
        return

    print("=" * 70)
    print(f"📖 Processing PDF: {title} ({pdf_filename})")
    print("=" * 70)

    # 1. Extract text from PDF
    t0 = time.time()
    story_text = extract_pdf_story(str(pdf_path), max_pages=3)
    pdf_time = time.time() - t0
    print(f"📄 PDF extracted & cleaned: {len(story_text)} chars in {pdf_time:.2f}s")
    preview = story_text[:160].replace("\n", " ")
    print(f"   Excerpt: \"{preview}...\"")

    # 2. Call local CRES server
    req_body = json.dumps({
        "text": story_text,
        "preferLocalModel": True
    }).encode("utf-8")

    req = urllib.request.Request(
        "http://localhost:3000/api/extract-relations",
        data=req_body,
        headers={"Content-Type": "application/json; charset=utf-8"},
        method="POST"
    )

    t_start = time.time()
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            elapsed = time.time() - t_start
            data = json.loads(resp.read().decode("utf-8"))

            chars = data.get("characters", [])
            rels = data.get("relationships", [])
            model = data.get("modelUsed", "unknown")
            metrics = data.get("metrics", {})
            communities = data.get("communities", [])

            print(f"\n⚡ Response in {elapsed:.2f}s | Model: {model}")
            print(f"👥 Characters Detected ({len(chars)}):")
            for c in chars[:8]:
                print(f"   - {c.get('canonicalName')} [{c.get('primaryRole')}] ({c.get('description', '')})")

            print(f"\n🔗 Relationships Predicted ({len(rels)}):")
            for r in rels[:8]:
                src = r.get("source")
                tgt = r.get("target")
                rtype = r.get("relationType")
                weight = r.get("weight")
                sentiment = r.get("sentiment")
                summary = r.get("summary", "")
                print(f"   • {src} <---> {tgt}")
                print(f"     Type: {rtype} | Weight: {weight} | Sentiment: {sentiment:.2f}")
                print(f"     Dynamic: {summary}")

            print(f"\n📊 Graph Topology:")
            print(f"   - Nodes: {metrics.get('nodeCount')}, Edges: {metrics.get('edgeCount')}")
            print(f"   - Top Hub: {metrics.get('topHub')}, Top Bridge: {metrics.get('topBridge')}")
            print(f"   - Communities: {len(communities)} clusters identified")

            # Check for any lingering encoding artifacts
            full_str = json.dumps(data)
            has_mojibake = any(bad in full_str for bad in ["â€™", "â€œ", "â€", "â€“", "â€˜"])
            if has_mojibake:
                print("⚠️ WARNING: Detected mojibake characters in output!")
            else:
                print("✅ Clean Output: Zero encoding artifacts (no â€™, clean UTF-8 text).")

    except Exception as e:
        print(f"❌ Error during server extraction: {e}")

if __name__ == "__main__":
    test_cases = [
        ("The Thief's Story", "jefp102.pdf"),
        ("The Midnight Visitor", "jefp103.pdf"),
        ("A Triumph of Surgery", "jefp101.pdf"),
        ("A Question of Trust", "jefp104.pdf"),
    ]

    for title, fname in test_cases:
        test_pdf_story(title, fname)
        print("\n")
