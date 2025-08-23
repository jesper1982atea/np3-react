#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Genererar/uppdaterar public/banks/matematik.json.

Nytt: NP-lika uppgifter
- table-fill: fyll i tomma rutor i en tabell (t.ex. hopp-längder)
- pie-assign: matcha andelar i cirkeldiagram med etiketter
- chance-matrix: sant/falskt utifrån sannolikhet (antal av färger/utfall)

Exempel:
python3 generators/make_matematik_bank.py \
  --out public/banks/matematik.json \
  --items 160 --table 6 --pie 4 --chance 6 --seed 42

Byt ut items helt:
  ... --replace

Behåll gammal fördelning på MC-frågor men lägg till NP-uppgifter:
  --plan "addition=30,subtraktion=30,multiplikation=30,division=30,taluppfattning=20,geometri=10,klockan=5,mätning=5,problem=0"
"""
import json, random, re, argparse
from pathlib import Path
from typing import List, Dict, Tuple

AREAS = [
    "addition","subtraktion","multiplikation","division",
    "taluppfattning","geometri","klockan","mätning","problem"
]

# ------------------------- Plan / IO helpers -------------------------

def parse_plan(plan: str, total: int) -> Dict[str,int]:
    if not plan:
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
    if total_assigned < total:
        out["addition"] += total - total_assigned
    return out

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

# ------------------------- Option utils -------------------------

def unique_options_with_correct(correct_text: str, pool: List[str], n=4) -> Tuple[List[str], int]:
    opts = [correct_text]
    for p in pool:
        if p == correct_text: continue
        if p not in opts:
            opts.append(p)
        if len(opts) == n: break
    i = 0
    while len(opts) < n and i < 50:
        i += 1
        cand = str(random.randint(0, 99))
        if cand not in opts:
            opts.append(cand)
    random.shuffle(opts)
    return opts, opts.index(correct_text)

# ------------------------- Strategy helpers -------------------------

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
f"🎯 Gör en tia:\n• {big} + {till_tio} = {big + till_tio}\n• Lägg på resten: {small - till_tio}\n{hoppar(big, till_tio, 1)} ──➜ {big + till_tio}  … + {small - till_tio}"
                )
            return (f"🎯 Räkna från det större talet:\n• Börja på {big} och hoppa {small} steg.\n"
                    f"{hoppar(big, 1, min(small,6))}{' …' if small>6 else ''}")
        return "🎯 Sikta på tiotal först. Gör 10/20/30 och lägg på resten."

    if "subtraktion" in ar:
        if a is not None and b is not None:
            ner_till_tia = a % 10
            if ner_till_tia and (b > ner_till_tia):
                return (f"🎯 Dela upp till närmaste tia:\n• {a} → {a - ner_till_tia}\n• Ta resten: {b - ner_till_tia}\n"
                        f"{tallinje(a, a - b, ner_till_tia)}{'  →  ' + str(a - b) if (b - ner_till_tia) else ''}")
            return (f"🎯 Räkna upp: börja vid {a - b} och hoppa till {a}.\n{tallinje(a - b, a, 1)}")
        return "🎯 Antingen ner till jämn tia först, eller räkna upp från det mindre."

    if "multiplikation" in ar:
        if a is not None and b is not None:
            if a == 9 or b == 9:
                n = b if a == 9 else a
                return (f"🎯 9-knepet: 10×{n} − {n}\n• 10×{n} = {10*n}\n• {10*n} − {n} = …")
            if a == 4 or b == 4:
                n = b if a == 4 else a
                return (f"🎯 Dubbla-dubbla (4×{n}):\n• Dubbla {n} → {n*2}\n• Dubbla igen → …")
            if a == 8 or b == 8:
                n = b if a == 8 else a
                return (f"🎯 Dubbla tre gånger (8×{n}):\n• {n} → {n*2} → {n*4} → …")
            if a == 5 or b == 5:
                n = b if a == 5 else a
                return (f"🎯 5-steg:\n• Räkna {n} femmor: 5, 10, 15, …\n{hoppar(0,5,min(n,6))}{' …' if n>6 else ''}")
            return "🎯 Bryt upp: n×m = n×(m−1) + n. Använd ×10 eller ×5 som ankare."
        return "🎯 Upprepad addition eller bryt mot 10: n×m = n×10 − n×(10−m)."

    if "division" in ar:
        if a is not None and b not in (None,0):
            return (f"🎯 Multiplikation baklänges:\n• Hur många {b}:or ryms i {a}?\n{tallinje(0, a, b)}")
        return "🎯 “Hur många grupper?”. Använd en tabell du kan och närma dig."

    if "taluppfattning" in ar:
        if "tiotal" in txt and a is not None:
            return (f"🎯 Dela upp i tiotal/ental:\n• {a} = {a//10} tiotal och {a%10} ental.")
        if "störst" in txt:
            return "🎯 Jämför först tiotalen. Om lika – jämför entalen."
        return "🎯 Dela upp tal i tiotal/ental. Resonera på tiotal först."

    if "klockan" in ar:
        if "halv" in txt: return "🎯 “Halv tre” = 30 min innan tre → …:30."
        if "kvart" in txt: return "🎯 Kvart = 15 min. 'Kvart över X'=X:15, 'Kvart i X'=(X−1):45."
        return "🎯 60 min per varv. Halv = :30, kvart = :15 eller :45."

    if "mätning" in ar:
        return "🎯 Prefix: 1 m = 100 cm, 1 km = 1000 m, 1 kg = 1000 g."

    if "geometri" in ar:
        if "hörn" in txt: return "🎯 Räkna hörn. Kvadrat har 4 hörn och 4 lika sidor."
        return "🎯 Titta på antal sidor/hörn och om sidorna är lika långa."

    if "problem" in ar or "har " in txt or "får " in txt:
        return "🎯 Mini-ekvation: start ± förändring = svar. Rita hoppen mentalt."

    return "🎯 Dela upp i enkla steg: sikta på 10/100, dubbla/halvera, överslag."

# ------------------------- MC generators (som tidigare) -------------------------

def gen_addition() -> Dict:
    a = random.randint(3, 49); b = random.randint(3, 49)
    q = f"{a} + {b} ="; correct = a + b
    pool = [str(correct + d) for d in [-10,-2,-1,1,2,10] if correct + d >= 0]
    opts, ci = unique_options_with_correct(str(correct), pool)
    return {"area":"addition","q":q,"options":opts,"correct":ci}

def gen_subtraktion() -> Dict:
    a = random.randint(8, 99); b = random.randint(2, min(20, a-1))
    q = f"{a} − {b} ="; correct = a - b
    pool = [str(correct + d) for d in [-10,-2,-1,1,2,10] if correct + d >= 0]
    opts, ci = unique_options_with_correct(str(correct), pool)
    return {"area":"subtraktion","q":q,"options":opts,"correct":ci}

def gen_multiplikation() -> Dict:
    a = random.randint(2, 9); b = random.randint(2, 9)
    q = f"{a} × {b} ="; correct = a * b
    pool = [str(correct + d) for d in [-10,-2,-1,1,2,10] if correct + d >= 0]
    opts, ci = unique_options_with_correct(str(correct), pool)
    return {"area":"multiplikation","q":q,"options":opts,"correct":ci}

def gen_division() -> Dict:
    b = random.randint(2, 9); mult = random.randint(2, 10); a = b * mult
    q = f"{a} ÷ {b} ="; correct = mult
    pool = [str(correct + d) for d in [-2,-1,1,2] if correct + d > 0]
    opts, ci = unique_options_with_correct(str(correct), pool)
    return {"area":"division","q":q,"options":opts,"correct":ci}

def gen_taluppfattning() -> Dict:
    n = random.randint(11, 99)
    if random.random() < 0.5:
        q = f"Hur många tiotal i {n}?"; correct_text = str(n // 10)
        pool = [str(n//10 + d) for d in [-1,1,2,-2] if n//10 + d >= 0]
    else:
        a, b = sorted(random.sample(range(30, 60), 2))
        q = "Vilket tal är störst?"; correct_text = str(max(a,b))
        pool = [str(x) for x in {a,b,a-1,a+1,b-1,b+1} if str(x) != correct_text]
    opts, ci = unique_options_with_correct(correct_text, pool)
    return {"area":"taluppfattning","q":q,"options":opts,"correct":ci}

def gen_geometri() -> Dict:
    if random.random() < 0.5:
        q = "Hur många hörn har en kvadrat?"; correct_text = "4"; pool = ["2","3","5","6"]
    else:
        q = "Vilken figur har alla sidor lika långa?"; correct_text = "Kvadrat"; pool = ["Rektangel","Triangel","Romb"]
    opts, ci = unique_options_with_correct(correct_text, pool)
    return {"area":"geometri","q":q,"options":opts,"correct":ci}

def gen_klockan() -> Dict:
    if random.random() < 0.5:
        q = "Halv tre i digital tid:"; correct_text = "02:30"; pool = ["03:30","15:30","14:30"]
    else:
        q = "Kvart i fem i digital tid:"; correct_text = "16:45"; pool = ["05:15","17:15","17:45"]
    opts, ci = unique_options_with_correct(correct_text, pool)
    return {"area":"klockan","q":q,"options":opts,"correct":ci}

def gen_mätning() -> Dict:
    if random.random() < 0.5:
        q = "1 meter = ___ cm"; correct_text = "100"; pool = ["10","50","1000"]
    else:
        q = "1 kg = ___ g"; correct_text = "1000"; pool = ["100","10","500"]
    opts, ci = unique_options_with_correct(correct_text, pool)
    return {"area":"mätning","q":q,"options":opts,"correct":ci}

def gen_problem() -> Dict:
    a = random.randint(5, 20); b = random.randint(3, 15)
    if random.random() < 0.5:
        q = f"Lisa har {a} kulor och får {b} till. Hur många har hon?"; correct = a + b
    else:
        q = f"Ali har {a} äpplen och ger bort {b}. Hur många har han kvar?"; correct = a - b
    pool = [str(correct + d) for d in [-2,-1,1,2,5] if correct + d >= 0]
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

# ------------------------- NP-uppgifter (nya typer) -------------------------

def gen_table_fill_np() -> Dict:
    """
    Skapar en liten tabell med 2–3 rader och 3 kolumner. Tomma rutor ska fyllas i.
    Svar anges i answers-dict { "Rad|Kolumn": "värde" }.
    """
    headers = ["Första", "Andra", "Tredje"]
    names = random.sample(["Vera","Gabriel","Ahmed","Maja","Omar","Sara"], k=3)
    # Skapa tre serier med monotont ökande tal (typ hopp-längder)
    base = random.randint(95, 160)
    incs = sorted(random.sample(range(3, 10), k=3))
    rows = []
    answers = {}
    for i, name in enumerate(names):
        a = base + random.randint(-8, 8) + i*random.randint(1,4)
        b = a + incs[i]
        c = b + random.randint(3, 8)
        cells = [str(a), str(b), str(c)]
        rows.append({"key": name, "cells": cells})

    # Välj 2–3 celler att göra tomma
    holes = []
    for r in rows:
        idx = random.choice([0,1,2])
        holes.append((r["key"], headers[idx], r["cells"][idx]))
        r["cells"][idx] = ""
    # ev. en extra hole:
    if random.random() < 0.5:
        r = random.choice(rows); idx = random.choice([0,1,2])
        if r["cells"][idx] != "":
            holes.append((r["key"], headers[idx], r["cells"][idx]))
            r["cells"][idx] = ""

    for key, col, val in holes:
        answers[f"{key}|{col}"] = str(val)

    q = "Fyll i de tomma rutorna."
    explain = "Titta rad för rad. Skillnaderna är små och relativt jämna mellan försöken."
    return {
        "topic":"matematik",
        "area":"tabell-diagram",
        "type":"table-fill",
        "q": q,
        "table": { "headers": headers, "rows": rows },
        "answers": answers,
        "hint": "Jämför inom samma rad. Leta efter jämna steg mellan försöken.",
        "explain": explain,
        "difficulty": "np"
    }

def gen_pie_assign_np() -> Dict:
    """
    Cirkeldiagram som andelar i procent. Eleven ska para ihop segment med etiketter.
    """
    # några färdiga procent-uppdelningar som summerar 100
    splits = [
        [50,25,25],
        [40,30,30],
        [20,30,50],
        [10,40,50],
        [60,20,20]
    ]
    perc = random.choice(splits)
    seg_ids = [f"s{i+1}" for i in range(len(perc))]
    segments = [ {"id": seg_ids[i], "percent": perc[i]} for i in range(len(perc)) ]

    labels = random.sample(["Dans","Innebandy","Löpning","Cykling","Längdhopp","Fotboll"], k=len(perc))
    # Bestäm lösning: störst procent = första etiketten, osv. (blandat så det inte alltid blir samma)
    # Vi sorterar etiketter slumpmässigt men mappar största procentsats till labels[0] osv.
    order = sorted(range(len(perc)), key=lambda i: -perc[i])
    shuffled_labels = labels[:]  # redan slumpade
    solution = { seg_ids[order[i]]: shuffled_labels[i] for i in range(len(order)) }

    q = "Para ihop aktiviteter med andelar i cirkeldiagrammet."
    return {
        "topic":"matematik",
        "area":"diagram",
        "type":"pie-assign",
        "q": q,
        "segments": segments,
        "labels": shuffled_labels,
        "solution": solution,
        "hint": "Hälften = 50%. En fjärdedel = 25%. Titta på vilken bit som är störst/mellan/minst.",
        "explain": "Största andelen matchar den aktivitet som flest valde osv.",
        "difficulty": "np"
    }

def gen_chance_matrix_np() -> Dict:
    """
    Sannolikhets-uppgift med Sant/Falskt.
    Vi skapar 3 färger med olika antal och 3–4 påståenden att kryssa.
    """
    colors = random.sample(["blå","svart","röd","grön","gul"], k=3)
    counts = sorted([random.randint(2,5), random.randint(2,5), random.randint(2,5)], reverse=True)
    ctx = { colors[i]: counts[i] for i in range(3) }
    total = sum(counts)
    # sortera (färg, antal) för att lätt uttrycka påståenden
    pairs = sorted(ctx.items(), key=lambda kv: -kv[1])

    def stmt():
        a,b,c = pairs[0], pairs[1], pairs[2] # a har störst
        return [
            { "text": f"Det är störst chans att få en {a[0]} klubba.", "answer": True  },
            { "text": f"Det är minst chans att få en {b[0]} klubba.", "answer": b[1]==pairs[2][1] }, # sant om b delar minsta
            { "text": f"Det är lika stor chans att få {b[0]} som {c[0]}.", "answer": b[1]==c[1] },
            { "text": f"Det är större chans att få {b[0]} än {c[0]}.", "answer": b[1]>c[1] }
        ]

    statements = stmt()
    # Slumpa 3–4 påståenden
    random.shuffle(statements)
    statements = statements[:random.choice([3,4])]

    q = "Kryssa Sant/Falskt utifrån antalen."
    return {
        "topic":"matematik",
        "area":"sannolikhet",
        "type":"chance-matrix",
        "q": q,
        "context": ctx,
        "statements": statements,
        "hint": "Jämför andelar: antal färg / totalt.",
        "explain": f"Totalt {total}. Jämför t.ex. {pairs[0][0]}: {pairs[0][1]}/{total} osv.",
        "difficulty": "np"
    }

# ------------------------- MAIN -------------------------

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True, help="Sökväg till matematik.json")
    ap.add_argument("--items", type=int, default=200, help="Antal MC-frågor (vanliga) att skapa")
    ap.add_argument("--plan", type=str, default="", help="Fördelning för MC, t.ex. 'addition=40,subtraktion=40,...'")
    ap.add_argument("--seed", type=int, default=None)
    ap.add_argument("--replace", action="store_true", help="Skriv över items helt (annars append)")

    # nya NP-typer (antal per körning)
    ap.add_argument("--table", type=int, default=0, help="Antal table-fill uppgifter")
    ap.add_argument("--pie", type=int, default=0, help="Antal pie-assign uppgifter")
    ap.add_argument("--chance", type=int, default=0, help="Antal chance-matrix uppgifter")

    args = ap.parse_args()
    if args.seed is not None:
        random.seed(args.seed)

    out = Path(args.out)
    data = read_existing(out)
    items = data["matematik"]["items"]

    if args.replace:
        items = []

    # 1) Generera MC-frågor enligt plan
    plan = parse_plan(args.plan, args.items)
    nid = next_id(items)
    created = []

    for area, count in plan.items():
        gen = GEN_BY_AREA.get(area)
        if not gen or count <= 0: continue
        for _ in range(count):
            q = gen()
            q["id"] = f"ma-{nid:03d}"
            nid += 1
            # hint/explain (icke-avslöjande) för matte
            q["hint"] = build_math_strategy(q["area"], q["q"])
            q["explain"] = q["hint"]
            # difficulty lämnas tom/implicit (filtreras med np via specialtyper)
            created.append(q)

    # 2) Lägg till NP-typer enligt flaggor
    for _ in range(max(0, args.table)):
        q = gen_table_fill_np(); q["id"] = f"ma-{nid:03d}"; nid += 1; created.append(q)
    for _ in range(max(0, args.pie)):
        q = gen_pie_assign_np(); q["id"] = f"ma-{nid:03d}"; nid += 1; created.append(q)
    for _ in range(max(0, args.chance)):
        q = gen_chance_matrix_np(); q["id"] = f"ma-{nid:03d}"; nid += 1; created.append(q)

    # 3) Spara
    items.extend(created)
    data["matematik"]["items"] = items

    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"✅ Klart! La till {len(created)} frågor i {out}")
    print(f"Nästa lediga id blir: ma-{nid:03d}")

if __name__ == "__main__":
    main()