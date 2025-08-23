#!/usr/bin/env python3
import json, sys
from collections import Counter

def check(path, topic):
    data = json.load(open(path, encoding='utf-8'))
    if topic == 'svenska':
        items = data['svenska']['items']
        passages = data['svenska'].get('passages', [])
        ids = [x['id'] for x in items]
        for p in passages:
            ids.append(p['id'])
            ids += [q['id'] for q in p.get('questions',[])]
        print(f"📖 {topic}: items={len(items)}, passages={len(passages)}, total_ids={len(ids)}")
    else:
        items = data['matematik']['items']
        ids = [x['id'] for x in items]
        print(f"🧮 {topic}: items={len(items)}, total_ids={len(ids)}")
    dup = [k for k,v in Counter(ids).items() if v>1]
    if dup:
        print("⚠️ Dubblett-id(n):", dup[:10], "…")
    else:
        print("✅ Inga dubblett-id.")

if __name__=="__main__":
    check("public/banks/svenska.json", "svenska")
    check("public/banks/matematik.json", "matematik")