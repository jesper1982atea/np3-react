#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Augmentera mattebanken:
- Sänker divisionssvårighet (valfritt) till tabeller 1–10 och små tal.
- Lägger till diagramfrågor (stapeldiagram/piktogram-liknande).

Kör:
  python generators/augment_matematik_bank.py \
    --bank ../public/banks/matematik.ak3.json \
    --add-diagrams 24 \
    --retune-division yes \
    --max-dividend 50 \
    --allow-nine no

Argument:
  --bank            Sökväg till mattebankens JSON (in/out).
  --add-diagrams    Hur många diagramfrågor som ska adderas (0 = inga).
  --retune-division yes/no  (default yes) Sänker svårighet på division.
  --max-dividend    Max täljare efter retune (default 50).
  --allow-nine      yes/no (default yes). Säg 'no' om ni vill undvika 9:ans tabell.

Output:
  Uppdaterar filen på plats och skriver hur många nya frågor som lades till.
"""
import json, argparse, random, os, sys
from copy import deepcopy

RNG = random.Random(42)

def load_bank(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

def save_bank(path, data):
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    os.replace(tmp, path)

def next_id(items, prefix="ma-"):
    """
    Returnerar en generatorfunktion som ger nästa lediga id.
    - Letar högsta befintliga siffra efter prefixet (ex: 'ma-012' -> 12).
    - Behåller nollfyllnad om den fanns (annars ingen).
    """
    maxn = 0
    pad = 0  # hur många siffror var den längsta nollfyllda id:n?

    for it in items:
        _id = str(it.get("id", ""))
        if _id.startswith(prefix):
            tail = _id[len(prefix):]
            if tail.isdigit():
                n = int(tail)
                maxn = max(maxn, n)
                pad = max(pad, len(tail))  # minns nollfyllnadslängd

    def gen():
        nonlocal maxn
        maxn += 1
        if pad > 0:
            return f"{prefix}{str(maxn).zfill(pad)}"
        return f"{prefix}{maxn}"

    return gen

def retune_division(items, *, max_dividend=50, allow_nine=True):
    """Filtrera bort 'svåra' divisioner och ersätt med snällare."""
    def is_easy_div(it):
        if it.get("area") != "division":
            return True
        # Tolka frågan "A ÷ B ="
        q = it.get("q","").replace(" ", "")
        try:
            left, right = q.split("÷")
            A = int(left)
            B = int(right.replace("=", ""))
        except:
            return True  # om vi inte kan tolka, låt den vara

        if A > max_dividend:  # för stort tal för åk3
            return False
        if not allow_nine and (A % 9 == 0 or B == 9):
            return False
        if B < 1 or B > 10:
            return False
        # kräver heltalskvot (åk3)
        return (A % B == 0)

    easy = []
    hard = []
    for it in items:
        (easy if is_easy_div(it) else hard).append(it)
    return easy, hard

# ---------------- Diagramfrågor ----------------

def make_bar_dataset():
    """
    Skapar ett litet 'klasslist'-dataset som känns åk3-nära,
    typ antal frukter/plagg/djur osv. Värden 1–9.
    """
    labels_pool = [
        ["Mån", "Tis", "Ons", "Tors"],
        ["Röd", "Blå", "Grön", "Gul"],
        ["Äpple", "Banan", "Päron", "Apelsin"],
        ["Hund", "Katt", "Kanin", "Fisk"],
        ["Keps", "Mössa", "Halsduk", "Vantar"],
        ["Boll", "Snöre", "Spel", "Bok"],
    ]
    labels = RNG.choice(labels_pool)
    values = [RNG.randint(1, 9) for _ in labels]
    unit = RNG.choice(["st", "elever", "frukter", "röster", "poäng"])
    title = RNG.choice([
        "Antal i klassen", "Sålda frukter", "Röster i omröstning",
        "Utlånade böcker", "Samlade poäng"
    ])
    return {
        "labels": labels,
        "values": values,
        "unit": unit,
        "title": title
    }

def bar_max_question(ds, nid):
    """
    Typ: 'Vilken stapel är högst?'
    type = 'bar-max'
    """
    labs, vals = ds["labels"], ds["values"]
    max_i = max(range(len(vals)), key=lambda i: vals[i])
    opts = labs[:]  # alternativ = etiketterna
    hint = "Titta på stapeln som är högst."
    exp = f"Den högsta stapeln är {labs[max_i]} ({vals[max_i]} {ds['unit']})."
    return {
        "id": nid,
        "type": "bar-max",
        "area": "diagram",
        "q": f"Vilken har flest i '{ds['title']}'?",
        "chart": { "labels": labs, "values": vals, "unit": ds["unit"], "title": ds["title"] },
        "options": opts,
        "correct": max_i,
        "hint": hint,
        "explain": exp
    }

def bar_compare_question(ds, nid):
    """
    Typ: 'Hur många fler A än B?'
    type = 'bar-compare' (numeriskt svar via alternativ)
    """
    labs, vals = ds["labels"], ds["values"]
    i, j = RNG.sample(range(len(labs)), 2)
    diff = abs(vals[i] - vals[j])
    # gör alternativ nära korrekt svar
    candidates = sorted({diff, max(0, diff-1), diff+1, max(0, diff+2)})
    RNG.shuffle(candidates)
    correct_idx = candidates.index(diff)
    hint = "Jämför staplarnas höjd: skillnaden är hur mycket högre den ena är."
    exp = f"{labs[i]} har {vals[i]} och {labs[j]} har {vals[j]}. Skillnad = {diff}."
    return {
        "id": nid,
        "type": "bar-compare",
        "area": "diagram",
        "q": f"Hur många fler {ds['unit']} är det i {labs[i]} än i {labs[j]}?",
        "chart": { "labels": labs, "values": vals, "unit": ds["unit"], "title": ds["title"] },
        "options": [str(c) for c in candidates],
        "correct": correct_idx,
        "hint": hint,
        "explain": exp
    }

def generate_diagram_items(n, nid):
    """Varva 'bar-max' och 'bar-compare'."""
    items = []
    for k in range(n):
        ds = make_bar_dataset()
        if k % 2 == 0:
            items.append(bar_max_question(ds, nid()))
        else:
            items.append(bar_compare_question(ds, nid()))
    return items

# ------------------------------------------------

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--bank", required=True)
    ap.add_argument("--add-diagrams", type=int, default=16)
    ap.add_argument("--retune-division", choices=["yes","no"], default="yes")
    ap.add_argument("--max-dividend", type=int, default=50)
    ap.add_argument("--allow-nine", choices=["yes","no"], default="yes")
    args = ap.parse_args()

    path = args.bank
    if not os.path.exists(path):
        print(f"❌ Hittar inte fil: {path}")
        sys.exit(1)

    data = load_bank(path)
    items = data.get("items", [])
    nid = next_id(items, "ma-")

    # 1) Retune division
    removed = []
    if args.retune_division == "yes":
        easy, hard = retune_division(
            items,
            max_dividend=args.max_dividend,
            allow_nine=(args.allow_nine == "yes")
        )
        removed = [it for it in items if it not in easy]
        items = easy
        print(f"• Division retune: tog bort {len(removed)} svårare uppgifter.")

    # 2) Lägg till diagramfrågor
    to_add = max(0, int(args.add_diagrams))
    if to_add:
        di = generate_diagram_items(to_add, nid)
        items.extend(di)
        print(f"• Lagt till {len(di)} diagramfrågor (bar-max / bar-compare).")

    # 3) Spara tillbaka
    data["items"] = items
    save_bank(path, data)
    print(f"✅ Klart. Totalt i banken: {len(items)} frågor.")
    if removed:
        print("  (Tips: vill du spara borttagna till en egen fil kan vi utöka skriptet.)")

if __name__ == "__main__":
    main()