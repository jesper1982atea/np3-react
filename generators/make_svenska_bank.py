#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Genererar/uppdaterar public/banks/svenska.json (åk 3).

Nytt:
- --level easy|np|hard påverkar DnD-storlek, distraktor-likhet, passage-längd och antal delfrågor.
- Utökade passage-mallar (fler texter).
- MC (stavning/grammatik/ordförståelse) + DnD (kategori-sortering) + Läsförståelse-passager.

Exempel:
python3 generators/make_svenska_bank.py \
  --out public/banks/svenska.json \
  --items 140 --dnd 12 --passages 6 --level np --seed 7

Byt ut helt:
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

# ------------------------- Svårighetsprofil -------------------------

def profile_for_level(level: str) -> dict:
    level = (level or "np").lower()
    # parametrar som styr likhet och mängd
    if level == "easy":
        return {
            "difficulty": "easy",
            "dnd_tokens": (6, 8),           # färre ord
            "dnd_cats": (2, 3),             # 2-3 hinkar
            "pass_qs": (3, 4),              # 3-4 frågor/pass
            "pass_len": (40, 75),           # kortare meningar (antal ord)
            "distractor_strength": 0.35,    # mindre lika distraktorer
        }
    if level == "hard":
        return {
            "difficulty": "hard",
            "dnd_tokens": (10, 14),
            "dnd_cats": (3, 3),
            "pass_qs": (4, 5),
            "pass_len": (90, 140),          # längre text
            "distractor_strength": 0.8,     # mer lika distraktorer
        }
    # default np
    return {
        "difficulty": "np",
        "dnd_tokens": (8, 10),
        "dnd_cats": (2, 3),
        "pass_qs": (3, 5),
        "pass_len": (60, 100),
        "distractor_strength": 0.6,
    }

# ------------------------- MC Option utils -------------------------

def unique_options_with_correct(correct_text: str, pool: List[str], n=4, strength=0.6) -> Tuple[List[str], int]:
    """
    Väljer n alternativ inkl. korrekt. 'strength' styr hur lika distraktorerna blir: 0..1.
    - Högre strength -> distraktorer hämtas bland "närliggande" ord först.
    """
    opts = [correct_text]

    # skapa en prioriterad lista där "lika" ord (lägre Levenshtein-aktigt via enkla heuristiker) kommer tidigare
    def score(w: str) -> int:
        # enklare "likhets-poäng": antal gemensamma bokstäver + prefixmatch
        common = len(set(correct_text) & set(w))
        pref = 0
        for a,b in zip(correct_text, w):
            if a==b: pref += 1
            else: break
        return pref*2 + common

    ranked = sorted([p for p in pool if p != correct_text], key=score, reverse=True)
    k_like = int(max(0, min(len(ranked), round(strength * (n-1)))))
    candidates = ranked[:k_like] + ranked[k_like:]
    for p in candidates:
        if p not in opts:
            opts.append(p)
        if len(opts) == n: break

    # fyll upp om det behövs
    i = 0
    while len(opts) < n and i < 200:
        i += 1
        cand = pool[random.randrange(len(pool))] if pool else correct_text + str(i)
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
    ("kalla","cala"), ("sked","ked"), ("macka","maka"),
    ("tjej","tjei"), ("stjärna","stiarna"), ("björn","biorn"),
]

GRAM_BANK = {
    "substantiv": ["katt","Lisa","skola","boll","bord","hund","cykel","fisk","skog","bil","äpple","pennor","fågel","gata","stol"],
    "verb": ["springer","läser","är","äter","sover","ritar","skriver","hoppar","simmar","leker","talar","sjunger","tittar","står","går"],
    "adjektiv": ["röd","stor","snabb","glad","ljus","mjuk","tyst","lång","varm","blå","smal","hård","tung","kall","mörk"],
    "pronomen": ["han","hon","den","det","de","vi","jag","ni"],
    "preposition": ["på","i","under","över","bakom","framför","vid","mellan","bredvid","genom"]
}

