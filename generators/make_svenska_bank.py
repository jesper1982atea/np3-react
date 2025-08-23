#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Genererar/uppdaterar public/banks/svenska.json (åk 3).

Innehåll:
- MC-frågor (stavning, grammatik, ordförståelse)
- Drag & drop (dnd): sortera ord i kategorier (ex. Substantiv/Verb/Adjektiv, Prepositioner/Inte)
- Läsförståelse-passager med 3–5 MC-frågor

Exempel:
python3 generators/make_svenska_bank.py \
  --out public/banks/svenska.json \
  --items 120 --dnd 12 --passages 6 --seed 7

Byt ut helt (ersätt tidigare items/passages):
  ... --replace
"""
import json, random, re, argparse
from pathlib import Path
from typing import List, Dict, Tuple

# ------------------------- IO helpers -------------------------

def read_existing(path: Path) -> dict:
    if not path.exists():
        return {"bankVersion":"1.0","svenska":{"items":[],"passages":[]}}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        data = {}
    if "bankVersion" not in data: data["bankVersion"] = "1.0"
    if "svenska" not in data: data["svenska"] = {"items":[],"passages":[]}
    if "items" not in data["svenska"]: data["svenska"]["items"] = []
    if "passages" not in data["svenska"]: data["svenska"]["passages"] = []
    return data

def next_item_id(items: List[dict]) -> int:
    mx = 0
    for it in items:
        m = re.match(r"sv-(\d+)", it.get("id",""))
        if m:
            mx = max(mx, int(m.group(1)))
    return mx + 1

def next_passage_id(passages: List[dict]) -> int:
    mx = 0
    for it in passages:
        m = re.match(r"sv-p-(\d+)", it.get("id",""))
        if m:
            mx = max(mx, int(m.group(1)))
    return mx + 1

# ------------------------- MC Option utils -------------------------

def unique_options_with_correct(correct_text: str, pool: List[str], n=4) -> Tuple[List[str], int]:
    opts = [correct_text]
    for p in pool:
        if p == correct_text: continue
        if p not in opts:
            opts.append(p)
        if len(opts) == n: break
    # fyll på enkla distraktorer
    i = 0
    while len(opts) < n and i < 50:
        i += 1
        cand = pool[random.randrange(len(pool))] if pool else str(i)
        if cand not in opts:
            opts.append(cand)
    random.shuffle(opts)
    return opts, opts.index(correct_text)

# ------------------------- Pedagogiska hints -------------------------

HINTS = {
    "stavning": "Titta noga på bokstäver och ljud – sj-, tj-, hj-, lj- och dubbelteckning (tt/ss) är vanliga fällor.",
    "grammatik": "Substantiv = namn (katt). Verb = något man gör (springer). Adjektiv = beskriver (röd).",
    "ord": "Läs meningen och byt ut med förslagen. Synonym ≈ liknande ord. Motsats = tvärtom.",
    "läs": "Läs texten en gång till. Leta ord i frågan som också finns i texten.",
    "preposition": "Prepositioner anger läge/riktning: på, i, under, bakom, framför, vid, mellan…"
}

def explain_for(item: dict) -> str:
    if item.get("hint"): return item["hint"]
    area = item.get("area","")
    if "stavning" in area: return HINTS["stavning"]
    if "grammatik" in area:
        q = item.get("q","").lower()
        if "substantiv" in q: return "Substantiv: namn på saker/djur/personer/platser (katt, bok, Lisa)."
        if "verb" in q: return "Verb: något man gör/är (springer, läser, är)."
        if "adjektiv" in q: return "Adjektiv: beskriver egenskaper (stor, röd, snabb)."
        if "pronomen" in q: return "Pronomen: ersätter substantiv (han, hon, den, det)."
        if "preposition" in q: return HINTS["preposition"]
        return HINTS["grammatik"]
    if "ord" in area: return HINTS["ord"]
    if "läs" in area: return HINTS["läs"]
    return "Fundera på vad frågan faktiskt frågar efter, och jämför alternativen noga."

# ------------------------- MC Generators -------------------------

STAVNING_PAIRS = [
    ("hjärta","hjerta"), ("gärna","gjärna"), ("skjorta","sjorta"),
    ("choklad","sjoklad"), ("kemi","schemi"), ("känna","kjänna"),
    ("läxor","läxorr"), ("kör","kjör"), ("genast","jennast"),
    ("kalla","cala"), ("sked","ked"), ("macka","maka")
]

def gen_stavning()->dict:
    right, wrong = random.choice(STAVNING_PAIRS)
    # Lägg till två distraktorer som känns plausibla
    bad2 = right.replace("k","c",1) if "k" in right else right+"e"
    bad3 = right.replace("ä","e") if "ä" in right else right.replace("å","a") if "å" in right else right+"a"
    options, ci = unique_options_with_correct(right, [wrong, bad2, bad3])
    return {
        "area":"stavning",
        "q":"Vilket ord stavas rätt?",
        "options": options,
        "correct": ci,
        "difficulty":"np",
        "hint": HINTS["stavning"],
        "explain": HINTS["stavning"]
    }

GRAM_BANK = {
    "substantiv": ["katt","Lisa","skola","boll","bord","hund","cykel","fisk","skog","bil"],
    "verb": ["springer","läser","är","äter","sover","ritar","skriver","hoppar","simmar","leker"],
    "adjektiv": ["röd","stor","snabb","glad","ljus","mjuk","tyst","lång","varm","blå"],
    "pronomen": ["han","hon","den","det","de","vi","jag","ni"],
    "preposition": ["på","i","under","över","bakom","framför","vid","mellan"]
}

def gen_grammatik()->dict:
    # Slumpa vilken kategori vi frågar efter
    cat = random.choice(["substantiv","verb","adjektiv","pronomen"])
    correct = random.choice(GRAM_BANK[cat])
    # Bygg plausibla distraktorer från andra kategorier
    pools = [w for k,arr in GRAM_BANK.items() if k!=cat for w in arr]
    random.shuffle(pools)
    wrongs = pools[:3]
    opts, ci = unique_options_with_correct(correct, wrongs)
    q = f"Vilket ord är ett {cat}?"
    return {
        "area":"grammatik",
        "q": q,
        "options": opts,
        "correct": ci,
        "difficulty":"np",
        "hint": explain_for({"area":"grammatik","q":q}),
        "explain": explain_for({"area":"grammatik","q":q})
    }

ORD_SYNONYM = [
    ("glad", ["lycklig","ledsen","trött","arg"]),
    ("snabb", ["kvick","långsam","tyst","mjuk"]),
    ("stor", ["enorm","liten","kort","smal"]),
    ("kall", ["frusen","varm","ljus","torr"]),
    ("vacker", ["fin","ful","högljudd","snäll"]),
]

ORD_MOTSATS = [
    ("lång", ["kort","snabb","mjuk","tyst"]),
    ("hård", ["mjuk","tung","lätt","torr"]),
    ("rätt", ["fel","sant","klart","snällt"]),
    ("tidig", ["sen","långsam","kort","tyst"]),
]

def gen_ordforstaelse()->dict:
    if random.random()<0.5:
        base, opts = random.choice(ORD_SYNONYM)
        q = f"Vilket ord betyder ungefär samma som '{base}'?"
        correct = opts[0]
        pool = opts[1:]
    else:
        base, opts = random.choice(ORD_MOTSATS)
        q = f"Vilket ord är motsats till '{base}'?"
        correct = opts[0]
        pool = opts[1:]
    options, ci = unique_options_with_correct(correct, pool)
    return {
        "area":"ordförståelse",
        "q": q,
        "options": options,
        "correct": ci,
        "difficulty":"np",
        "hint": HINTS["ord"],
        "explain": HINTS["ord"]
    }

# ------------------------- DnD Generators -------------------------

def dnd_sva_substantiv_verb_adjektiv()->dict:
    tokens_sub = random.sample(GRAM_BANK["substantiv"], k=4)
    tokens_verb = random.sample(GRAM_BANK["verb"], k=4)
    tokens_adj = random.sample(GRAM_BANK["adjektiv"], k=4)
    tokens = tokens_sub + tokens_verb + tokens_adj
    random.shuffle(tokens)
    sol = {}
    for w in tokens_sub: sol[w] = "Substantiv"
    for w in tokens_verb: sol[w] = "Verb"
    for w in tokens_adj: sol[w] = "Adjektiv"
    return {
        "id": "",  # sätts senare
        "topic": "svenska",
        "area": "grammatik",
        "type": "dnd",
        "q": "Dra orden till rätt kategori.",
        "buckets": [{"label":"Substantiv"},{"label":"Verb"},{"label":"Adjektiv"}],
        "tokens": tokens,
        "solution": sol,
        "hint": "Substantiv = namn (katt). Verb = något man gör (springer). Adjektiv = beskriver (röd).",
        "explain": "Tänk: Kan jag sätta 'en/ett' före? (substantiv). Kan jag sätta 'att' före? (verb). Beskriver ordet något? (adjektiv).",
        "difficulty": "np"
    }

def dnd_prepositioner()->dict:
    pres = random.sample(GRAM_BANK["preposition"], k=5)
    not_pres_pool = GRAM_BANK["substantiv"] + GRAM_BANK["verb"] + GRAM_BANK["adjektiv"] + GRAM_BANK["pronomen"]
    not_pres = random.sample(not_pres_pool, k=5)
    tokens = pres + not_pres
    random.shuffle(tokens)
    sol = {}
    for w in pres: sol[w] = "Preposition"
    for w in not_pres: sol[w] = "Inte preposition"
    return {
        "id": "",
        "topic": "svenska",
        "area": "grammatik",
        "type": "dnd",
        "q": "Dra orden som är prepositioner till 'Preposition' och resten till 'Inte preposition'.",
        "buckets": [{"label":"Preposition"},{"label":"Inte preposition"}],
        "tokens": tokens,
        "solution": sol,
        "hint": HINTS["preposition"],
        "explain": "Prepositioner anger läge/riktning: på, i, under, bakom, framför, vid, mellan…",
        "difficulty": "np"
    }

def gen_dnd()->dict:
    return dnd_sva_substantiv_verb_adjektiv() if random.random()<0.6 else dnd_prepositioner()

# ------------------------- Läsförståelse Generators -------------------------

PASSAGE_TEMPLATES = [
    {
        "title": "Lisa och skoldörren",
        "text": ("Lisa sprang mot skolan. Hon hade nästan försovit sig. "
                 "När hon kom fram var dörren stängd. Hon knackade försiktigt, "
                 "och vaktmästaren öppnade med ett leende. Lisa tackade och skyndade till klassrummet."),
        "qs": [
            ("Varför sprang Lisa?", ["Hon var hungrig","Hon hade bråttom","Hon skulle leka","Hon tappade en bok"], 1),
            ("Vem öppnade dörren?", ["Rektorn","Läraren","Vaktmästaren","Kompisen"], 2),
            ("Hur kände sig Lisa när dörren öppnades?", ["Ledsen","Arg","Lättad","Trött"], 2)
        ]
    },
    {
        "title": "Utflykten till skogen",
        "text": ("Klassen gick till skogen. De plockade kottar och letade efter spår. "
                 "Adam hittade ett litet fågelbo på marken. Läraren berättade att man bara fick titta och inte röra."),
        "qs": [
            ("Vad hittade Adam?", ["Ett fågelbo","En sten","En fjäder","En blomma"], 0),
            ("Vad sa läraren att man skulle göra?", ["Ta med boet hem","Inte röra boet","Röra försiktigt","Bygga ett nytt"], 1),
            ("Var var klassen?", ["I stan","Vid sjön","I skogen","I klassrummet"], 2)
        ]
    },
    {
        "title": "Tågförseningen",
        "text": ("Maja skulle åka till mormor. Tåget var försenat och hon väntade på perrongen. "
                 "Hon läste skyltarna och drack lite saft. När tåget kom vinkade hon till konduktören."),
        "qs": [
            ("Vart skulle Maja åka?", ["Till skolan","Till mormor","Till en vän","Till simhallen"], 1),
            ("Var väntade Maja?", ["På perrongen","I tåget","I bilen","I klassrummet"], 0),
            ("Vad gjorde Maja medan hon väntade?", ["Sov","Läste skyltar","Lekte","Pratade i telefon"], 1)
        ]
    }
]

def gen_passage() -> dict:
    tpl = random.choice(PASSAGE_TEMPLATES)
    title = tpl["title"]
    text = tpl["text"]
    qs_tpl = tpl["qs"][:]
    random.shuffle(qs_tpl)
    take = random.randint(3, min(5, len(qs_tpl)))
    questions = []
    for i in range(take):
        qtext, options, correct = qs_tpl[i]
        questions.append({
            "id": "",  # sätts senare
            "q": qtext,
            "options": options,
            "correct": correct
        })
    return {
        "id": "",  # sätts senare
        "title": title,
        "text": text,
        "questions": questions
    }

# ------------------------- MAIN build -------------------------

def make_mc_item() -> dict:
    r = random.random()
    if r < 0.34:
        return gen_stavning()
    elif r < 0.68:
        return gen_grammatik()
    else:
        return gen_ordforstaelse()

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True, help="Sökväg till svenska.json")
    ap.add_argument("--items", type=int, default=120, help="Antal MC-frågor")
    ap.add_argument("--dnd", type=int, default=8, help="Antal drag & drop-uppgifter")
    ap.add_argument("--passages", type=int, default=6, help="Antal läsförståelse-passager")
    ap.add_argument("--seed", type=int, default=None)
    ap.add_argument("--replace", action="store_true", help="Skriv över items/passages helt")
    args = ap.parse_args()

    if args.seed is not None:
        random.seed(args.seed)

    out = Path(args.out)
    data = read_existing(out)
    items = data["svenska"]["items"]
    passages = data["svenska"]["passages"]

    if args.replace:
        items = []
        passages = []

    nid_item = next_item_id(items)
    nid_pass = next_passage_id(passages)

    created_items = []
    created_passages = []

    # 1) MC
    for _ in range(max(0, args.items)):
        q = make_mc_item()
        q["id"] = f"sv-{nid_item:03d}"
        nid_item += 1
        # hint/explain säkerställs
        q.setdefault("hint", explain_for(q))
        q.setdefault("explain", explain_for(q))
        q.setdefault("difficulty","np")
        q.setdefault("topic","svenska")
        created_items.append(q)

    # 2) DnD
    for _ in range(max(0, args.dnd)):
        q = gen_dnd()
        q["id"] = f"sv-{nid_item:03d}"
        nid_item += 1
        created_items.append(q)

    # 3) Läsförståelse
    for _ in range(max(0, args.passages)):
        p = gen_passage()
        p["id"] = f"sv-p-{nid_pass:03d}"
        # sätt unika id på underfrågor
        for i, subq in enumerate(p["questions"], start=1):
            subq["id"] = f"{p['id']}-q{i}"
            # lägg in mild hint/explain för läsförståelse
            subq.setdefault("hint", HINTS["läs"])
            subq.setdefault("explain", HINTS["läs"])
        nid_pass += 1
        created_passages.append(p)

    # 4) Spara/skriv
    items.extend(created_items)
    passages.extend(created_passages)
    data["svenska"]["items"] = items
    data["svenska"]["passages"] = passages

    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"✅ Klart! La till {len(created_items)} items och {len(created_passages)} passager i {out}")
    print(f"Nästa lediga item-id blir: sv-{nid_item:03d}")
    print(f"Nästa lediga passage-id blir: sv-p-{nid_pass:03d}")

if __name__ == "__main__":
    main()