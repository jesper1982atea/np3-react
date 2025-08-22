#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Generator för NP åk 3 - Matematikfrågor (JSON)
Läser/uppdaterar public/banks/matematik.json i samma format som appen.

Om filen saknas skapas en ny bank med "bankVersion": "1.0" och "items": [].
"""

import json, random, re, argparse
from pathlib import Path
from typing import List, Dict, Tuple, Callable

AREAS = [
    "taluppfattning","addition","subtraktion","multiplikation","division",
    "geometri","klockan","mätning","problem"
]

# --------- Hjälpfunktioner ---------
def load_bank(path: Path) -> Dict:
    if not path.exists():
        return {"bankVersion":"1.0", "matematik":{"items":[]}}
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)

def next_id(existing_items: List[Dict]) -> int:
    """Returnera nästa löpnummer för 'ma-XXX'."""
    mx = 0
    for it in existing_items:
        m = re.match(r"ma-(\d+)$", it.get("id",""))
        if m:
            mx = max(mx, int(m.group(1)))
    return mx + 1

def add_item(items: List[Dict], item: Dict, seen: set) -> bool:
    """Lägg till om unik (q + options i given ordning). Returnerar True om tillagd."""
    sig = (item["q"], tuple(item["options"]))
    if sig in seen:  # identisk fråga redan finns
        return False
    seen.add(sig)
    items.append(item)
    return True

def fmt_time(h: int, m: int) -> str:
    return f"{str(h).zfill(2)}:{str(m).zfill(2)}"

def shuffle_options_with_correct(options: List[str], correct_index: int) -> Tuple[List[str], int]:
    """Blanda alternativen men bibehåll vilket index som är korrekt efter blandning."""
    paired = list(enumerate(options))
    random.shuffle(paired)
    new_options = [opt for _, opt in paired]
    # hitta nya index för gamla correct_index
    new_correct = [i for i,(old_i, _) in enumerate(paired) if old_i == correct_index][0]
    return new_options, new_correct

# --------- Generators per area ---------
def gen_addition() -> Tuple[str, List[str], int]:
    a = random.randint(6, 49)
    b = random.randint(6, 49)
    ans = a + b
    distractors = {ans + d for d in (-2, -1, +1, +2)}
    distractors = [str(x) for x in distractors if x >= 0 and x != ans]
    options = [str(ans)] + distractors[:3]
    while len(options) < 4:
        options.append(str(ans + random.choice([-3,-2,-1,1,2,3])))
    q = f"{a} + {b} ="
    options, correct = shuffle_options_with_correct(options, 0)
    return q, options, correct

def gen_subtraktion() -> Tuple[str, List[str], int]:
    a = random.randint(12, 99)
    b = random.randint(1, a-1)
    ans = a - b
    distractors = {ans + d for d in (-2, -1, +1, +2)}
    distractors = [str(x) for x in distractors if x >= 0 and x != ans]
    options = [str(ans)] + distractors[:3]
    while len(options) < 4:
        options.append(str(ans + random.choice([-3,-2,-1,1,2,3])))
    q = f"{a} − {b} ="
    options, correct = shuffle_options_with_correct(options, 0)
    return q, options, correct

def gen_multiplikation() -> Tuple[str, List[str], int]:
    a = random.randint(2, 10)
    b = random.randint(2, 10)
    ans = a * b
    distractors = {ans + d for d in (-2, -1, +1, +2)}
    distractors = [str(x) for x in distractors if x >= 0 and x != ans]
    options = [str(ans)] + distractors[:3]
    while len(options) < 4:
        options.append(str(ans + random.choice([-4,-3,-2,2,3,4])))
    q = f"{a} × {b} ="
    options, correct = shuffle_options_with_correct(options, 0)
    return q, options, correct

def gen_division() -> Tuple[str, List[str], int]:
    # säkerställ heltalskvot
    b = random.randint(2, 10)
    qv = random.randint(2, 10)
    a = b * qv
    ans = qv
    distractors = [str(qv + d) for d in (-2,-1,1,2) if qv + d > 0]
    options = [str(ans)] + distractors[:3]
    while len(options) < 4:
        extra = qv + random.choice([-3,-2,-1,1,2,3])
        if extra > 0:
            options.append(str(extra))
    q = f"{a} ÷ {b} ="
    options, correct = shuffle_options_with_correct(options, 0)
    return q, options, correct

def gen_taluppfattning() -> Tuple[str, List[str], int]:
    mode = random.choice(["störst","minst","efter","före","udda","jämnt","tiotal"])
    if mode in ("störst","minst"):
        nums = random.sample(range(20, 99), 4)
        if mode == "störst":
            correct_val = max(nums)
            q = "Vilket tal är störst?"
        else:
            correct_val = min(nums)
            q = "Vilket tal är minst?"
        options = [str(n) for n in nums]
        correct = options.index(str(correct_val))
        return q, options, correct
    elif mode == "efter":
        n = random.randint(10, 98)
        q = f"Vilket tal kommer efter {n}?"
        correct_val = n+1
        options = [str(correct_val), str(n-1), str(n+2), str(n+10)]
        options, correct = shuffle_options_with_correct(options, 0)
        return q, options, correct
    elif mode == "före":
        n = random.randint(11, 99)
        q = f"Vilket tal kommer före {n}?"
        correct_val = n-1
        options = [str(correct_val), str(n-2), str(n+1), str(n-10 if n>=20 else n+10)]
        options, correct = shuffle_options_with_correct(options, 0)
        return q, options, correct
    elif mode == "udda":
        nums = []
        while len(nums) < 4:
            x = random.randint(10, 99)
            if x not in nums:
                nums.append(x)
        odd_candidates = [x for x in nums if x % 2 == 1]
        if not odd_candidates:
            nums[0] += 1
            odd_candidates = [nums[0]]
        correct_val = odd_candidates[0]
        q = "Vilket tal är udda?"
        options = [str(n) for n in nums]
        correct = options.index(str(correct_val))
        return q, options, correct
    elif mode == "jämnt":
        nums = []
        while len(nums) < 4:
            x = random.randint(10, 99)
            if x not in nums:
                nums.append(x)
        even_candidates = [x for x in nums if x % 2 == 0]
        if not even_candidates:
            nums[0] += 1
            even_candidates = [nums[0]]
        correct_val = even_candidates[0]
        q = "Vilket tal är jämnt?"
        options = [str(n) for n in nums]
        correct = options.index(str(correct_val))
        return q, options, correct
    else:  # tiotal
        n = random.randint(10, 99)
        q = f"Hur många tiotal i {n}?"
        correct_val = n // 10
        options = [str(correct_val), str(correct_val-1), str(correct_val+1), str(n)]
        options, correct = shuffle_options_with_correct(options, 0)
        return q, options, correct

def gen_geometri() -> Tuple[str, List[str], int]:
    pool = [
        ("Hur många hörn har en kvadrat?", ["2","3","4","5"], 2),
        ("Hur många sidor har en triangel?", ["2","3","4","5"], 1),
        ("En rektangel har …", ["fyra lika sidor","motstående sidor lika","tre sidor","sex sidor"], 1),
        ("En cirkel har …", ["hörn","sidor","en rund kant","fyra kanter"], 2),
        ("En sexhörning (hexagon) har … sidor", ["5","6","7","8"], 1),
        ("En kub är en …", ["2D-figur","3D-figur","linje","vinkel"], 1),
        ("En cylinder har baser som är …", ["trianglar","rektanglar","cirklar","kvadrater"], 2),
    ]
    q, options, correct = random.choice(pool)
    # blanda alternativen men bevara rätt index
    options, correct = shuffle_options_with_correct(options, correct)
    return q, options, correct

def gen_klockan() -> Tuple[str, List[str], int]:
    # generera hel, halv, kvart över/i
    h = random.randint(0,23)
    mode = random.choice(["prick","halv","kvart_over","kvart_i"])
    if mode == "prick":
        m = 0
        text = f"{h:02d}:{m:02d}"
        sv = f"Prick {h if h<=12 else h-12}"
        # distraktorer
        d = [
            f"Halv {h if h<=12 else h-12}",
            f"Kvart över {h if h<=12 else h-12}",
            f"Kvart i {(h+1) if (h+1)<=12 else (h+1-12)}"
        ]
    elif mode == "halv":
        m = 30
        text = f"{h:02d}:{m:02d}"
        sv = f"Halv {(h+1) if (h+1)<=12 else (h+1-12)}"
        d = [
            f"Halv {h if h<=12 else h-12}",
            f"Kvart över {h if h<=12 else h-12}",
            f"Kvart i {(h+1) if (h+1)<=12 else (h+1-12)}"
        ]
    elif mode == "kvart_over":
        m = 15
        text = f"{h:02d}:{m:02d}"
        sv = f"Kvart över {h if h<=12 else h-12}"
        d = [
            f"Kvart i {(h+1) if (h+1)<=12 else (h+1-12)}",
            f"Halv {(h+1) if (h+1)<=12 else (h+1-12)}",
            f"Prick {h if h<=12 else h-12}"
        ]
    else:  # kvart_i
        m = 45
        text = f"{h:02d}:{m:02d}"
        sv = f"Kvart i {(h+1) if (h+1)<=12 else (h+1-12)}"
        d = [
            f"Kvart över {h if h<=12 else h-12}",
            f"Halv {(h+1) if (h+1)<=12 else (h+1-12)}",
            f"Prick {h if h<=12 else h-12}"
        ]
    options = [sv] + d
    q = f"{text} kallas:"
    options, correct = shuffle_options_with_correct(options, 0)
    return q, options, correct

def gen_mätning() -> Tuple[str, List[str], int]:
    mode = random.choice(["cm_m","kg_g","l_dl","dl_cl","minuter"])
    if mode == "cm_m":
        q = "1 meter = ___ cm"
        options = ["10","50","100","1000"]; correct = 2
    elif mode == "kg_g":
        q = "1 kg = ___ g"
        options = ["10","100","500","1000"]; correct = 3
    elif mode == "l_dl":
        q = "1 liter = ___ dl"
        options = ["5","10","50","100"]; correct = 1
    elif mode == "dl_cl":
        q = "1 dl = ___ cl"
        options = ["5","10","20","100"]; correct = 2
    else:
        q = "Hur många minuter är en kvart?"
        options = ["10","15","20","30"]; correct = 1
    # blanda
    options, correct = shuffle_options_with_correct(options, correct)
    return q, options, correct

def gen_problem() -> Tuple[str, List[str], int]:
    mode = random.choice(["pengar","bullar","kulor","dagar","buss"])
    if mode == "pengar":
        pris = random.choice([12,15,18,20,25,30,35])
        antal = random.choice([2,3])
        tot = pris*antal
        q = f"Ett paket kostar {pris} kr. Du köper {antal} paket. Vad kostar det?"
        options = [str(tot), str(tot-2), str(tot+2), str(tot+5)]
        options, correct = shuffle_options_with_correct(options, 0)
        return q, options, correct
    if mode == "bullar":
        start = random.randint(15,30)
        eaten = random.randint(5,12)
        ans = start - eaten
        q = f"Du bakar {start} bullar. {eaten} äts upp. Hur många kvar?"
        options = [str(ans), str(ans-1), str(ans+1), str(ans+3)]
        options, correct = shuffle_options_with_correct(options, 0)
        return q, options, correct
    if mode == "kulor":
        påsar = random.randint(2,5)
        per = random.randint(3,6)
        ans = påsar*per
        q = f"Du har {påsar} påsar med {per} kulor i varje. Hur många kulor?"
        options = [str(ans), str(ans-2), str(ans+2), str(ans+5)]
        options, correct = shuffle_options_with_correct(options, 0)
        return q, options, correct
    if mode == "dagar":
        per = random.choice([5,10,12])
        dagar = random.randint(3,7)
        ans = per*dagar
        q = f"Du sparar {per} kr per dag i {dagar} dagar. Hur mycket blir det?"
        options = [str(ans), str(ans-5), str(ans+5), str(ans+10)]
        options, correct = shuffle_options_with_correct(options, 0)
        return q, options, correct
    if mode == "buss":
        ombord = random.randint(20,40)
        av = random.randint(5, ombord-1)
        ans = ombord - av
        q = f"Bussen har {ombord} passagerare. {av} går av. Hur många kvar?"
        options = [str(ans), str(ans-1), str(ans+1), str(ans+3)]
        options, correct = shuffle_options_with_correct(options, 0)
        return q, options, correct

# Map area -> generator-funktion
GEN_BY_AREA: Dict[str, Callable[[], Tuple[str,List[str],int]]] = {
    "addition": gen_addition,
    "subtraktion": gen_subtraktion,
    "multiplikation": gen_multiplikation,
    "division": gen_division,
    "taluppfattning": gen_taluppfattning,
    "geometri": gen_geometri,
    "klockan": gen_klockan,
    "mätning": gen_mätning,
    "problem": gen_problem,
}

# --------- CLI & logik ---------
def parse_plan(plan: str) -> Dict[str, int]:
    """
    Ex: "addition=20,subtraktion=20,problem=10"
    """
    out = {}
    for part in plan.split(","):
        part = part.strip()
        if not part: continue
        if "=" not in part:
            raise ValueError(f"Ogiltig plan-del: {part}")
        k,v = part.split("=",1)
        k = k.strip()
        v = int(v.strip())
        if k not in AREAS:
            raise ValueError(f"Okänt område i plan: {k}")
        out[k] = v
    return out

def main():
    ap = argparse.ArgumentParser(description="Generera mattefrågor till matematik.json")
    ap.add_argument("--out", required=True, help="Sökväg till public/banks/matematik.json")
    ap.add_argument("--count", type=int, default=100, help="Totalt antal att generera (ignoreras om --plan anges)")
    ap.add_argument("--plan", type=str, default="", help="Fördela per område, t.ex. 'addition=20,subtraktion=20,...'")
    ap.add_argument("--seed", type=int, default=None, help="Slump-seed (för reproducerbarhet)")
    ap.add_argument("--dry", action="store_true", help="Torrkörning (skriv inte fil)")
    args = ap.parse_args()

    if args.seed is not None:
        random.seed(args.seed)

    project_root = Path(__file__).resolve().parent.parent
    out_path = (Path(args.out) if Path(args.out).is_absolute() else (project_root / args.out)).resolve()
    print(f"🗂️  Målfil: {out_path}")
    bank = load_bank(out_path)
    items = bank.get("matematik",{}).get("items", [])
    if "matematik" not in bank:
        bank["matematik"] = {"items": items}

    start_num = next_id(items)
    seen = set((it["q"], tuple(it["options"])) for it in items if "q" in it and "options" in it)

    # bestäm fördelning
    plan = {}
    if args.plan:
        plan = parse_plan(args.plan)
    else:
        # default: fördela jämnt över områden (med lite bias till räknesätten)
        base = args.count // len(AREAS)
        plan = {a: base for a in AREAS}
        leftover = args.count - base*len(AREAS)
        order = ["addition","subtraktion","multiplikation","division","taluppfattning","problem","geometri","klockan","mätning"]
        for a in order:
            if leftover <= 0: break
            plan[a] += 1
            leftover -= 1

    # generera
    created = []
    n_id = start_num
    for area, n in plan.items():
        gen = GEN_BY_AREA[area]
        tries = 0
        made = 0
        while made < n and tries < n*20:  # skydd mot oändlig loop
            tries += 1
            q, options, correct = gen()
            itm = {
                "id": f"ma-{n_id:03d}",
                "area": area,
                "q": q,
                "options": options,
                "correct": int(correct)
            }
            if add_item(created, itm, seen):
                n_id += 1
                made += 1

    if args.dry:
        print(json.dumps({"generated": created}, ensure_ascii=False, indent=2))
        return

    # spara tillbaka
    items.extend(created)
    bank["matematik"]["items"] = items
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", encoding="utf-8") as f:
        json.dump(bank, f, ensure_ascii=False, indent=2)
    print(f"✅ Klart! La till {len(created)} nya frågor i {out_path}")
    print(f"Nästa lediga id blir: ma-{n_id:03d}")

if __name__ == "__main__":
    main()