ORD_SYNONYM = [
    ("glad", ["lycklig","ledsen","trött","arg"]),
    ("snabb", ["kvick","långsam","tyst","mjuk"]),
    ("stor", ["enorm","liten","kort","smal"]),
    ("kall", ["frusen","varm","ljus","torr"]),
    ("vacker", ["fin","ful","högljudd","snäll"]),
    ("smart", ["klok","dum","snäll","långsam"]),
    ("börja", ["starta","avsluta","sitta","somna"]),
]

ORD_MOTSATS = [
    ("lång", ["kort","snabb","mjuk","tyst"]),
    ("hård", ["mjuk","tung","lätt","torr"]),
    ("rätt", ["fel","sant","klart","snällt"]),
    ("tidig", ["sen","långsam","kort","tyst"]),
    ("varm", ["kall","mjuk","hård","ljus"]),
    ("tung", ["lätt","snabb","mjuk","hård"]),
]

def gen_stavning(level_profile) -> dict:
    right, wrong = random.choice(STAVNING_PAIRS)
    # generera två extra distraktorer enligt svårighet
    def tweak(w: str) -> str:
        if level_profile["distractor_strength"] >= 0.7:
            # svårare: subtila byten (ä->e, å->a), bort med dubbelteckning
            if "ä" in w: return w.replace("ä", "e", 1)
            if "å" in w: return w.replace("å", "a", 1)
            if "kk" in w: return w.replace("kk","k",1)
            return w + "e"
        else:
            # lättare: tydligare fel
            return w.replace("k","c",1) if "k" in w else w + "a"
    bad2 = tweak(right)
    bad3 = tweak(right[::-1])[::-1]
    options, ci = unique_options_with_correct(right, [wrong, bad2, bad3], n=4, strength=level_profile["distractor_strength"])
    return {
        "area":"stavning",
        "q":"Vilket ord stavas rätt?",
        "options": options,
        "correct": ci,
        "difficulty": level_profile["difficulty"],
        "hint": HINTS["stavning"],
        "explain": HINTS["stavning"],
        "topic":"svenska"
    }

def gen_grammatik(level_profile) -> dict:
    # välj kategori (svårare nivå ger oftare pronomen/preposition)
    cats = ["substantiv","verb","adjektiv","pronomen"] + (["preposition"] if level_profile["difficulty"]!="easy" else [])
    cat = random.choice(cats)
    correct = random.choice(GRAM_BANK[cat])
    pools = [w for k,arr in GRAM_BANK.items() if k!=cat for w in arr]
    random.shuffle(pools)
    wrongs = pools[:6]  # större pool för likhet
    opts, ci = unique_options_with_correct(correct, wrongs, n=4, strength=level_profile["distractor_strength"])
    q = f"Vilket ord är ett {cat}?"
    return {
        "area":"grammatik",
        "q": q,
        "options": opts,
        "correct": ci,
        "difficulty": level_profile["difficulty"],
        "hint": explain_for({"area":"grammatik","q":q}),
        "explain": explain_for({"area":"grammatik","q":q}),
        "topic":"svenska"
    }

def gen_ordforstaelse(level_profile) -> dict:
    if random.random()<0.5:
        base, opts = random.choice(ORD_SYNONYM)
        q = f"Vilket ord betyder ungefär samma som '{base}'?"
        correct = opts[0]
        pool = opts[1:] + [base+"ig","super"+base]
    else:
        base, opts = random.choice(ORD_MOTSATS)
        q = f"Vilket ord är motsats till '{base}'?"
        correct = opts[0]
        pool = opts[1:] + [base+"-lik","inte "+base]
    options, ci = unique_options_with_correct(correct, pool, n=4, strength=level_profile["distractor_strength"])
    return {
        "area":"ordförståelse",
        "q": q,
        "options": options,
        "correct": ci,
        "difficulty": level_profile["difficulty"],
        "hint": HINTS["ord"],
        "explain": HINTS["ord"],
        "topic":"svenska"
    }

