#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Skapar/uppdaterar public/banks/matematik.json med slumpade frågor.
Varje fråga får: area, q, options, correct samt hint (pedagogisk strategi utan att avslöja svaret).

Exempel:
python3 generators/make_matematik_bank.py \
  --out public/banks/matematik.json \
  --items 200 --level medium --seed 123

Valfri plan (fördelning per område), summera till items:
--plan "addition=40,subtraktion=40,multiplikation=30,division=30,taluppfattning=30,geometri=10,klockan=10,mätning=10,problem=0"
"""
import json, random, re, argparse
from pathlib import Path
from typing import List, Dict, Tuple

AREAS = [
    "addition","subtraktion","multiplikation","division",
    "taluppfattning","geometri","klockan","mätning","problem"
]

def parse_plan(plan: str, total: int) -> Dict[str,int]:
    if not plan:
        # enkel default-fördelning
        base = {
            "addition": total//6,
            "subtraktion": total//6,
            "multiplikation": total//6,
            "division": total//6,
            "taluppfattning": total//8,
            "geometri": total//12,
            "klockan": total//12,
            "mätning": total//12,
            "problem": total - (total//6)*4 - (total//8) - 3*(total//12)
        }
        # säkerställ >=0
        for k in base: base[k] = max(0, base[k])
        return base
    out = {k:0 for k in AREAS}
    total_assigned = 0
    for part in plan.split(","):
        if not part.strip(): continue
        k,v = part.split("=")
        k = k.strip()
        v = int(v.strip())
        if k not in out: continue
        out[k] = v
        total_assigned += v
    # om summa inte matchar total, fyll på addition
    if total_assigned < total:
        out["addition"] += total - total_assigned
    return out

# ---- Utilities for options ---------------------------------------------------

def unique_options_with_correct(correct_text: str, pool: List[str], n=4) -> Tuple[List[str], int]:
    opts = [correct_text]
    for p in pool:
        if p == correct_text: continue
        if p not in opts:
            opts.append(p)
        if len(opts) == n: break
    # om för få distraktorer, fyll med generiska
    i = 0
    while len(opts) < n and i < 50:
        i += 1
        cand = str(random.randint(0, 99))
        if cand not in opts:
            opts.append(cand)
    random.shuffle(opts)
    return opts, opts.index(correct_text)

def shuffle_options_with_correct(opts: List[str], correct_index: int) -> Tuple[List[str], int]:
    # kopia
    arr = list(opts)
    correct_val = arr[correct_index]
    random.shuffle(arr)
    return arr, arr.index(correct_val)

# ---- Strategy helpers (ascii “bilder”) --------------------------------------

def hoppar(start: int, steg: int, antal: int) -> str:
    out = f"{start}"
    cur = start
    for _ in range(max(0,antal)):
        cur += steg
        out += f" ──➜ {cur}"
    return out

def tallinje(start: int, slut: int, steg: int) -> str:
    if steg == 0: steg = 1
    asc = start <= slut
    dir = 1 if asc else -1
    cur = start
    pts = [cur]
    limit = 12
    while (asc and cur < slut) or ((not asc) and cur > slut):
        cur += dir*abs(steg)
        pts.append(cur)
        limit -= 1
        if limit <= 0: break
    return "  →  ".join(map(str, pts))

# ---- Build math strategy (no answer reveal) ----------------------------------

def build_math_strategy(area: str, prompt: str) -> str:
    txt = prompt.lower()
    nums = list(map(int, re.findall(r"-?\d+", txt)))
    a = nums[0] if len(nums) > 0 else None
    b = nums[1] if len(nums) > 1 else None

    ar = area.lower()

    if "addition" in ar:
        if a is not None and b is not None:
            big, small = max(a,b), min(a,b)
            till_tio = (10 - (big % 10)) % 10
            if till_tio and till_tio <= small:
                return (
f"🎯 Gör en tia:\n"
f"• {big} + {till_tio} = {big + till_tio} (jämn tia)\n"
f"• Lägg på resten: {small - till_tio}\n"
f"🧠 Huvudräkning blir lätt med 10/20/30.\n\n"
f"{hoppar(big, till_tio, 1)} ──➜ {big + till_tio}  … + {small - till_tio}"
                )
            return (
f"🎯 Räkna från det större talet:\n"
f"• Börja på {big} och hoppa {small} steg (t.ex. 5-steg + 1-steg).\n"
f"{hoppar(big, 1, min(small,5))}{' …' if small>5 else ''}"
            )
        return "🎯 Sikta på tiotal först. Gör 10/20/30 och lägg på resten."

    if "subtraktion" in ar:
        if a is not None and b is not None:
            ner_till_tia = a % 10
            if ner_till_tia and (b > ner_till_tia):
                return (
f"🎯 Dela upp till närmaste tia:\n"
f"• {a} → {a - ner_till_tia} (ner {ner_till_tia} till jämn tia)\n"
f"• Ta resten: {b - ner_till_tia}\n"
f"{tallinje(a, a - b, ner_till_tia)}{'  →  ' + str(a - b) if (b - ner_till_tia) else ''}"
                )
            return (
f"🎯 Räkna upp: börja vid {a - b} och hoppa till {a}.\n"
f"• Summan av hoppen = skillnaden.\n"
f"{tallinje(a - b, a, 1)}"
            )
        return "🎯 Antingen ner till jämn tia först, eller räkna upp från det mindre talet."

    if "multiplikation" in ar:
        if a is not None and b is not None:
            if a == 9 or b == 9:
                n = b if a == 9 else a
                return (
f"🎯 9-knepet: 10×{n} − {n}\n"
f"• 10×{n} = {10*n}\n"
f"• {10*n} − {n} = …"
                )
            if a == 4 or b == 4:
                n = b if a == 4 else a
                return (
f"🎯 Dubbla-dubbla (4×{n}):\n"
f"• Dubbla {n} → {n*2}\n"
f"• Dubbla igen → …"
                )
            if a == 8 or b == 8:
                n = b if a == 8 else a
                return (
f"🎯 Dubbla tre gånger (8×{n}):\n"
f"• {n} → {n*2} → {n*4} → …"
                )
            if a == 5 or b == 5:
                n = b if a == 5 else a
                return (
f"🎯 5-steg:\n"
f"• Räkna {n} femmor: 5, 10, 15, …\n"
f"{hoppar(0, 5, min(n,6))}{' …' if n>6 else ''}"
                )
            return "🎯 Bryt upp: n×m = n×(m−1) + n. Använd ×10 eller ×5 som ankare och justera."
        return "🎯 Upprepad addition eller bryt mot 10: n×m = n×10 − n×(10−m)."

    if "division" in ar:
        if a is not None and b is not None and b != 0:
            return (
f"🎯 Multiplikation baklänges:\n"
f"• Hur många {b}:or ryms i {a}?\n"
f"• Sök i {b}-tabellen nära {a} och justera.\n"
f"{tallinje(0, a, b)}"
            )
        return "🎯 Division är “hur många grupper?”. Använd en tabell du kan och närma dig."

    if "taluppfattning" in ar:
        if "tiotal" in txt and a is not None:
            return (
f"🎯 Dela upp i tiotal och ental:\n"
f"• {a} = {a//10} tiotal och {a%10} ental."
            )
        if "störst" in txt:
            return "🎯 Jämför först tiotalen. Om lika – jämför entalen."
        return "🎯 Dela upp tal i tiotal/ental. Resonera på tiotal först."

    if "klockan" in ar:
        if "halv" in txt:
            return "🎯 “Halv tre” = 30 min innan tre → klockan har passerat två: …:30 (02:30/14:30)."
        if "kvart" in txt:
            return "🎯 Kvart = 15 min. “Kvart över X” = X:15, “kvart i X” = (X−1):45."
        return "🎯 Tänk i 60 minuter/varv. Halv = :30, kvart = :15 eller :45."

    if "mätning" in ar:
        return "🎯 Prefix: 1 m = 100 cm, 1 km = 1000 m, 1 kg = 1000 g. Flytta decimalen enligt prefixet."

    if "geometri" in ar:
        if "hörn" in txt:
            return "🎯 Räkna hörnen ett i taget. Kvadrat har 4 hörn och 4 lika sidor."
        return "🎯 Titta på antal sidor/hörn och om sidorna är lika långa."

    if "problem" in ar or "har " in txt or "får " in txt:
        return "🎯 Skriv en mini-ekvation: start ± förändring = svar. Rita hoppen på tallinjen i huvudet."

    return "🎯 Dela upp i enkla steg: sikta på 10/100, använd dubbla/halvera, kontrollera med överslag."

# ---- Generators per area -----------------------------------------------------

def gen_addition() -> Dict:
    a = random.randint(3, 49)
    b = random.randint(3, 49)
    q = f"{a} + {b} ="
    correct = a + b
    # distraktorer nära
    pool = [str(correct + d) for d in [-2, -1, 1, 2, 10, -10] if correct + d >= 0]
    opts, ci = unique_options_with_correct(str(correct), pool)
    return {"area":"addition","q":q,"options":opts,"correct":ci}

def gen_subtraktion() -> Dict:
    a = random.randint(8, 99)
    b = random.randint(2, min(20, a-1))
    q = f"{a} − {b} ="
    correct = a - b
    pool = [str(correct + d) for d in [-2, -1, 1, 2, 10, -10] if correct + d >= 0]
    opts, ci = unique_options_with_correct(str(correct), pool)
    return {"area":"subtraktion","q":q,"options":opts,"correct":ci}

def gen_multiplikation() -> Dict:
    a = random.randint(2, 9)
    b = random.randint(2, 9)
    q = f"{a} × {b} ="
    correct = a * b
    pool = [str(correct + d) for d in [-2,-1,1,2,10,-10] if correct + d >= 0]
    opts, ci = unique_options_with_correct(str(correct), pool)
    return {"area":"multiplikation","q":q,"options":opts,"correct":ci}

def gen_division() -> Dict:
    b = random.randint(2, 9)
    mult = random.randint(2, 10)
    a = b * mult
    q = f"{a} ÷ {b} ="
    correct = mult
    pool = [str(correct + d) for d in [-2,-1,1,2] if correct + d > 0]
    opts, ci = unique_options_with_correct(str(correct), pool)
    return {"area":"division","q":q,"options":opts,"correct":ci}

def gen_taluppfattning() -> Dict:
    n = random.randint(11, 99)
    if random.random() < 0.5:
        q = f"Hur många tiotal i {n}?"
        correct_text = str(n // 10)
        pool = [str(n//10 + d) for d in [-1, 1, 2, -2] if n//10 + d >= 0]
    else:
        a, b = sorted(random.sample(range(30, 60), 2))
        q = "Vilket tal är störst?"
        correct_text = str(max(a,b))
        # övriga kandidater runt tal
        pool = [str(x) for x in [a,b,a-1,a+1,b-1,b+1] if str(x) != correct_text]
    opts, ci = unique_options_with_correct(correct_text, pool)
    return {"area":"taluppfattning","q":q,"options":opts,"correct":ci}

def gen_geometri() -> Dict:
    if random.random() < 0.5:
        q = "Hur många hörn har en kvadrat?"
        correct_text = "4"
        pool = ["2","3","5","6"]
    else:
        q = "Vilken figur har alla sidor lika långa?"
        correct_text = "Kvadrat"
        pool = ["Rektangel","Triangel","Romb"]
    opts, ci = unique_options_with_correct(correct_text, pool)
    return {"area":"geometri","q":q,"options":opts,"correct":ci}

def gen_klockan() -> Dict:
    if random.random() < 0.5:
        q = "Halv tre i digital tid:"
        correct_text = "02:30"
        pool = ["03:30","15:30","14:30"]
    else:
        q = "Kvart i fem i digital tid:"
        correct_text = "16:45"
        pool = ["05:15","17:15","17:45"]
    opts, ci = unique_options_with_correct(correct_text, pool)
    return {"area":"klockan","q":q,"options":opts,"correct":ci}

def gen_mätning() -> Dict:
    if random.random() < 0.5:
        q = "1 meter = ___ cm"
        correct_text = "100"
        pool = ["10","50","1000"]
    else:
        q = "1 kg = ___ g"
        correct_text = "1000"
        pool = ["100","10","500"]
    opts, ci = unique_options_with_correct(correct_text, pool)
    return {"area":"mätning","q":q,"options":opts,"correct":ci}

def gen_problem() -> Dict:
    a = random.randint(5, 20)
    b = random.randint(3, 15)
    if random.random() < 0.5:
        q = f"Lisa har {a} kulor och får {b} till. Hur många har hon?"
        correct = a + b
    else:
        q = f"Ali har {a} äpplen och ger bort {b}. Hur många har han kvar?"
        correct = a - b
    pool = [str(correct + d) for d in [-2, -1, 1, 2, 5] if correct + d >= 0]
    opts, ci = unique_options_with_correct(str(correct), pool)
    return {"area":"problem","q":q,"options":opts,"correct":ci}

GEN_BY_AREA = {
    "addition": gen_addition,
    "subtraktion": gen_subtraktion,
    "multiplikation": gen_multiplikation,
    "division": gen_division,
    "taluppfattning": gen_taluppfattning,
    "geometri": gen_geometri,
    "klockan": gen_klockan,
    "mätning": gen_mätning,
    "problem": gen_problem
}

# ---- IO helpers --------------------------------------------------------------

def read_existing(path: Path) -> dict:
    if not path.exists(): 
        return {"bankVersion":"1.0","matematik":{"items":[]}}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        data = {}
    if "bankVersion" not in data: data["bankVersion"] = "1.0"
    if "matematik" not in data: data["matematik"] = {"items":[]}
    if "items" not in data["matematik"]: data["matematik"]["items"] = []
    return data

def next_id(items: List[dict]) -> int:
    mx = 0
    for it in items:
        m = re.match(r"ma-(\d+)", it.get("id",""))
        if m:
            mx = max(mx, int(m.group(1)))
    return mx + 1

# ---- Main --------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True, help="Sökväg till matematik.json")
    ap.add_argument("--items", type=int, default=200, help="Antal nya frågor att skapa")
    ap.add_argument("--plan", type=str, default="", help="Fördelning, t.ex. \"addition=40,subtraktion=40,...\"")
    ap.add_argument("--seed", type=int, default=None)
    ap.add_argument("--replace", action="store_true", help="Skriv över items helt (annars append)")
    args = ap.parse_args()

    if args.seed is not None:
        random.seed(args.seed)

    out = Path(args.out)
    data = read_existing(out)
    items = data["matematik"]["items"]

    if args.replace:
        items = []

    # fördelning
    plan = parse_plan(args.plan, args.items)

    # räkna nästa id
    nid = next_id(items)

    created = []
    for area, count in plan.items():
        gen = GEN_BY_AREA.get(area)
        if not gen or count <= 0: continue
        for _ in range(count):
            q = gen()
            # id + hint
            q["id"] = f"ma-{nid:03d}"
            nid += 1
            # hint/strategi (utan att avslöja svaret)
            q["hint"] = build_math_strategy(q["area"], q["q"])
            # (valfritt) lägg explain = hint så du får samma i review
            q["explain"] = q["hint"]
            created.append(q)

    items.extend(created)
    data["matematik"]["items"] = items

    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"✅ Klart! La till {len(created)} frågor i {out}")
    print(f"Nästa lediga id blir: ma-{nid:03d}")

if __name__ == "__main__":
    main()