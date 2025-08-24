#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
banks_tool.py – hanterar banks/:
- Bygger/uppdaterar public/banks/index.json
- Migrerar legacy-filer (svenska.json, matematik.json) -> single-subject *.ak{grade}.json
- Lägger till banker och sätter id/label
- Verifierar dubbletter

Exempel:
  python3 generators/banks_tool.py index
  python3 generators/banks_tool.py migrate-legacy --grade 3
  python3 generators/banks_tool.py add --file public/banks/engelska.ak4.json --label "Engelska åk 4"
  python3 generators/banks_tool.py list
  python3 generators/banks_tool.py verify
"""

import argparse, json, os, re, sys
from collections import Counter, defaultdict
from datetime import datetime
from typing import Dict, Any, List, Tuple

# Resolva vägar utifrån var detta skript ligger (…/generators/banks_tool.py)
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJ_ROOT = os.path.dirname(SCRIPT_DIR)              # en nivå upp från generators/
PUBLIC_ROOT = os.path.join(PROJ_ROOT, "public")
BANKS_DIR_DEF = os.path.join(PUBLIC_ROOT, "banks")   # absolut sökväg
INDEX_FILE = "index.json"

# ---- ämneskoder för snygga id:n (sv-ak3, ma-ak3, en-ak4, no-ak5, so-ak5, etc.) ----
SUBJECT_CODE = {
    "svenska": "sv",
    "matematik": "ma",
    "engelska": "en",
    "no": "no",
    "so": "so",
    "geografi": "geo",
    "historia": "his",
    "religion": "rel",
    "biologi": "bio",
    "fysik": "fy",
    "kemi": "ke",
}

def subject_code(subject: str) -> str:
    if not subject:
        return "xx"
    s = subject.strip().lower()
    return SUBJECT_CODE.get(s, re.sub(r"[^a-z0-9]+", "", s)[:2] or "xx")

def default_label(subject: str, grade: Any) -> str:
    s = subject.capitalize()
    try:
        g = int(grade)
        return f"{s} åk {g}"
    except:
        return s

def read_json(path: str) -> Any:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

def write_json(path: str, data: Any):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    os.replace(tmp, path)

def list_bank_files(banks_dir: str) -> List[str]:
    if not os.path.isdir(banks_dir):
        return []
    out = []
    for name in os.listdir(banks_dir):
        if not name.endswith(".json"):
            continue
        if name == INDEX_FILE:
            continue
        out.append(os.path.join(banks_dir, name))
    return sorted(out)

def parse_ak_filename(fname: str) -> Tuple[str, int]:
    """
    Försök läsa subject och grade ur filnamn som 'svenska.ak3.json'
    """
    base = os.path.basename(fname)
    m = re.match(r"^([^.]+)\.ak(\d+)\.json$", base)
    if not m:
        return ("", 0)
    subject = m.group(1)
    grade = int(m.group(2))
    return (subject, grade)

def normalize_single_subject(data: Dict[str, Any], fallback_subject: str = "", fallback_grade: Any = None) -> Dict[str, Any]:
    """
    Returnera single-subject struktur:
    { version?, subject, grade, items:[], passages:[] }
    """
    if "subject" in data and "items" in data:
        return {
            "version": data.get("version", "1.0"),
            "subject": data.get("subject") or fallback_subject or "svenska",
            "grade": data.get("grade", fallback_grade),
            "items": data.get("items", []),
            "passages": data.get("passages", []),
        }
    # legacy: svensk/matte i samma/lika struktur
    if "svenska" in data or "matematik" in data:
        # den här hjälpen används endast under migrering, inte i index
        raise ValueError("normalize_single_subject: fick legacy-format – migrera först.")
    # minimal fallback
    return {
        "version": data.get("version", "1.0"),
        "subject": fallback_subject or data.get("subject") or "svenska",
        "grade": data.get("grade", fallback_grade),
        "items": data.get("items", []),
        "passages": data.get("passages", []),
    }

def resolve_banks_dir(p: str) -> str:
    """
    Om p är relativ, tolka den relativt projektroten (inte nuvarande cwd).
    Om p är absolut, returnera som den är.
    """
    if os.path.isabs(p):
        return p
    return os.path.join(PROJ_ROOT, p)

# ----------------- kommandon -----------------

def cmd_list(args):
    banks_dir = resolve_banks_dir(args.banks_dir)
    files = list_bank_files(banks_dir)
    if not files:
        print("Inga bankfiler hittades i", banks_dir)
        return
    for p in files:
        try:
            data = read_json(p)
            subj, grade = data.get("subject"), data.get("grade")
            if not subj:
                subj, grade2 = parse_ak_filename(p)
                if subj and not data.get("subject"):
                    subj = subj
                if grade is None and grade2:
                    grade = grade2
            print(f"- {os.path.basename(p)}  subject={subj}  grade={grade}  items={len(data.get('items',[]))}  passages={len(data.get('passages',[]))}")
        except Exception as e:
            print(f"- {os.path.basename(p)}  ⚠️ kunde inte läsa: {e}")

def cmd_index(args):
    banks_dir = resolve_banks_dir(args.banks_dir)
    files = list_bank_files(banks_dir)
    banks = []
    for p in files:
        try:
            data = read_json(p)
        except Exception as e:
            print(f"⚠️ Hoppar över {p}: {e}")
            continue

        subj = data.get("subject")
        grade = data.get("grade")
        if not subj or grade is None:
            # försök ur filnamn
            s2, g2 = parse_ak_filename(p)
            subj = subj or s2
            grade = grade if grade is not None else (g2 if g2 else None)

        if not subj:
            print(f"⚠️ {p}: saknar 'subject' och kan inte tolkas – hoppar över.")
            continue

        code = subject_code(subj)
        if grade is None:
            # sätt 0 om okänt
            grade = 0
        bank_id = f"{code}-ak{grade}"
        label = data.get("label") or default_label(subj, grade)
        try:
            rel_path = "/" + os.path.relpath(p, start=PUBLIC_ROOT).replace("\\", "/")
        except ValueError:
            # om p inte ligger under PUBLIC_ROOT, fallback till absolut från /public
            rel_path = "/banks/" + os.path.basename(p)

        banks.append({
            "id": bank_id,
            "subject": subj.lower(),
            "grade": grade,
            "path": rel_path,
            "label": label
        })

    # unika id – om krock, gör löpnummer
    seen = Counter([b["id"] for b in banks])
    if any(v>1 for v in seen.values()):
        counts = defaultdict(int)
        for b in banks:
            counts[b["id"]] += 1
            if seen[b["id"]] > 1:
                b["id"] = f'{b["id"]}-{counts[b["id"]]}'

    idx = {
        "version": "1.0",
        "generatedAt": datetime.utcnow().isoformat() + "Z",
        "banks": banks
    }
    out_path = os.path.join(banks_dir, INDEX_FILE)
    write_json(out_path, idx)
    print("✅ Skrev", out_path, f"({len(banks)} banker)")

def cmd_migrate_legacy(args):
    """
    Tar public/banks/svenska.json och public/banks/matematik.json och skriver:
      public/banks/svenska.ak{grade}.json
      public/banks/matematik.ak{grade}.json
    (utan att ta bort originalen)
    """
    banks_dir = resolve_banks_dir(args.banks_dir)
    grade = int(args.grade)
    sv_path = os.path.join(banks_dir, "svenska.json")
    ma_path = os.path.join(banks_dir, "matematik.json")

    wrote = 0

    if os.path.isfile(sv_path):
        sv = read_json(sv_path)
        items = sv.get("svenska", {}).get("items", [])
        passages = sv.get("svenska", {}).get("passages", [])
        out = {
            "version": sv.get("version","1.0"),
            "subject": "svenska",
            "grade": grade,
            "items": items,
            "passages": passages
        }
        out_file = os.path.join(banks_dir, f"svenska.ak{grade}.json")
        write_json(out_file, out)
        wrote += 1
        print("✅ Skrev", out_file, f"(items={len(items)}, passages={len(passages)})")
    else:
        print("ℹ️ Hittade inte", sv_path)

    if os.path.isfile(ma_path):
        ma = read_json(ma_path)
        items = ma.get("matematik", {}).get("items", [])
        out = {
            "version": ma.get("version","1.0"),
            "subject": "matematik",
            "grade": grade,
            "items": items,
            "passages": []
        }
        out_file = os.path.join(banks_dir, f"matematik.ak{grade}.json")
        write_json(out_file, out)
        wrote += 1
        print("✅ Skrev", out_file, f"(items={len(items)})")
    else:
        print("ℹ️ Hittade inte", ma_path)

    if wrote == 0:
        print("⚠️ Inget att migrera (saknar legacy-filer).")
    else:
        print("➡️ Kör nu:  python3 generators/banks_tool.py index  (bygger index.json)")

def cmd_add(args):
    """
    Registrera/normalisera en bank:
    - Läser fil (--file), försöker säkerställa {subject, grade, items, passages}
    - Sätter label om saknas
    - Skriv tillbaka filen (normaliserad)
    - Uppdatera index.json
    """
    banks_dir = resolve_banks_dir(args.banks_dir)
    file_path = args.file
    if not os.path.isfile(file_path):
        print("⚠️ Hittar inte fil:", file_path)
        sys.exit(1)

    data = read_json(file_path)
    subj = data.get("subject")
    grade = data.get("grade")

    if not subj or grade is None:
        # prova filnamn
        s2, g2 = parse_ak_filename(file_path)
        subj = subj or s2
        grade = grade if grade is not None else (g2 if g2 else None)

    if not subj:
        print("⚠️ Filen saknar 'subject' och filnamnet följer inte mönstret '<subject>.ak<grade>.json'. Ange manuellt med --subject/--grade eller döp om filen.")
        sys.exit(2)

    if grade is None:
        if args.grade is None:
            print("⚠️ Okänd grade. Ange t.ex. --grade 3")
            sys.exit(2)
        grade = int(args.grade)

    # normalisera struktur
    norm = normalize_single_subject(data, fallback_subject=subj, fallback_grade=grade)
    if "label" not in norm or not norm.get("label"):
        norm["label"] = args.label or default_label(subj, grade)

    # skriv tillbaka (normaliserad)
    write_json(file_path, norm)
    print("✅ Normaliserade och skrev", file_path)

    # uppdatera index.json
    cmd_index(args)

def cmd_verify(args):
    """
    Sök dubblett-id i items/passages i alla banker.
    """
    banks_dir = resolve_banks_dir(args.banks_dir)
    files = list_bank_files(banks_dir)
    any_issue = False
    for p in files:
        try:
            data = read_json(p)
        except Exception as e:
            print(f"⚠️ Hoppar över {p}: {e}")
            continue

        subj = data.get("subject") or "?"
        ids = []
        for it in data.get("items", []):
            if isinstance(it, dict) and "id" in it:
                ids.append(it["id"])
        for pa in data.get("passages", []):
            if isinstance(pa, dict) and "id" in pa:
                ids.append(pa["id"])
            for q in pa.get("questions", []):
                if isinstance(q, dict) and "id" in q:
                    ids.append(q["id"])

        dup = [k for k, v in Counter(ids).items() if v > 1]
        print(f"- {os.path.basename(p)} ({subj}): items={len(data.get('items',[]))}, passages={len(data.get('passages',[]))}")
        if dup:
            any_issue = True
            print("  ⚠️ Dubbletter:", dup[:10], "…")

    if not any_issue:
        print("✅ Inga dubbletter funna.")

# ----------------- main -----------------

def main():
    ap = argparse.ArgumentParser(description="Hantera banks: index, migrering, add, verify")
    ap.add_argument("--banks-dir", default=BANKS_DIR_DEF, help="Sökväg till banks/ (default: public/banks)")

    sub = ap.add_subparsers(dest="cmd")

    sub.add_parser("list", help="Lista banker (fil för fil)")

    sub.add_parser("index", help="Bygg/uppdatera public/banks/index.json")

    sp_mig = sub.add_parser("migrate-legacy", help="Migrera svenska.json & matematik.json → single-subject *.ak{grade}.json")
    sp_mig.add_argument("--grade", type=int, required=True, help="Årskurs att sätta (t.ex. 3)")

    sp_add = sub.add_parser("add", help="Normalisera/registrera en bankfil och uppdatera index.json")
    sp_add.add_argument("--file", required=True, help="Sökväg till bankfilen (.json)")
    sp_add.add_argument("--label", default=None, help="Visningsnamn (default: '<Subject> åk <grade>')")
    sp_add.add_argument("--grade", type=int, default=None, help="Årskurs om filen saknar grade")

    sub.add_parser("verify", help="Verifiera dubbletter i alla banker")

    args = ap.parse_args()

    # Normalisera banks-dir en gång
    args.banks_dir = resolve_banks_dir(args.banks_dir)
    print(f"[banks_tool] banks_dir: {args.banks_dir}")

    if args.cmd == "index":
        cmd_index(args)
    elif args.cmd == "migrate-legacy":
        cmd_migrate_legacy(args)
    elif args.cmd == "add":
        cmd_add(args)
    elif args.cmd == "verify":
        cmd_verify(args)
    elif args.cmd == "list":
        cmd_list(args)
    else:
        ap.print_help()
        sys.exit(1)

if __name__ == "__main__":
    main()