# ------------------------- DnD Generators -------------------------

def dnd_substantiv_verb_adjektiv(level_profile)->dict:
    # antal tokens och kategorier styrs av profil
    min_t, max_t = level_profile["dnd_tokens"]
    tok_n = random.randint(min_t, max_t)
    cats_count = random.randint(*level_profile["dnd_cats"])
    # välj kategorier
    cat_list = ["Substantiv","Verb","Adjektiv"]
    categories = cat_list[:cats_count]
    tokens = []
    sol = {}
    # välj 1/3 från varje kategori (så gott det går)
    per = max(2, tok_n // cats_count)
    if "Substantiv" in categories:
        subs = random.sample(GRAM_BANK["substantiv"], k=per)
        tokens += subs;  [sol.setdefault(w,"Substantiv") for w in subs]
    if "Verb" in categories:
        verbs = random.sample(GRAM_BANK["verb"], k=per)
        tokens += verbs; [sol.setdefault(w,"Verb") for w in verbs]
    if "Adjektiv" in categories:
        adjs = random.sample(GRAM_BANK["adjektiv"], k=per)
        tokens += adjs;  [sol.setdefault(w,"Adjektiv") for w in adjs]
    # toppa upp om vi saknar några tokens
    pool_extra = GRAM_BANK["substantiv"]+GRAM_BANK["verb"]+GRAM_BANK["adjektiv"]
    while len(tokens) < tok_n:
        w = random.choice(pool_extra)
        if w not in sol:
            sol[w] = random.choice(categories)
            tokens.append(w)
    random.shuffle(tokens)
    return {
        "id": "",
        "topic": "svenska",
        "area": "grammatik",
        "type": "dnd",
        "q": "Dra orden till rätt kategori.",
        "buckets": [{"label":c} for c in categories],
        "tokens": tokens,
        "solution": sol,
        "hint": "Substantiv = namn (katt). Verb = något man gör (springer). Adjektiv = beskriver (röd).",
        "explain": "Tänk: 'en/ett' före (substantiv), 'att' före (verb), beskriver egenskap (adjektiv).",
        "difficulty": level_profile["difficulty"]
    }

def dnd_prepositioner(level_profile)->dict:
    min_t, max_t = level_profile["dnd_tokens"]
    tok_n = random.randint(min_t, max_t)
    pres_n = max(3, tok_n//2)
    pres = random.sample(GRAM_BANK["preposition"], k=min(pres_n, len(GRAM_BANK["preposition"])))
    not_pres_pool = GRAM_BANK["substantiv"] + GRAM_BANK["verb"] + GRAM_BANK["adjektiv"] + GRAM_BANK["pronomen"]
    not_pres = random.sample(not_pres_pool, k=tok_n - len(pres))
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
        "q": "Dra prepositionerna till 'Preposition' och övriga ord till 'Inte preposition'.",
        "buckets": [{"label":"Preposition"},{"label":"Inte preposition"}],
        "tokens": tokens,
        "solution": sol,
        "hint": HINTS["preposition"],
        "explain": "Prepositioner anger läge/riktning: på, i, under, bakom, framför, vid, mellan…",
        "difficulty": level_profile["difficulty"]
    }

def gen_dnd(level_profile)->dict:
    return dnd_substantiv_verb_adjektiv(level_profile) if random.random()<0.6 else dnd_prepositioner(level_profile)

# ------------------------- Läsförståelse -------------------------

# Baspassager (korta) + nya längre varianter
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
    },
    # Nya mallar
    {
        "title": "Cykelreparationen",
        "text": ("Oskar fick punktering på väg till fotbollen. Han stannade vid en bänk och kände på däcket. "
                 "En liten sten satt fast i gummit. Han plockade bort den och pumpade däcket med sin lilla handpump. "
                 "Sedan cyklade han försiktigt vidare."),
        "qs": [
            ("Varför stannade Oskar?", ["Det regnade","Han tappade sin väska","Han fick punktering","Han skulle vila"], 2),
            ("Vad gjorde Oskar med stenen?", ["Lämnade den","Plockade bort den","Kastade den i sjön","Målade den"], 1),
            ("Hur cyklade han efteråt?", ["Snabbt","Försiktigt","Inte alls","Baklänges"], 1)
        ]
    },
    {
        "title": "Biblioteksbesöket",
        "text": ("Sara gick till biblioteket efter skolan. Hon letade efter en bok om rymden. "
                 "Bibliotekarien visade en hylla med faktaböcker. Sara valde en bok med många bilder och lånade den."),
        "qs": [
            ("Vad letade Sara efter?", ["En bok om rymden","En bok om djur","En saga","En tidning"], 0),
            ("Vem hjälpte henne?", ["Läraren","En klasskompis","Bibliotekarien","Hennes bror"], 2),
            ("Vad hade boken?", ["Inga bilder","Bara kartor","Många bilder","Bara text"], 2)
        ]
    },
    {
        "title": "Skolmästerskapet",
        "text": ("Skolan ordnade ett litet mästerskap i löpning. Nora var nervös vid startlinjen. "
                 "När visselpipan lät sprang hon så gott hon kunde. Hon kom inte först, men hon slog sitt eget rekord. "
                 "Hon log hela vägen hem."),
        "qs": [
            ("Vad tävlade de i?", ["Simning","Löpning","Hinderbana","Skidor"], 1),
            ("Hur kände sig Nora innan start?", ["Glad","Ledsen","Nervös","Arg"], 2),
            ("Vad hände till slut?", ["Hon vann","Hon bröt loppet","Hon slog sitt rekord","Hon föll"], 2)
        ]
    },
]

