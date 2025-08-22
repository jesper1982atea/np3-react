#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Generator för NP åk 3 – Svenska (JSON)
- Lägger till fristående "items" (stavning, grammatik, ordforstaelse)
- Genererar läsförståelsepassager med 2–3 frågor per passage
- Undviker dubletter (q + options)
- Gör backup och skriver tillbaka till angiven --out
"""

import json, random, re, argparse
from pathlib import Path
from typing import List, Dict, Tuple, Callable

AREAS = ["stavning","grammatik","ordforstaelse"]

# --- Ordbanker för stavning ---
STAVNING_RATT = [
    "själv","stjärna","skjorta","känsla","jämföra","skoj","choklad",
    "kyckling","järnväg","hjärta","ljus","tjej","sked","staket","läkare",
    "hjul","maskin","museum","buss","ficklampa","bibliotek","skola",
]
# Vanliga felstavningar (kommer mixas maskinellt också)
STAVNING_FELBAS = {
    "själv": ["skjälv","skälv","sjjälv"],
    "stjärna": ["stjarna","stiarna","stjerna","sjärna"],
    "skjorta": ["schjorta","skorta","sjorta"],
    "känsla": ["känla","känslla","känslaa"],
    "jämföra": ["jämmföra","jämfögha","gämföra"],
    "skoj": ["sköj","skojj","skoi"],
    "choklad": ["sjoklad","schoklad","chocklad"],
    "kyckling": ["kylcking","kykling","kycklig"],
    "järnväg": ["järnveg","jarnväg","jarnveg"],
    "hjärta": ["hjerta","giärta","hjärtda"],
    "ljus": ["jus","ljuss","ljust"],
    "tjej": ["tjejj","chej","tjei"],
    "sked": ["sched","sjedd","skedd"],
    "staket": ["stakett","stakett","stacket"],
    "läkare": ["lekare","läckare","lägare"],
    "hjul": ["jiul","hjull","hul"],
    "maskin": ["maschin","maskinn","masjin"],
    "museum": ["muséum","museeum","museun"],
    "buss": ["bus","buz","bussar"],
    "ficklampa": ["fiklampa","fickllampa","fikklampa"],
    "bibliotek": ["bibliteket","bibliotekk","bibiliotek"],
    "skola": ["skolla","skoola","skolah"],
}

# --- Frågebanker för grammatik/ordförståelse ---
GRAMMATIK_VERB = ["springer","läser","skriver","äter","sover","målar","leker","cyklar","sjunger","badar"]
GRAMMATIK_SUBST = ["katt","boll","bok","bord","stol","skola","lärare","vän","fönster","stad"]
GRAMMATIK_ADJ = ["glad","lång","snabb","röd","mjuk","hård","stor","liten","tyst","hög"]
PREPOSITIONER = ["på","i","under","över","bredvid","framför","bakom"]

ORDF_SYNONYMER = [
    ("glad","munter"),("trött","utmattad"),("liten","pytteliten"),("stor","enorm"),
    ("arg","förbannad"),("snabb","kvick"),("tyst","lågmälld"),("rädd","skrämd"),
]
ORDF_MOTSATS = [
    ("glad","ledsen"),("stor","liten"),("lång","kort"),("hård","mjuk"),
    ("snabb","långsam"),("ljus","mörk"),("tyst","högljudd"),("varm","kall"),
]

# --- Läsförståelse: mallar för korta passager ---
NAMN = ["Lisa","Ali","Mira","Hugo","Sara","Noah","Ella","Liam","Ava","Omar","Nora"]
PLATSER = ["skolan","parken","biblioteket","skogen","matsalen","skolgården","lekparken","museet"]
SAKER = ["boll","bok","smörgås","ryggsäck","vante","mössa","regnjacka","cykel"]
AKTIVITETER = ["läste","lekte","sprang","cyklade","ritade","samlade kottar","hjälpte till"]

# ================== Hjälpfunktioner ==================
def load_bank(path: Path) -> Dict:
    if not path.exists():
        return {"bankVersion":"1.0", "svenska":{"items":[], "passages":[]}}
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)

def root_safe_out(path_str: str) -> Path:
    project_root = Path(__file__).resolve().parent.parent
    p = Path(path_str)
    if p.is_absolute():
        return p.resolve()
    return (project_root / p).resolve()

def next_item_id(items: List[Dict]) -> int:
    mx = 0
    for it in items:
        m = re.match(r"sv-(\d+)$", it.get("id",""))
        if m: mx = max(mx, int(m.group(1)))
    return mx + 1

def next_passage_id(passages: List[Dict]) -> int:
    mx = 0
    for it in passages:
        m = re.match(r"sv-p-(\d+)$", it.get("id",""))
        if m: mx = max(mx, int(m.group(1)))
    return mx + 1

def shuffle_options_with_correct(options: List[str], correct_index: int) -> Tuple[List[str], int]:
    paired = list(enumerate(options))
    random.shuffle(paired)
    new_options = [opt for _, opt in paired]
    new_correct = [i for i,(old_i, _) in enumerate(paired) if old_i == correct_index][0]
    return new_options, new_correct

def add_item_unique(items: List[Dict], item: Dict, seen: set) -> bool:
    sig = (item["q"], tuple(item["options"]))
    if sig in seen: return False
    seen.add(sig)
    items.append(item)
    return True

# ================== Generators – items ==================
def gen_stavning() -> Tuple[str, List[str], int]:
    korrekt = random.choice(STAVNING_RATT)
    fel_lista = STAVNING_FELBAS.get(korrekt, [])
    # skapa några maskinella fel om få i bas
    while len(fel_lista) < 6:
        variant = list(korrekt)
        i = random.randrange(len(variant))
        variant[i] = random.choice(["j","i","e","ä","å","o","u","h","k","g","y"])
        fel_lista.append("".join(variant))
    fel = random.sample([f for f in fel_lista if f != korrekt], 3)
    options = [korrekt] + fel
    q = "Vilket ord stavas rätt?"
    options, correct = shuffle_options_with_correct(options, 0)
    return q, options, correct

def gen_grammatik() -> Tuple[str, List[str], int]:
    typ = random.choice(["verb","adj","prep","tempus","mening","pronomen","substantiv"])
    if typ == "verb":
        opts = [random.choice(GRAMMATIK_VERB), random.choice(GRAMMATIK_ADJ), random.choice(GRAMMATIK_SUBST), "på"]
        q = "Vilket ord är ett verb?"
        correct = 0
    elif typ == "adj":
        opts = [random.choice(GRAMMATIK_ADJ), random.choice(GRAMMATIK_VERB), random.choice(GRAMMATIK_SUBST), "i"]
        q = "Vilket ord är ett adjektiv?"
        correct = 0
    elif typ == "substantiv":
        opts = [random.choice(GRAMMATIK_SUBST), random.choice(GRAMMATIK_VERB), random.choice(GRAMMATIK_ADJ), "under"]
        q = "Vilket ord är ett substantiv?"
        correct = 0
    elif typ == "prep":
        opts = [random.choice(PREPOSITIONER), "springer", "glad", "katt"]
        q = "Vilket är en preposition?"
        correct = 0
    elif typ == "tempus":
        base = "läser"
        opts = ["läste","läser","läst","läsa"]
        q = "Välj preteritum av 'läser'."
        correct = 0  # "läste"
    elif typ == "mening":
        opts = ["Vi åker hem.","vi åker hem","Vi åker hem","vi Åker hem."]
        q = "Vilken mening är korrekt skriven?"
        correct = 0
    else:  # pronomen
        opts = ["han","springer","röd","snabbt"]
        q = "Välj pronomen."
        correct = 0
    options, correct = shuffle_options_with_correct(opts, correct)
    return q, options, correct

def gen_ordforstaelse() -> Tuple[str, List[str], int]:
    typ = random.choice(["synonym","motsats","lucka"])
    if typ == "synonym":
        bas, syn = random.choice(ORDF_SYNONYMER)
        opts = [syn, "fel", "annat", "okänt"]
        q = f"Synonym till '{bas}'?"
        correct = 0
    elif typ == "motsats":
        bas, mot = random.choice(ORDF_MOTSATS)
        opts = [mot, "lik", "nära", "snabb"]
        q = f"Motsats till '{bas}'?"
        correct = 0
    else:  # lucka
        namn = random.choice(NAMN)
        ord1 = random.choice(["glad","hungrig","trött","rädd"])
        opts = [ord1, "blå", "fem", "långsam"]
        q = f"{namn} är ___."
        correct = 0
    options, correct = shuffle_options_with_correct(opts, correct)
    return q, options, correct

GEN_ITEM_BY_AREA: Dict[str, Callable[[], Tuple[str,List[str],int]]] = {
    "stavning": gen_stavning,
    "grammatik": gen_grammatik,
    "ordforstaelse": gen_ordforstaelse,
}

# ================== Generators – passager ==================
def build_passage_text() -> Tuple[str, str]:
    namn1 = random.choice(NAMN)
    plats = random.choice(PLATSER)
    aktivitet = random.choice(AKTIVITETER)
    sak = random.choice(SAKER)
    title = f"{namn1} i {plats}"
    text = (f"{namn1} var i {plats}. Hen {aktivitet}. "
            f"En {sak} blev viktig under dagen. Till slut var allt bra.")
    return title, text

def passage_questions_for(title: str, text: str) -> List[Dict]:
    # Q1: Var är hen?
    plats_opts = [random.choice(PLATSER) for _ in range(3)]
    # sätt rätt plats ur titeln om den råkar finnas, annars välj slump
    plats_i_titel = None
    for pl in PLATSER:
        if f" {pl}" in title or f" {pl}" in text:
            plats_i_titel = pl
            break
    if plats_i_titel is None:
        plats_i_titel = random.choice(PLATSER)
    opts1 = [plats_i_titel] + [p for p in plats_opts if p != plats_i_titel][:3]
    opts1 = opts1[:4]
    opts1, c1 = shuffle_options_with_correct(opts1, 0)

    # Q2: Vad gjorde hen?
    akt = random.choice(AKTIVITETER)
    opts2 = [akt, "sov", "åt", "grät"]
    opts2, c2 = shuffle_options_with_correct(opts2, 0)

    # Q3: Vad var viktigt?
    sak = random.choice(SAKER)
    opts3 = [sak, "penna", "bok", "cykel"]
    opts3, c3 = shuffle_options_with_correct(opts3, 0)

    return [
        { "q": "Var är personen?", "options": opts1, "correct": c1 },
        { "q": "Vad gjorde personen?", "options": opts2, "correct": c2 },
        { "q": "Vad var viktigt i texten?", "options": opts3, "correct": c3 },
    ]

# ================== CLI & logik ==================
def parse_plan(plan: str) -> Dict[str, int]:
    """
    Ex: "stavning=40,grammatik=40,ordforstaelse=40"
    """
    out = {}
    if not plan: return out
    for part in plan.split(","):
        part = part.strip()
        if not part: continue
        if "=" not in part: raise ValueError(f"Ogiltig plan-del: {part}")
        k,v = part.split("=",1)
        k = k.strip()
        v = int(v.strip())
        if k not in AREAS: raise ValueError(f"Okänt område i plan: {k}")
        out[k] = v
    return out

def main():
    ap = argparse.ArgumentParser(description="Generera svenska-frågor till svenska.json")
    ap.add_argument("--out", required=True, help="Sökväg till public/banks/svenska.json")
    ap.add_argument("--items", type=int, default=100, help="Antal fristående items att generera")
    ap.add_argument("--plan", type=str, default="", help="Fördela items per område, t.ex. 'stavning=40,grammatik=30,ordforstaelse=30'")
    ap.add_argument("--passages", type=int, default=10, help="Antal passager att generera")
    ap.add_argument("--seed", type=int, default=None, help="Slump-seed")
    ap.add_argument("--dry", action="store_true", help="Torrkörning (skriv inte fil)")
    args = ap.parse_args()

    if args.seed is not None:
        random.seed(args.seed)

    out_path = root_safe_out(args.out)
    print(f"🗂️  Målfil: {out_path}")

    bank = load_bank(out_path)
    svenska = bank.get("svenska") or {"items":[], "passages":[]}
    items = svenska.get("items", [])
    passages = svenska.get("passages", [])

    # ID-start
    next_item_num = next_item_id(items)
    next_pass_num = next_passage_id(passages)

    # Dublett-koll för items
    seen_items = set((it.get("q"), tuple(it.get("options",[]))) for it in items if "q" in it and "options" in it)

    # --- Fördelning av items ---
    plan = parse_plan(args.plan) if args.plan else {}
    if not plan:
        # jämn fördelning
        base = args.items // len(AREAS)
        plan = {a: base for a in AREAS}
        leftover = args.items - base*len(AREAS)
        order = ["stavning","grammatik","ordforstaelse"]
        for a in order:
            if leftover<=0: break
            plan[a]+=1; leftover-=1

    created_items = []
    for area, n in plan.items():
        gen = GEN_ITEM_BY_AREA[area]
        tries = 0
        made = 0
        while made < n and tries < n*30:
            tries += 1
            q, options, correct = gen()
            item = {
                "id": f"sv-{next_item_num:03d}",
                "area": area,
                "q": q,
                "options": options,
                "correct": int(correct)
            }
            if add_item_unique(created_items, item, seen_items):
                next_item_num += 1
                made += 1

    # --- Passager ---
    created_passages = []
    for _ in range(args.passages):
        title, text = build_passage_text()
        qs = passage_questions_for(title, text)
        # bygg unik nyckel för passage (titel+text)
        psig = (title, text)
        # undvik exakta dubletter
        if any(p.get("title")==title and p.get("text")==text for p in passages+created_passages):
            continue
        pid = f"sv-p-{next_pass_num:03d}"
        next_pass_num += 1
        # numrera frågorna i passagen
        out_qs = []
        for i, qd in enumerate(qs, start=1):
            out_qs.append({
                "id": f"{pid}-q{i}",
                "q": qd["q"],
                "options": qd["options"],
                "correct": qd["correct"]
            })
        created_passages.append({
            "id": pid,
            "title": title,
            "text": text,
            "questions": out_qs
        })

    if args.dry:
        print(json.dumps({
            "would_add_items": len(created_items),
            "would_add_passages": len(created_passages),
            "preview_items": created_items[:3],
            "preview_passage": (created_passages[0] if created_passages else None)
        }, ensure_ascii=False, indent=2))
        return

    # Backup
    if out_path.exists():
        bak = out_path.with_suffix(out_path.suffix + ".bak")
        out_path.parent.mkdir(parents=True, exist_ok=True)
        bak.write_bytes(out_path.read_bytes())
        print(f"💾 Backup skapad: {bak}")

    # Spara tillbaka
    items.extend(created_items)
    passages.extend(created_passages)
    bank["svenska"] = {"items": items, "passages": passages}
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", encoding="utf-8") as f:
        json.dump(bank, f, ensure_ascii=False, indent=2)

    print(f"✅ Klart! La till {len(created_items)} items och {len(created_passages)} passager i {out_path}")
    print(f"Nästa lediga item-id: sv-{next_item_num:03d}, passage-id: sv-p-{next_pass_num:03d}")

if __name__ == "__main__":
    main()