#!/usr/bin/env python3
import json, sys
from pathlib import Path

def main(path):
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    ok = 0; bad = 0
    for p in data.get("svenska",{}).get("passages",[]):
        text = (p.get("title","") + " " + p.get("text","")).lower()
        for q in p.get("questions", []):
            opts = q.get("options",[])
            ci = q.get("correct",0)
            correct = (opts[ci] if 0 <= ci < len(opts) else "")
            # Heuristik: för plats/aktivitet/sak bör korrekt ord förekomma i texten
            lookup = q.get("q","").lower()
            require_in_text = any(k in lookup for k in ["var utspelar","vad gör","vad blir viktigt"])
            if require_in_text:
                if correct.lower() in text:
                    ok += 1
                else:
                    bad += 1
                    print(f"[WARN] '{p.get('id')}' fråga '{q.get('q')}' saknar korrekt '{correct}' i texten.")
            else:
                ok += 1
    print(f"Klart. OK: {ok}, Varningar: {bad}")
    return 0

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Använd: validate_svenska_passages.py <path till svenska.json>")
        sys.exit(1)
    sys.exit(main(sys.argv[1]))