# några längre “hard”-varianter (samma struktur, längre text)
PASSAGE_HARD_EXTRAS = [
    {
        "title": "Stadsparken på lördagen",
        "text": ("På lördagsmorgonen var parken redan full av människor. "
                 "Några tränade, andra promenerade lugnt med hundar. "
                 "Vid den lilla scenen höll en grupp barn på att öva en teaterpjäs. "
                 "Elin satte sig på en bänk och såg hur en flicka tappade sin hatt, "
                 "men en pojke plockade upp den och räckte tillbaka den med ett leende."),
        "qs": [
            ("Vad gjorde barnen vid scenen?", ["De målade","De åt glass","De övade teater","De spelade fotboll"], 2),
            ("Vem tappade hatten?", ["En pojke","En flicka","Elin","En hundägare"], 1),
            ("Hur slutade det med hatten?", ["Den blåste bort","Den bröts sönder","Den lämnades kvar","Den lämnades tillbaka"], 3),
            ("Vad gjorde Elin?", ["Sprang hem","Satte sig på en bänk","Spelade musik","Handlade mat"], 1)
        ]
    },
    {
        "title": "Klassens odling",
        "text": ("Klass 3B hade en liten odlingslåda på skolgården. "
                 "De turades om att vattna och rensa ogräs. "
                 "När de första tomaterna blev röda samlades klassen runt lådan. "
                 "De pratade om hur växterna växer och varför solen och vattnet är viktiga. "
                 "Till slut fick varje elev smaka en liten bit tomat."),
        "qs": [
            ("Vad hade klassen?", ["En sandlåda","En odlingslåda","En pool","En fågelbur"], 1),
            ("Vad gjorde de med ogräset?", ["Lät det vara","Vattnade det","Rensade bort det","Planterade mer"], 2),
            ("Varför samlades de?", ["För att rita","För att sjunga","För att tomaterna blev röda","För att städa"], 2),
            ("Vad fick eleverna göra till slut?", ["Ta hem tomaterna","Måla lådan","Smaka tomat","Sälja tomaterna"], 2)
        ]
    }
]

