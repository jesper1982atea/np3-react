#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Skapa en helt ny frågebank (svenska eller matematik) för åk 3.

Exempel (svenska åk 3):
  python generators/create_bank.py \
    --subject svenska --grade 3 \
    --bank-id sv-ak3 --label "Svenska åk 3" \
    --desc "Svenska-träning inför NP åk 3" \
    --items 140 --dnd 12 --passages 8 \
    --level np \
    --out public/banks/svenska.ak3.json \
    --update-index

Exempel (matematik åk 3):
  python generators/create_bank.py \
    --subject matematik --grade 3 \
    --bank-id ma-ak3 --label "Matematik åk 3" \
    --desc "Matte: åk 3 med diagram och lätt division" \
    --items 220 --diagrams 24 --level np \
    --out public/banks/matematik.ak3.json \
    --update-index --retune-division yes --max-dividend 50 --allow-nine no
"""

import json, random, argparse, os, re
from pathlib import Path
from typing import List, Dict, Any, Tuple

PROJECT_ROOT = Path(__file__).resolve().parents[1]
BANKS_DIR = PROJECT_ROOT / "public" / "banks"
INDEX_PATH = BANKS_DIR / "index.json"


RNG = random.Random()
_MIN_DIFF = 0.72  # default Jaccard-tröskel för anti-repetition

# ---------- anti-repetition / uniqueness helpers ----------

def normalize_text(s: str) -> str:
    s = (s or "")
    s = s.lower()
    s = re.sub(r"\s+", " ", s).strip()
    s = re.sub(r"[\.,!?:;\-–—]", "", s)
    return s

def sig_item(it: dict) -> str:
    """Signature used to avoid duplicates / near-duplicates."""
    t = it.get("type") or "mc"
    area = it.get("area") or ""
    q = normalize_text(it.get("q") or "")
    # for mc, include sorted options to reduce repeated permutations
    if t in (None, "", "mc", "bar-max", "bar-compare"):
        ops = [str(x) for x in (it.get("options") or [])]
        ops = sorted([normalize_text(o) for o in ops])
        return f"{t}|{area}|{q}|{'|'.join(ops)}"
    # for dnd, include bucket labels
    if t == "dnd":
        b = [normalize_text(x.get('label','')) for x in (it.get('buckets') or [])]
        return f"{t}|{area}|{q}|{'|'.join(b)}"
    # charts: include labels
    if t in ("bar-max","bar-compare"):
        ch = it.get("chart") or {}
        labs = [normalize_text(x) for x in (ch.get("labels") or [])]
        return f"{t}|{area}|{q}|{'|'.join(labs)}"
    return f"{t}|{area}|{q}"

def jaccard(a: set, b: set) -> float:
    if not a and not b: return 1.0
    return len(a & b) / max(1, len(a | b))

def too_similar(q1: str, q2: str, threshold: float=0.8) -> bool:
    A = set(normalize_text(q1).split())
    B = set(normalize_text(q2).split())
    return jaccard(A,B) >= threshold

class UniqueCollector:
    """Keeps signatures and questions to reduce repetitions."""
    def __init__(self, min_diff: float=0.75):
        self.sigs = set()
        self.questions = []  # store q text to compare semantic overlap
        self.min_diff = min_diff
    def accept(self, it: dict) -> bool:
        s = sig_item(it)
        if s in self.sigs:
            return False
        q = it.get('q') or ''
        for prev in self.questions[-400:]:  # compare against recent only for speed
            if too_similar(prev, q, threshold=self.min_diff):
                return False
        self.sigs.add(s)
        self.questions.append(q)
        return True

# -------------------- utils --------------------

def ensure_dir(p: Path):
    p.parent.mkdir(parents=True, exist_ok=True)

def write_json(path: Path, data: dict):
    ensure_dir(path)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(path)

def load_json(path: Path, default=None):
    if not path.exists():
        return default if default is not None else {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default if default is not None else {}

def update_index(bank_id: str, label: str, path_rel: str, subject: str, grade: int, description: str):
    idx = load_json(INDEX_PATH, default={"entries":[]})
    entries = idx.get("entries") or idx.get("banks") or []
    # ersätt existerande
    updated = False
    for e in entries:
        if e.get("id") == bank_id:
            e.update({
                "label": label,
                "path": path_rel,
                "subject": subject,
                "grade": grade,
                "description": description
            })
            updated = True
            break
    if not updated:
        entries.append({
            "id": bank_id,
            "label": label,
            "path": path_rel,
            "subject": subject,
            "grade": grade,
            "description": description
        })
    idx["entries"] = entries
    write_json(INDEX_PATH, idx)

def znext_id(items: List[dict], prefix: str) -> callable:
    """Returnerar gen() som ger nästa id som prefix + 3-siffror."""
    mx = 0
    pad = 3
    for it in items:
        _id = str(it.get("id",""))
        if _id.startswith(prefix):
            tail = _id[len(prefix):]
            if tail.isdigit():
                mx = max(mx, int(tail))
                pad = max(pad, len(tail))
    def gen():
        nonlocal mx
        mx += 1
        return f"{prefix}{str(mx).zfill(pad)}"
    return gen

def letter(i:int)->str: return chr(65+i) if isinstance(i,int) and i>=0 else "—"

# -------------------- nivåprofil --------------------

def profile_for_level(level:str)->dict:
    level = (level or "np").lower()
    if level == "easy":
        return dict(
            difficulty="easy",
            # svenska
            dnd_tokens=(6,8), dnd_cats=(2,3), pass_qs=(3,4), pass_len=(40,75),
            distractor=0.35,
            # matte
            div_max_dividend=40, allow_nine=False
        )
    if level == "hard":
        return dict(
            difficulty="hard",
            dnd_tokens=(10,14), dnd_cats=(3,3), pass_qs=(4,5), pass_len=(90,140),
            distractor=0.8,
            div_max_dividend=80, allow_nine=True
        )
    return dict(
        difficulty="np",
        dnd_tokens=(8,10), dnd_cats=(2,3), pass_qs=(3,5), pass_len=(60,100),
        distractor=0.6,
        div_max_dividend=50, allow_nine=False
    )

# -------------------- SVENSKA generators --------------------

HINTS_SV = {
    "stavning": "Titta noga på bokstäver och ljud – sj-, tj-, hj-, lj- och dubbelteckning är vanliga fällor.",
    "grammatik": "Substantiv = namn (katt). Verb = gör/är (springer/är). Adjektiv = beskriver (röd).",
    "ord": "Synonym ≈ liknande ord. Antonym = motsats. Testa byta ut i meningen.",
    "läs": "Läs en gång till och markera nyckelord. Jämför med frågan.",
    "preposition": "Prepositioner anger läge/riktning: på, i, under, bakom, framför, vid, mellan…"
}
GRAM_BANK = {
    "substantiv": ["katt","Lisa","skola","boll","bord","hund","cykel","fisk","skog","bil","äpple","pennor","fågel","gata","stol"],
    "verb": ["springer","läser","är","äter","sover","ritar","skriver","hoppar","simmar","leker","talar","sjunger","tittar","står","går"],
    "adjektiv": ["röd","stor","snabb","glad","ljus","mjuk","tyst","lång","varm","blå","smal","hård","tung","kall","mörk"],
    "pronomen": ["han","hon","den","det","de","vi","jag","ni"],
    "preposition": ["på","i","under","över","bakom","framför","vid","mellan","bredvid","genom"]
}
STAVNING_PAIRS = [
    ("hjärta","hjerta"), ("gärna","gjärna"), ("skjorta","sjorta"), ("choklad","sjoklad"),
    ("kemi","schemi"), ("känna","kjänna"), ("kör","kjör"), ("genast","jennast"), ("tjej","tjei"),
    ("stjärna","stiarna"), ("björn","biorn"), ("macka","maka"), ("sked","ked")
]
ORD_SYNONYM = [
    ("glad", ["lycklig","ledsen","trött","arg"]),
    ("snabb", ["kvick","långsam","tyst","mjuk"]),
    ("stor", ["enorm","liten","kort","smal"]),
    ("kall", ["frusen","varm","ljus","torr"]),
]
ORD_MOTSATS = [
    ("lång", ["kort","snabb","mjuk","tyst"]),
    ("hård", ["mjuk","tung","lätt","torr"]),
    ("rätt", ["fel","sant","klart","snällt"]),
    ("tidig", ["sen","långsam","kort","tyst"]),
]

def sv_unique_options(correct_text:str, pool:List[str], n=4, strength=0.6)->Tuple[List[str],int]:
    def score(w:str)->int:
        common = len(set(correct_text) & set(w))
        pref = 0
        for a,b in zip(correct_text, w):
            if a==b: pref += 1
            else: break
        return pref*2 + common
    ranked = sorted([p for p in pool if p != correct_text], key=score, reverse=True)
    k_like = max(0, min(len(ranked), round(strength*(n-1))))
    candidates = ranked[:k_like] + ranked[k_like:]
    opts = [correct_text]
    for p in candidates:
        if p not in opts:
            opts.append(p)
        if len(opts)==n: break
    i=0
    while len(opts)<n and i<100:
        i+=1
        cand = (pool[i%len(pool)] if pool else f"{correct_text}{i}")
        if cand not in opts:
            opts.append(cand)
    RNG.shuffle(opts)
    return opts, opts.index(correct_text)

def sv_gen_stavning(profile)->dict:
    right, wrong = RNG.choice(STAVNING_PAIRS)
    def tweak(w:str)->str:
        if profile["distractor"] >= 0.7:
            if "ä" in w: return w.replace("ä","e",1)
            if "å" in w: return w.replace("å","a",1)
            if "kk" in w: return w.replace("kk","k",1)
            return w+"e"
        else:
            return w.replace("k","c",1) if "k" in w else w+"a"
    bad2 = tweak(right)
    bad3 = tweak(right[::-1])[::-1]
    options, ci = sv_unique_options(right, [wrong,bad2,bad3], 4, profile["distractor"])
    return dict(
        id="", type="mc", topic="svenska", area="stavning",
        q="Vilket ord stavas rätt?", options=options, correct=ci,
        hint=HINTS_SV["stavning"], explain=HINTS_SV["stavning"],
        difficulty=profile["difficulty"]
    )

def sv_gen_grammatik(profile)->dict:
    cats = ["substantiv","verb","adjektiv","pronomen"] + (["preposition"] if profile["difficulty"]!="easy" else [])
    cat = RNG.choice(cats)
    correct = RNG.choice(GRAM_BANK[cat])
    pool = [w for k,arr in GRAM_BANK.items() if k!=cat for w in arr]
    RNG.shuffle(pool)
    wrongs = pool[:6]
    opts, ci = sv_unique_options(correct, wrongs, 4, profile["distractor"])
    q = f"Vilket ord är ett {cat}?"
    return dict(
        id="", type="mc", topic="svenska", area="grammatik",
        q=q, options=opts, correct=ci,
        hint=("Prepositioner anger läge/riktning." if cat=="preposition" else HINTS_SV["grammatik"]),
        explain=("Prepositioner anger läge/riktning." if cat=="preposition" else HINTS_SV["grammatik"]),
        difficulty=profile["difficulty"]
    )

def sv_gen_ord(profile)->dict:
    if RNG.random()<0.5:
        base, opts = RNG.choice(ORD_SYNONYM)
        q = f"Vilket ord betyder ungefär samma som '{base}'?"
        correct = opts[0]; pool = opts[1:] + [base+"ig", "super"+base]
    else:
        base, opts = RNG.choice(ORD_MOTSATS)
        q = f"Vilket ord är motsats till '{base}'?"
        correct = opts[0]; pool = opts[1:] + [base+"-lik","inte "+base]
    o, ci = sv_unique_options(correct, pool, 4, profile["distractor"])
    return dict(
        id="", type="mc", topic="svenska", area="ordförståelse",
        q=q, options=o, correct=ci, hint=HINTS_SV["ord"], explain=HINTS_SV["ord"],
        difficulty=profile["difficulty"]
    )

def sv_gen_dnd(profile)->dict:
    # 60% S/V/A, annars prepositioner
    if RNG.random()<0.6:
        min_t,max_t = profile["dnd_tokens"]; tok_n = RNG.randint(min_t,max_t)
        cats_count = RNG.randint(*profile["dnd_cats"])
        categories = ["Substantiv","Verb","Adjektiv"][:cats_count]
        tokens=[]; sol={}
        per = max(2, tok_n//max(1,cats_count))
        if "Substantiv" in categories:
            subs = RNG.sample(GRAM_BANK["substantiv"], k=per); tokens+=subs; [sol.setdefault(w,"Substantiv") for w in subs]
        if "Verb" in categories:
            verbs = RNG.sample(GRAM_BANK["verb"], k=per); tokens+=verbs; [sol.setdefault(w,"Verb") for w in verbs]
        if "Adjektiv" in categories:
            adjs = RNG.sample(GRAM_BANK["adjektiv"], k=per); tokens+=adjs; [sol.setdefault(w,"Adjektiv") for w in adjs]
        pool_extra = GRAM_BANK["substantiv"]+GRAM_BANK["verb"]+GRAM_BANK["adjektiv"]
        while len(tokens)<tok_n:
            w = RNG.choice(pool_extra)
            if w not in sol:
                sol[w]=RNG.choice(categories); tokens.append(w)
        RNG.shuffle(tokens)
        return dict(
            id="", topic="svenska", area="grammatik", type="dnd",
            q="Dra orden till rätt kategori.",
            buckets=[{"label":c} for c in categories],
            tiles=tokens, solution=sol,
            hint="Substantiv = namn. Verb = gör/är. Adjektiv = beskriver.",
            explain="Testa 'en/ett' (substantiv), 'att' (verb). Adjektiv beskriver egenskap.",
            difficulty=profile["difficulty"]
        )
    else:
        min_t,max_t = profile["dnd_tokens"]; tok_n = RNG.randint(min_t,max_t)
        pres_n = max(3, tok_n//2)
        pres = RNG.sample(GRAM_BANK["preposition"], k=min(pres_n, len(GRAM_BANK["preposition"])))
        not_pres_pool = GRAM_BANK["substantiv"] + GRAM_BANK["verb"] + GRAM_BANK["adjektiv"] + GRAM_BANK["pronomen"]
        not_pres = RNG.sample(not_pres_pool, k=tok_n - len(pres))
        tokens = pres + not_pres; RNG.shuffle(tokens)
        sol = { **{w:"Preposition" for w in pres}, **{w:"Inte preposition" for w in not_pres} }
        return dict(
            id="", topic="svenska", area="grammatik", type="dnd",
            q="Dra prepositionerna till 'Preposition' och övriga ord till 'Inte preposition'.",
            buckets=[{"label":"Preposition"},{"label":"Inte preposition"}],
            tiles=tokens, solution=sol,
            hint=HINTS_SV["preposition"], explain=HINTS_SV["preposition"],
            difficulty=profile["difficulty"]
        )

PASSAGES = [
    {
        "title":"Lisa och skoldörren",
        "text":("Lisa sprang mot skolan. Hon hade nästan försovit sig. "
                "När hon kom fram var dörren stängd. Hon knackade försiktigt, "
                "och vaktmästaren öppnade med ett leende. Lisa tackade och skyndade till klassrummet."),
        "qs":[
            ("Varför sprang Lisa?",["Hon var hungrig","Hon hade bråttom","Hon skulle leka","Hon tappade en bok"],1),
            ("Vem öppnade dörren?",["Rektorn","Läraren","Vaktmästaren","Kompisen"],2),
            ("Hur kände sig Lisa när dörren öppnades?",["Ledsen","Arg","Lättad","Trött"],2)
        ]
    },
    {
        "title":"Utflykten till skogen",
        "text":("Klassen gick till skogen. De plockade kottar och letade efter spår. "
                "Adam hittade ett litet fågelbo på marken. Läraren berättade att man bara fick titta och inte röra."),
        "qs":[
            ("Vad hittade Adam?",["Ett fågelbo","En sten","En fjäder","En blomma"],0),
            ("Vad sa läraren att man skulle göra?",["Ta med boet hem","Inte röra boet","Röra försiktigt","Bygga ett nytt"],1),
            ("Var var klassen?",["I stan","Vid sjön","I skogen","I klassrummet"],2)
        ]
    },
    {
        "title":"Cykelloppet",
        "text":("På lördagen ordnades ett litet cykellopp i parken. "
                "Maja pumpade däcken och satte på hjälmen. Hennes kompis Ali hejade vid målet. "
                "Maja kom inte först, men hon log ändå."),
        "qs":[
            ("Var ägde loppet rum?",["Vid sjön","I parken","På skolgården","I skogen"],1),
            ("Vad gjorde Maja före loppet?",["Åt mellis","Pumpade däcken","Läste en bok","Ringde Ali"],1),
            ("Hur kände sig Maja efter loppet?",["Besviken","Arg","Glad","Hungrig"],2)
        ]
    },
    {
        "title":"Bakdagen",
        "text":("Klassen bakade bullar i hemkunskapssalen. "
                "Noah mätte upp mjöl och socker. Nora rörde i degen. "
                "Doften spreds i hela korridoren."),
        "qs":[
            ("Vad bakade klassen?",["Kakor","Bullar","Paj","Bröd"],1),
            ("Vem rörde i degen?",["Noah","Nora","Läraren","Ali"],1),
            ("Var spreds doften?",["På skolgården","I hela korridoren","I klassrummet","I matsalen"],1)
        ]
    },
    {
        "title":"Städdagen",
        "text":("Skolan hade städdag. Eleverna plockade skräp på fotbollsplanen. "
                "Läraren delade ut handskar och påsar. Efteråt fikade de i solen."),
        "qs":[
            ("Vilken plats städade de?",["Skolgården","Fotbollsplanen","Parkeringen","Matsalen"],1),
            ("Vad delade läraren ut?",["Böcker och pennor","Hjälmar","Handskar och påsar","Kepsar"],2),
            ("Vad gjorde de efteråt?",["Spelade fotboll","Åkte hem","Fikade","Läste"],2)
        ]
    }
]
NAMES = ["Lisa","Maja","Ali","Noah","Nora","Ella","Arvid","Leo","Sara","Oskar","Miriam","Johan","Vera","Axel","Sofia"]
PLACES = ["parken","skogen","biblioteket","matsalen","klassrummet","skolgården","gympasalen","fotbollsplanen","aulan","stranden"]
OBJECTS = ["boll","bok","cykel","penna","äpple","fika","karta","mål","spade","väska"]
ACTIONS = ["springer","läser","ritar","övar","simmar","dansar","sjunger","leker","skriver","räknar"]

def sv_gen_context(profile)->dict:
    name = RNG.choice(NAMES); place = RNG.choice(PLACES); obj = RNG.choice(OBJECTS); act = RNG.choice(ACTIONS)
    q = f"Vilket ord är ett verb i meningen: '{name} {act} i {place} med en {obj}.'"
    opts = [act, name, place, obj]
    correct = 0
    RNG.shuffle(opts)
    correct = opts.index(act)
    return dict(
        id="", type="mc", topic="svenska", area="grammatik",
        q=q, options=opts, correct=correct,
        hint=HINTS_SV["grammatik"], explain="Verb är något man gör/är.",
        difficulty=profile["difficulty"]
    )

def sv_trim(text:str, minw:int, maxw:int)->str:
    words = text.split()
    target = RNG.randint(minw, maxw)
    return " ".join(words[:target]) + ("." if not text.strip().endswith(".") else "")

def sv_gen_passage(profile)->dict:
    tpl = RNG.choice(PASSAGES)
    minw,maxw = profile["pass_len"]
    text = sv_trim(tpl["text"], minw, maxw)
    low, high = profile["pass_qs"]
    base_qs = tpl["qs"][:]
    RNG.shuffle(base_qs)
    hi = min(high, len(base_qs))
    lo = min(low, hi)
    take = RNG.randint(lo, hi) if hi>=1 else 1
    qs=[]
    for i in range(take):
        qtext, options, correct = base_qs[i]
        qs.append(dict(
            id="", q=qtext, options=options, correct=correct,
            hint=HINTS_SV["läs"], explain=HINTS_SV["läs"],
            topic="svenska", difficulty=profile["difficulty"]
        ))
    return dict(id="", title=tpl["title"], text=text, questions=qs)

# -------------------- MATEMATIK generators --------------------

HINTS_MA = {
    "addition": "Räkna från det större talet, använd tiokamrater för att göra hel tiotal.",
    "subtraktion": "Räkna upp till nästa tia, eller dela talet i tiotal och ental.",
    "multiplikation": "Upprepad addition. Öva 2-, 5- och 10-tabellen först.",
    "division": "Multiplikation baklänges: hur många gånger ryms talet? Använd små tal 1–10.",
    "klockan": "Hel = :00, halv = :30, kvart = :15/:45.",
    "geometri": "En kvadrat har 4 hörn och 4 lika långa sidor.",
    "diagram": "Jämför staplarnas höjd – högst vinner. Skillnad = hur mycket högre den ena är."
}

def ma_mc_add()->dict:
    a = RNG.randint(1,20); b = RNG.randint(1,20)
    ans = a+b
    wrongs = sorted({ans-1, ans+1, max(0, ans-2)})
    RNG.shuffle(wrongs)
    opts = [str(ans)] + [str(x) for x in wrongs[:3]]
    RNG.shuffle(opts)
    return dict(id="", type="mc", topic="matematik", area="addition",
                q=f"{a} + {b} =", options=opts, correct=opts.index(str(ans)),
                hint=HINTS_MA["addition"], explain=HINTS_MA["addition"])

def ma_mc_sub()->dict:
    a = RNG.randint(6,30); b = RNG.randint(1, min(10,a-1))
    ans = a-b
    wrongs = sorted({ans-1, ans+1, max(0, ans-2)})
    RNG.shuffle(wrongs)
    opts = [str(ans)] + [str(x) for x in wrongs[:3]]
    RNG.shuffle(opts)
    return dict(id="", type="mc", topic="matematik", area="subtraktion",
                q=f"{a} − {b} =", options=opts, correct=opts.index(str(ans)),
                hint=HINTS_MA["subtraktion"], explain=HINTS_MA["subtraktion"])

def ma_mc_mul()->dict:
    a = RNG.randint(2,10); b = RNG.randint(2,10)
    ans = a*b
    wrongs = sorted({ans-2, ans+2, ans+1})
    RNG.shuffle(wrongs)
    opts = [str(ans)] + [str(x) for x in wrongs[:3]]
    RNG.shuffle(opts)
    return dict(id="", type="mc", topic="matematik", area="multiplikation",
                q=f"{a} × {b} =", options=opts, correct=opts.index(str(ans)),
                hint=HINTS_MA["multiplikation"], explain=HINTS_MA["multiplikation"])

def ma_mc_div(profile)->dict:
    allow_nine = profile["allow_nine"]
    max_dividend = profile["div_max_dividend"]
    b = RNG.randint(2,10)
    if not allow_nine and b==9: b = 8
    qv = RNG.randint(2,10)
    a = b*qv
    while a > max_dividend:
        qv = RNG.randint(2,10)
        a = b*qv
    ans = qv
    wrongs = sorted({ans-1, ans+1, max(1, ans-2)})
    RNG.shuffle(wrongs)
    opts = [str(ans)] + [str(x) for x in wrongs[:3]]
    RNG.shuffle(opts)
    return dict(id="", type="mc", topic="matematik", area="division",
                q=f"{a} ÷ {b} =", options=opts, correct=opts.index(str(ans)),
                hint=HINTS_MA["division"], explain=HINTS_MA["division"])

def ma_mc_clock()->dict:
    h = RNG.randint(1,12)
    m = RNG.choice([0, 30, 15, 45])
    lab = f"{'Halv' if m==30 else ('Kvart över' if m==15 else ('Kvart i' if m==45 else 'Hel'))} {h}"
    # digitala alternativ
    dig = {
        0: f"{h:02d}:00",
        30: f"{h%12+ (0 if h<12 else 0):02d}:30",
        15: f"{h:02d}:15",
        45: f"{(h%12)+1:02d}:45"
    }
    correct = dig[m]
    opts = [dig[0], dig[30], dig[15], dig[45]]
    RNG.shuffle(opts)
    return dict(id="", type="mc", topic="matematik", area="klockan",
                q=f"{lab} i digital tid:", options=opts, correct=opts.index(correct),
                hint=HINTS_MA["klockan"], explain=HINTS_MA["klockan"])

def ma_mc_geo()->dict:
    opts = ["2","3","4","5"]; correct = 2
    return dict(id="", type="mc", topic="matematik", area="geometri",
                q="Hur många hörn har en kvadrat?", options=opts, correct=correct,
                hint=HINTS_MA["geometri"], explain=HINTS_MA["geometri"])

# ---- Diagram

def make_bar_dataset():
    labels_pool = [
        ["Mån","Tis","Ons","Tors"], ["Röd","Blå","Grön","Gul"],
        ["Äpple","Banan","Päron","Apelsin"], ["Hund","Katt","Kanin","Fisk"]
    ]
    labels = RNG.choice(labels_pool)
    values = [RNG.randint(1,9) for _ in labels]
    unit = RNG.choice(["st","elever","frukter","röster","poäng"])
    title = RNG.choice(["Antal i klassen","Sålda frukter","Röster i omröstning","Utlånade böcker"])
    return {"labels":labels,"values":values,"unit":unit,"title":title}

def ma_bar_max(ds)->dict:
    labs, vals = ds["labels"], ds["values"]
    max_i = max(range(len(vals)), key=lambda i: vals[i])
    return dict(
        id="", type="bar-max", topic="matematik", area="diagram",
        q=f"Vilken har flest i '{ds['title']}'?",
        chart=ds, options=labs[:], correct=max_i,
        hint=HINTS_MA["diagram"], explain=f"Den högsta stapeln är {labs[max_i]} ({vals[max_i]} {ds['unit']})."
    )

def ma_bar_compare(ds)->dict:
    labs, vals = ds["labels"], ds["values"]
    i,j = RNG.sample(range(len(labs)), 2)
    diff = abs(vals[i]-vals[j])
    candidates = sorted({diff, max(0,diff-1), diff+1, max(0,diff+2)})
    RNG.shuffle(candidates)
    return dict(
        id="", type="bar-compare", topic="matematik", area="diagram",
        q=f"Hur många fler {ds['unit']} är det i {labs[i]} än i {labs[j]}?",
        chart=ds, options=[str(c) for c in candidates], correct=candidates.index(diff),
        hint=HINTS_MA["diagram"], explain=f"{labs[i]} har {vals[i]} och {labs[j]} har {vals[j]} (skillnad {diff})."
    )

# -------------------- builders --------------------

def build_svenska(profile:dict, items:int, dnd:int, passages:int)->dict:
    bank = {"subject":"svenska","items":[],"passages":[]}
    nid = znext_id(bank["items"], "sv-")
    npid = znext_id(bank["passages"], "sv-p-")

    # MC items (with uniqueness guard)
    uc = UniqueCollector(min_diff=_MIN_DIFF)
    attempts = 0
    target = max(0, items)
    while len([x for x in bank["items"] if x.get("type","mc") != "dnd"]) < target and attempts < target*10:
        attempts += 1
        r = RNG.random()
        if r < 0.25:
            it = sv_gen_stavning(profile)
        elif r < 0.50:
            it = sv_gen_grammatik(profile)
        elif r < 0.75:
            it = sv_gen_ord(profile)
        else:
            it = sv_gen_context(profile)
        if uc.accept(it):
            it["id"] = nid()
            bank["items"].append(it)

    # DnD
    for _ in range(max(0, dnd)):
        it = sv_gen_dnd(profile)
        # lightweight uniqueness: avoid identical category sets and same tokens
        s = sig_item(it)
        if any(sig_item(x)==s for x in bank["items"] if x.get("type")=="dnd"):
            continue
        it["id"] = nid()
        bank["items"].append(it)

    # Passages
    for _ in range(max(0, passages)):
        p = sv_gen_passage(profile)
        p["id"] = npid()
        for i, q in enumerate(p["questions"], start=1):
            q["id"] = f"{p['id']}-q{i}"
        bank["passages"].append(p)

    return bank

def build_matematik(profile:dict, items:int, diagrams:int)->dict:
    bank = {"subject":"matematik","items":[]}
    nid = znext_id(bank["items"], "ma-")

    gens = [ma_mc_add, ma_mc_sub, ma_mc_mul, lambda: ma_mc_div(profile),
            ma_mc_clock, ma_mc_geo]
    uc = UniqueCollector(min_diff=_MIN_DIFF)
    attempts = 0
    target = max(0, items)
    while len(bank["items"]) < target and attempts < target*10:
        attempts += 1
        it = RNG.choice(gens)()
        if uc.accept(it):
            it["id"] = nid()
            bank["items"].append(it)

    for k in range(max(0, diagrams)):
        ds = make_bar_dataset()
        it = ma_bar_max(ds) if k%2==0 else ma_bar_compare(ds)
        it["id"] = nid()
        bank["items"].append(it)

    return bank

def backfill(bank:dict):
    """Säkerställ hint/explain/correct mm."""
    def fix_mc(item:dict):
        opts = item.get("options")
        c = item.get("correct", 0)
        if isinstance(opts, list) and len(opts)>=2:
            if not isinstance(c,int) or c<0 or c>=len(opts):
                item["correct"] = 0

    if "items" in bank:
        for it in bank["items"]:
            it.setdefault("type", it.get("type") or "mc")
            it.setdefault("topic", bank.get("subject"))
            it.setdefault("difficulty", "np")
            if it["type"] in (None,"","mc","bar-max","bar-compare"):
                fix_mc(it)
            it.setdefault("hint", it.get("explain") or "Titta noga på frågan och alternativen.")
            it.setdefault("explain", it.get("hint"))
            # DnD: normalisera tokens → tiles
            if it["type"] == "dnd":
                if "tiles" not in it and "tokens" in it:
                    it["tiles"] = it["tokens"]
                if "buckets" not in it:
                    it["buckets"] = [{"label":"A"},{"label":"B"}]
                if "solution" not in it:
                    # skapa neutral lösning (alla i första bucket) om saknas
                    sol = {}
                    for w in it.get("tiles", []):
                        sol[w] = it["buckets"][0]["label"]
                    it["solution"] = sol

    if "passages" in bank:
        for p in bank["passages"]:
            for q in p.get("questions", []):
                q.setdefault("topic", bank.get("subject"))
                q.setdefault("difficulty", "np")
                fix_mc(q)
                q.setdefault("hint", "Läs texten noga och matcha nyckelord.")
                q.setdefault("explain", "Läs texten noga och matcha nyckelord.")

# -------------------- main --------------------

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--subject", required=True, choices=["svenska","matematik"])
    ap.add_argument("--grade", type=int, default=3)
    ap.add_argument("--bank-id", required=True, help="Unikt id i index.json, t.ex. sv-ak3")
    ap.add_argument("--label", required=True, help="Visningsnamn, t.ex. 'Svenska åk 3'")
    ap.add_argument("--desc", default="", help="Kort beskrivning")
    ap.add_argument("--level", choices=["easy","np","hard"], default="np")
    ap.add_argument("--items", type=int, default=120, help="Antal MC/vanliga frågor")
    # svenska
    ap.add_argument("--dnd", type=int, default=8, help="Antal drag&drop (svenska)")
    ap.add_argument("--passages", type=int, default=6, help="Antal läsförståelse-passager (svenska)")
    # matte
    ap.add_argument("--diagrams", type=int, default=16, help="Antal diagramfrågor (matematik)")
    ap.add_argument("--retune-division", choices=["yes","no"], default="yes")
    ap.add_argument("--max-dividend", type=int, default=50)
    ap.add_argument("--allow-nine", choices=["yes","no"], default="no")
    # uniqueness
    ap.add_argument("--unique-guard", choices=["yes","no"], default="yes")
    ap.add_argument("--min-diff", type=float, default=0.72, help="Jaccard-tröskel 0..1 (högre = mer strikt)")
    # allmänt
    ap.add_argument("--seed", type=int, default=None)
    ap.add_argument("--out", required=True)
    ap.add_argument("--update-index", action="store_true")
    args = ap.parse_args()

    if args.seed is not None:
        RNG.seed(args.seed)

    profile = profile_for_level(args.level)
    # sätt global tröskel för anti-repetition från CLI
    global _MIN_DIFF
    _MIN_DIFF = args.min_diff
    # överstyr matte-hårda parametrar från CLI
    profile["div_max_dividend"] = min(profile["div_max_dividend"], args.max_dividend)
    profile["allow_nine"] = (args.allow_nine == "yes")

    if args.subject == "svenska":
        bank = build_svenska(profile, args.items, args.dnd, args.passages)
    else:
        bank = build_matematik(profile, args.items, args.diagrams)

    bank["bankVersion"] = "1.0"
    # För konsekvent form (single-subject bank)
    bank = {"subject": args.subject, **bank}

    # backfill säkerhet
    backfill(bank)

    out = (PROJECT_ROOT / args.out) if not os.path.isabs(args.out) else Path(args.out)
    write_json(out, bank)

    if args.update_index:
        # index vill ha path relativt /public/banks
        try:
            rel = str(out.relative_to(BANKS_DIR))
        except Exception:
            # försök hitta en /public/banks/…-del i pathen
            p = str(out)
            ix = p.rfind("/public/banks/")
            rel = p[ix+len("/public/banks/"):] if ix!=-1 else out.name
        update_index(args.bank_id, args.label, rel, args.subject, args.grade, args.desc)

    print("✅ Ny bank skapad:")
    print(f"  • Subject: {args.subject}")
    print(f"  • Label:   {args.label}")
    print(f"  • File:    {out}")
    if args.update_index:
        print(f"  • index.json uppdaterad med id '{args.bank_id}' → path '{rel}'")
    print("Tips: kör generators/verify_banks.py för att dubbelkolla banken.")
if __name__ == "__main__":
    main()