#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Verifierar frågebanker för nya formatet.
- Läser public/banks/index.json om den finns och validerar varje bank.
- Fallback: validera public/banks/svenska.json och public/banks/matematik.json.

Kollar bl.a.:
  • Unika id:n (items, passages och passage-frågor)
  • MC-frågor: options finns och correct-index inom gräns
  • Förklaringar/hints (varnar om saknas)
  • Diagram (bar-max / bar-compare): chart.labels/values stämmer, options korrekta
  • Drag & drop (dnd): tiles/buckets finns
  • Andra typer: table-fill / pie-assign / chance-matrix – grundnycklar finns

Exit code 1 om kritiska fel upptäcks, annars 0.
"""
import json, sys, os, math
from collections import Counter, defaultdict
from typing import Dict, Any, List, Tuple

# Projektroten = mappen ovanför generators/
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BANKS_DIR = os.path.join(PROJECT_ROOT, 'public', 'banks')
INDEX_PATH = os.path.join(BANKS_DIR, 'index.json')

OK = 0
FAIL = 1

# ---------- Hjälp ----------

def load_json(path:str):
    with open(path, encoding='utf-8') as f:
        return json.load(f)

def is_str(x):
    return isinstance(x, str) and x.strip() != ''

# Tolka sökväg från index.json till faktisk fil på disk
def resolve_path(rel: str) -> str:
    if not isinstance(rel, str) or not rel:
        return ''
    # Exakt befintlig absolute path?
    if os.path.isabs(rel) and os.path.exists(rel):
        return rel
    # Hantera "/banks/foo.json" (site-root relativt) → PROJECT_ROOT/public/banks/foo.json
    if rel.startswith('/banks/'):
        return os.path.join(BANKS_DIR, rel[len('/banks/'):])
    # Hantera "public/banks/foo.json"
    if rel.startswith('public/banks/'):
        return os.path.join(PROJECT_ROOT, rel)
    # Vanlig relativ mot BANKS_DIR
    return os.path.join(BANKS_DIR, rel)

# ---------- Basvalidering ----------

def collect_ids_single(bank:Dict[str,Any]) -> List[str]:
    """Samla alla id:n för en single-subject-bank { subject, items, passages }."""
    ids: List[str] = []
    for it in bank.get('items', []) or []:
        if isinstance(it, dict) and 'id' in it:
            ids.append(it['id'])
    for p in bank.get('passages', []) or []:
        if isinstance(p, dict):
            if 'id' in p: ids.append(p['id'])
            for q in p.get('questions', []) or []:
                if 'id' in q: ids.append(q['id'])
    return ids

def collect_ids_legacy(bank:Dict[str,Any]) -> List[str]:
    """Samla id:n för legacy-formatet { svenska:{items,passages}, matematik:{items} }"""
    ids: List[str] = []
    if 'svenska' in bank:
        sv = bank['svenska']
        ids += [x['id'] for x in sv.get('items', []) if 'id' in x]
        for p in sv.get('passages', []) or []:
            if 'id' in p: ids.append(p['id'])
            ids += [q['id'] for q in p.get('questions', []) if 'id' in q]
    if 'matematik' in bank:
        ma = bank['matematik']
        ids += [x['id'] for x in ma.get('items', []) if 'id' in x]
    return ids

# ---------- Typ-specifika kontroller ----------

def check_mc(item:Dict[str,Any], issues:List[str]):
    opts = item.get('options')
    corr = item.get('correct')
    if not isinstance(opts, list) or len(opts) < 2:
        issues.append(f"{item.get('id')}: saknar options eller för få alternativ")
        return
    if not isinstance(corr, int) or corr < 0 or corr >= len(opts):
        issues.append(f"{item.get('id')}: 'correct' index utanför [0,{len(opts)-1}]")
    for i,op in enumerate(opts):
        if not is_str(op):
            issues.append(f"{item.get('id')}: options[{i}] inte en icke-tom sträng")


def check_chart(item:Dict[str,Any], issues:List[str]):
    chart = item.get('chart')
    if not isinstance(chart, dict):
        issues.append(f"{item.get('id')}: saknar 'chart' för diagramfråga")
        return
    labels = chart.get('labels'); values = chart.get('values')
    if not isinstance(labels, list) or not isinstance(values, list) or len(labels) != len(values) or len(labels) < 2:
        issues.append(f"{item.get('id')}: chart.labels/values saknas eller olika längd")
        return
    if not all(is_str(l) for l in labels):
        issues.append(f"{item.get('id')}: chart.labels måste vara strängar")
    if not all(isinstance(v,(int,float)) and v >= 0 for v in values):
        issues.append(f"{item.get('id')}: chart.values måste vara icke-negativa tal")

    if item.get('type') == 'bar-max':
        # options ska matcha labels
        opts = item.get('options')
        if not isinstance(opts, list) or [str(x) for x in opts] != [str(l) for l in labels]:
            issues.append(f"{item.get('id')}: options ska vara exakt chart.labels för bar-max")
        # correct ska peka på högsta värdet
        try:
            max_i = max(range(len(values)), key=lambda i: values[i])
            if item.get('correct') != max_i:
                issues.append(f"{item.get('id')}: 'correct' borde vara index {max_i} (högsta stapeln)")
        except Exception:
            issues.append(f"{item.get('id')}: kunde inte beräkna högsta stapeln")

    if item.get('type') == 'bar-compare':
        # options ska vara siffror (strängar), correct-index ska matcha diff mellan två labels som nämns i frågan
        opts = item.get('options')
        if not isinstance(opts, list) or len(opts) < 2:
            issues.append(f"{item.get('id')}: options saknas för bar-compare")
        else:
            if not all(is_str(o) and o.strip('-').isdigit() for o in opts):
                issues.append(f"{item.get('id')}: options ska vara heltal (strängar) för bar-compare")
        # Försök gissa vilka två labels som jämförs via frågetexten
        qtext = (item.get('q') or '').lower()
        pair = [i for i,l in enumerate(labels) if l.lower() in qtext]
        if len(pair) >= 2:
            i, j = pair[0], pair[1]
            diff = abs(values[i] - values[j])
            try:
                candidates = [int(x) for x in opts]
                if diff in candidates:
                    corr = candidates.index(diff)
                    if item.get('correct') != corr:
                        issues.append(f"{item.get('id')}: 'correct' bör vara index {corr} (skillnad={diff})")
                else:
                    issues.append(f"{item.get('id')}: saknar korrekt diff {diff} i options {candidates}")
            except Exception:
                issues.append(f"{item.get('id')}: kunde inte tolka options som tal")
        else:
            # kan inte härleda – bara kontrollera indexrange
            c = item.get('correct')
            if not isinstance(c,int) or c<0 or c>=len(item.get('options',[])):
                issues.append(f"{item.get('id')}: 'correct' index utanför gräns (bar-compare)")


def check_dnd(item:Dict[str,Any], issues:List[str]):
    tiles = item.get('tiles')
    buckets = item.get('buckets')
    if not isinstance(tiles, list) or len(tiles) < 2:
        issues.append(f"{item.get('id')}: dnd saknar tiles")
    if not isinstance(buckets, list) or len(buckets) < 2:
        issues.append(f"{item.get('id')}: dnd saknar buckets (minst 2)")


def check_other_types(item:Dict[str,Any], issues:List[str]):
    t = item.get('type')
    if t in (None, '', 'mc'):  # standard MC
        check_mc(item, issues)
    elif t in ('bar-max','bar-compare'):
        check_chart(item, issues)
        check_mc(item, issues)  # har fortfarande options/correct
    elif t == 'dnd':
        check_dnd(item, issues)
    elif t == 'table-fill':
        # lightweight: kräver headers/rows i item.table
        tbl = item.get('table')
        if not isinstance(tbl, dict) or not isinstance(tbl.get('headers'), list) or not isinstance(tbl.get('rows'), list):
            issues.append(f"{item.get('id')}: table-fill saknar table.headers/rows")
    elif t == 'pie-assign':
        if not isinstance(item.get('slices'), list) or not isinstance(item.get('buckets'), list):
            issues.append(f"{item.get('id')}: pie-assign saknar slices/buckets")
    elif t == 'chance-matrix':
        if not isinstance(item.get('matrix'), list) or not item.get('question'):
            issues.append(f"{item.get('id')}: chance-matrix saknar matrix/question")
    else:
        issues.append(f"{item.get('id')}: okänd type '{t}'")

    # Hint/Explain – varna om saknas (ej kritiskt)
    if not is_str(item.get('hint')):
        issues.append(f"⚠️ {item.get('id')}: saknar hint (rekommenderas)")
    if not is_str(item.get('explain')) and item.get('type') not in ('dnd', 'table-fill', 'pie-assign'):
        # vissa interaktiva kan sakna explain
        issues.append(f"⚠️ {item.get('id')}: saknar explain (rekommenderas)")

# ---------- Validera en bank ----------

def validate_bank(path:str, meta:Dict[str,Any]=None) -> Tuple[int,int]:
    """Returnerar (critical_errors, warnings)."""
    data = load_json(path)
    critical = 0
    warnings = 0

    # Hitta format
    is_single = 'items' in data or 'subject' in data

    # Samla id:n och kolla dubbletter
    if is_single:
        ids = collect_ids_single(data)
        subject = data.get('subject') or (meta or {}).get('subject') or 'okänt'
        name = (meta or {}).get('label') or os.path.basename(path)
        print(f"🔎 {name} — ämne: {subject} — items={len(data.get('items',[]) or [])}, passages={len(data.get('passages',[]) or [])}")
    else:
        ids = collect_ids_legacy(data)
        print(f"🔎 Legacy-bank: {os.path.basename(path)} — totalt id:n={len(ids)}")

    dup = [k for k,v in Counter(ids).items() if v>1]
    if dup:
        print("❌ Dubblett-id:", dup[:10], "…")
        critical += 1
    else:
        print("✅ Inga dubblett-id.")

    # Gå igenom frågor och kör typkontroller
    def iter_items(d):
        if 'items' in d:
            for it in d['items'] or []:
                yield it
        if 'passages' in d:
            for p in d['passages'] or []:
                for q in p.get('questions', []) or []:
                    qq = dict(q)
                    qq.setdefault('title', p.get('title'))
                    qq.setdefault('text', p.get('text'))
                    yield qq

    def run_on_bank(d):
        nonlocal critical, warnings
        issues: List[str] = []
        count = 0
        for it in iter_items(d):
            count += 1
            check_other_types(it, issues)
        # skriv ut issues och summera nivå
        if issues:
            # kritiska är de utan "⚠️"
            crit_local = [m for m in issues if not m.startswith('⚠️')]
            warn_local = [m for m in issues if m.startswith('⚠️')]
            for m in crit_local[:30]:
                print("  •", m)
            if len(crit_local) > 30:
                print(f"  • (+{len(crit_local)-30} fler kritiska)")
            for m in warn_local[:30]:
                print("  •", m)
            if len(warn_local) > 30:
                print(f"  • (+{len(warn_local)-30} fler varningar)")
            critical += int(len(crit_local) > 0)
            warnings += len(warn_local)
        else:
            print("✅ Inga typfel hittade i frågor.")

    if is_single:
        run_on_bank(data)
    else:
        # legacy: kör på svenska + matematik om de finns
        if 'svenska' in data:
            print("  – Validerar svenska…")
            run_on_bank(data['svenska'])
        if 'matematik' in data:
            print("  – Validerar matematik…")
            run_on_bank(data['matematik'])

    return critical, warnings

# ---------- Huvud ----------

def main():
    total_crit = 0
    total_warn = 0

    index_path = INDEX_PATH
    if os.path.exists(index_path):
        idx = load_json(index_path)
        entries = idx.get('entries') or idx.get('banks') or []
        if not isinstance(entries, list) or not entries:
            print(f"⚠️ index.json saknar entries/banks – kör fallback.")
        else:
            print(f"📚 index.json hittad – validerar {len(entries)} banker…\n")
            print(f"📁 BANKS_DIR: {BANKS_DIR}")
            for e in entries:
                rel = e.get('path') or e.get('file')
                if not rel:
                    print(f"❌ Saknar path i index-post: {e}")
                    total_crit += 1
                    continue
                p = resolve_path(rel)
                if not p or not os.path.exists(p):
                    print(f"❌ Hittar inte bankfil: {rel} (tolkad: {p or '—'})")
                    total_crit += 1
                    continue
                c,w = validate_bank(p, meta=e)
                total_crit += c; total_warn += w
            print()
            rc = FAIL if total_crit>0 else OK
            print(f"\n🏁 Klar. Kritiska fel: {total_crit}, varningar: {total_warn}. Exit={rc}")
            sys.exit(rc)

    # Fallback: kontrollera legacy-filer
    sv = os.path.join(BANKS_DIR,'svenska.json')
    ma = os.path.join(BANKS_DIR,'matematik.json')
    if os.path.exists(sv):
        print("📖 Validerar legacy svenska.json …\n")
        c,w = validate_bank(sv)
        total_crit += c; total_warn += w
        print()
    if os.path.exists(ma):
        print("🧮 Validerar legacy matematik.json …\n")
        c,w = validate_bank(ma)
        total_crit += c; total_warn += w
        print()

    rc = FAIL if total_crit>0 else OK
    print(f"🏁 Klar. Kritiska fel: {total_crit}, varningar: {total_warn}. Exit={rc}")
    sys.exit(rc)

if __name__ == '__main__':
    main()