def trim_to_word_count(text: str, min_words: int, max_words: int) -> str:
    words = text.split()
    target = random.randint(min_words, max_words)
    if len(words) <= target: return text
    return " ".join(words[:target]) + "."

def gen_passage(level_profile) -> dict:
    # välj pool efter nivå
    pool = PASSAGE_TEMPLATES + (PASSAGE_HARD_EXTRAS if level_profile["difficulty"]=="hard" else [])
    tpl = random.choice(pool)
    title = tpl["title"]
    base_text = tpl["text"]

    # Trimma textlängd enligt nivå
    minw, maxw = level_profile["pass_len"]
    text = trim_to_word_count(base_text, minw, maxw)

    # Välj antal frågor per passage – säkra intervall mot mallens faktiska frågor
    base_qs = tpl["qs"][:]
    random.shuffle(base_qs)
    low, high = level_profile["pass_qs"]
    avail = len(base_qs)
    if avail == 0:
        # fallback: skapa en enkel dummyfråga så vi aldrig kraschar
        base_qs = [("Vad hände i texten?", ["Inget", "Något", "Vet ej", "Allt"], 1)]
        avail = 1

    hi = min(high, avail)
    lo = min(low, hi)  # om mall har färre frågor än low, sänk low
    take = random.randint(lo, hi) if hi >= 1 else 1

    questions = []
    for i in range(take):
        qtext, options, correct = base_qs[i]
        questions.append({
            "id": "",
            "q": qtext,
            "options": options,
            "correct": correct,
            "hint": HINTS["läs"],
            "explain": HINTS["läs"]
        })

    return {
        "id": "",
        "title": title,
        "text": text,
        "questions": questions
    }
# ------------------------- MAIN build -------------------------

def make_mc_item(level_profile) -> dict:
    r = random.random()
    if r < 0.34:
        return gen_stavning(level_profile)
    elif r < 0.68:
        return gen_grammatik(level_profile)
    else:
        return gen_ordforstaelse(level_profile)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True, help="Sökväg till svenska.json")
    ap.add_argument("--items", type=int, default=120, help="Antal MC-frågor")
    ap.add_argument("--dnd", type=int, default=8, help="Antal drag & drop-uppgifter")
    ap.add_argument("--passages", type=int, default=6, help="Antal läsförståelse-passager")
    ap.add_argument("--level", type=str, default="np", choices=["easy","np","hard"], help="Svårighetsnivå")
    ap.add_argument("--seed", type=int, default=None)
    ap.add_argument("--replace", action="store_true", help="Skriv över items/passages helt")
    args = ap.parse_args()

    if args.seed is not None:
        random.seed(args.seed)

    level_profile = profile_for_level(args.level)

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
        q = make_mc_item(level_profile)
        q["id"] = f"sv-{nid_item:03d}"
        nid_item += 1
        # hint/explain säkerställs
        q.setdefault("hint", explain_for(q))
        q.setdefault("explain", explain_for(q))
        q.setdefault("topic","svenska")
        created_items.append(q)

    # 2) DnD
    for _ in range(max(0, args.dnd)):
        q = gen_dnd(level_profile)
        q["id"] = f"sv-{nid_item:03d}"
        nid_item += 1
        created_items.append(q)

    # 3) Läsförståelse
    for _ in range(max(0, args.passages)):
        p = gen_passage(level_profile)
        p["id"] = f"sv-p-{nid_pass:03d}"
        # sätt unika id på underfrågor
        for i, subq in enumerate(p["questions"], start=1):
            subq["id"] = f"{p['id']}-q{i}"
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
    print(f"Nivå: {level_profile['difficulty']}")
    print(f"Nästa lediga item-id blir: sv-{nid_item:03d}")
    print(f"Nästa lediga passage-id blir: sv-p-{nid_pass:03d}")

if __name__ == "__main__":
    main()