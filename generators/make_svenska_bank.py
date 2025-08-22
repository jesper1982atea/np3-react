#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Generator för NP åk 3 – Svenska (JSON) med förklaringar, passager och drag-and-drop.
- Flervals-items (stavning, grammatik, ordförståelse) med 'explain'
- Läsförståelsepassager med 2–4 frågor/pass (styrbart)
- DnD-items: type="dnd" med buckets/tiles (förklaring ingår)
- Nivåer: easy | medium | hard
- Root-säker --out, backup, torrkörning, dedup-stöd för både MC och DnD
"""

import json, random, re, argparse
from pathlib import Path
from typing import List, Dict, Tuple, Callable

AREAS = ["stavning","grammatik","ordforstaelse"]

# ---------------- Ordbanker ----------------
STAVNING_RATT_EASY = [
    "själv","stjärna","skjorta","känsla","skoj","choklad","kyckling","hjärta","ljus","tjej","sked",
    "läkare","hjul","museum","buss","bibliotek","skola","ficklampa","staket","järnväg"
]
STAVNING_RATT_MED = STAVNING_RATT_EASY + [
    "tävling","nyckel","päron","läxor","frågetecken","fönsterbräda","människor","färglägga","växthuseffekt"
]
STAVNING_RATT_HARD = STAVNING_RATT_MED + [
    "abborre","schäfer","journalist","regissör","genomsnitt","kollision","allergisk","gymnasiet","generad","perspektiv"
]

STAVNING_FELBAS = {
    "själv": ["skjälv","skälv","sjjälv"],
    "stjärna": ["stjarna","stiarna","stjerna","sjärna"],
    "skjorta": ["schjorta","skorta","sjorta"],
    "känsla": ["känla","känslla","känslaa"],
    "skoj": ["sköj","skojj","skoi"],
    "choklad": ["sjoklad","schoklad","chocklad"],
    "kyckling": ["kylcking","kykling","kycklig"],
    "hjärta": ["hjerta","giärta","hjärtda"],
    "ljus": ["jus","ljuss","ljust"],
    "tjej": ["tjejj","chej","tjei"],
    "sked": ["sched","sjedd","skedd"],
    "läkare": ["lekare","läckare","lägare"],
    "hjul": ["jiul","hjull","hul"],
    "museum": ["muséum","museeum","museun"],
    "buss": ["bus","buz","bussar"],
    "ficklampa": ["fiklampa","fickllampa","fikklampa"],
    "bibliotek": ["bibliteket","bibliotekk","bibiliotek"],
    "skola": ["skolla","skoola","skolah"],
    "tävling": ["täfling","tävlin","tävlning"],
    "nyckel": ["nykel","nukkel","nükel"],
    "frågetecken": ["frågetäcken","frågetecknen","frågeteckan"],
    "fönsterbräda": ["fönsterbreda","fönsterbrädan","fönsterbrädda"],
    "människor": ["mäniskor","människår","männisckor"],
    "färglägga": ["färlägga","färgläga","färglägga"],
    "växthuseffekt": ["växthusefekt","växthusseffekt","växtuseffekt"],
    "abborre": ["abbore","abbörre","abbor"],
    "schäfer": ["sjäfer","skäfer","schäfar"],
    "journalist": ["jornalist","journallist","journalisst"],
    "regissör": ["regisssör","regisör","regisör"],
    "genomsnitt": ["genomsnit","genomsnintt","genomsnittt"],
    "kollision": ["kolision","kollission","kollisjon"],
    "allergisk": ["alergisk","allergiskt","alergiskt"],
    "gymnasiet": ["gymnaseit","gymnasiét","gimnasiet"],
    "generad": ["gennerad","generad","generat"],
    "perspektiv": ["perspecktiv","perspektviv","perspektivv"],
}

GRAMMATIK_VERB = ["springer","läser","skriver","äter","sover","målar","leker","cyklar","sjunger","badar","tittar","ritar","är"]
GRAMMATIK_SUBST = ["katt","boll","bok","bord","stol","skola","lärare","vän","fönster","stad","klass","ryggsäck","Lisa","Ali"]
GRAMMATIK_ADJ = ["glad","lång","snabb","röd","mjuk","hård","stor","liten","tyst","hög","söt","mörk"]
PREPOSITIONER = ["på","i","under","över","bredvid","framför","bakom","mellan"]

ORDF_SYNONYMER = [
    ("glad","munter"),("trött","utmattad"),("liten","pytteliten"),("stor","enorm"),
    ("arg","förbannad"),("snabb","kvick"),("tyst","lågmälld"),("rädd","skrämd"),
    ("smart","klok"),("rolig","skämtsam"),("fin","vacker")
]
ORDF_MOTSATS = [
    ("glad","ledsen"),("stor","liten"),("lång","kort"),("hård","mjuk"),
    ("snabb","långsam"),("ljus","mörk"),("tyst","högljudd"),("varm","kall"),
    ("torr","blöt"),("lätt","svår")
]

NAMN = ["Lisa","Ali","Mira","Hugo","Sara","Noah","Ella","Liam","Ava","Omar","Nora","Leo","Ines","Arvid"]
PLATSER = ["skolan","parken","biblioteket","skogen","matsalen","skolgården","lekparken","museet","sporthallen","stranden"]
SAKER = ["boll","bok","smörgås","ryggsäck","vante","mössa","regnjacka","cykel","penna","borste"]
AKTIVITETER = ["läste","lekte","sprang","cyklade","ritade","samlade kottar","hjälpte till","tränade","ökade farten","vågade fråga"]

# ------------- Hjälp -------------
def root_safe_out(path_str: str) -> Path:
  project_root = Path(__file__).resolve().parent.parent
  p = Path(path_str)
  return (p if p.is_absolute() else (project_root / p)).resolve()

def load_bank(path: Path) -> Dict:
  if not path.exists():
    return {"bankVersion":"1.0", "svenska":{"items":[], "passages":[]}}
  return json.loads(path.read_text(encoding="utf-8"))

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

def shuffle_options_with_correct(options: List[str], correct_index: int):
  paired = list(enumerate(options))
  random.shuffle(paired)
  new_options = [opt for _, opt in paired]
  new_correct = [i for i,(old_i, _) in enumerate(paired) if old_i == correct_index][0]
  return new_options, new_correct

def item_signature(item: Dict) -> Tuple:
  """Signatur för dedup. Hanterar både MC och DnD."""
  t = item.get("type") or "mc"
  if t == "dnd":
    b = tuple((b.get("id"), b.get("label")) for b in item.get("buckets") or [])
    tiles = tuple(sorted((ti.get("text"), ti.get("bucket")) for ti in item.get("tiles") or []))
    return ("dnd", item.get("q"), b, tiles)
  else:
    return ("mc", item.get("q"), tuple(item.get("options") or []))

def add_item_unique(items: List[Dict], item: Dict, seen: set) -> bool:
  sig = item_signature(item)
  if sig in seen: return False
  seen.add(sig)
  items.append(item)
  return True

# ------------- Nivå-inflytande -------------
def choose_spelling_word(level: str) -> str:
  if level == "easy": pool = STAVNING_RATT_EASY
  elif level == "medium": pool = STAVNING_RATT_MED
  else: pool = STAVNING_RATT_HARD
  return random.choice(pool)

def noisy_misspellings(correct: str, level: str, wanted: int = 3) -> List[str]:
  base = STAVNING_FELBAS.get(correct, [])
  letters = ["j","i","e","ä","å","o","u","h","k","g","y"]
  if level in ("medium","hard"):
    letters += ["sch","sj","skj","kj","dj","gj"]
  out = set(base)
  while len(out) < max(wanted*2, wanted+len(base)):
    s = list(correct)
    op = random.choice(["swap","drop","add"])
    if op == "swap" and len(s) > 2:
      i = random.randrange(len(s)-1); s[i], s[i+1] = s[i+1], s[i]
    elif op == "drop" and len(s) > 1:
      i = random.randrange(len(s)); del s[i]
    else:
      i = random.randrange(len(s)+1)
      ins = random.choice(letters)
      if len(ins) == 1: s.insert(i, ins)
      else: s[i:i] = list(ins)
    out.add("".join(s))
    if len(out) > 40: break
  out = [w for w in out if w != correct]
  random.shuffle(out)
  return out[:wanted]

def level_passage_len(level: str, base_chars: int) -> int:
  mult = {"easy":0.8,"medium":1.0,"hard":1.3}[level]
  return int(base_chars*mult)

# ------------- Generators – MC (med explain) -------------
def gen_stavning(level: str):
  korrekt = choose_spelling_word(level)
  fel = noisy_misspellings(korrekt, level, wanted=3)
  options = [korrekt] + fel
  q = "Vilket ord stavas rätt?"
  options, correct = shuffle_options_with_correct(options, 0)
  explain = "Stavning: Välj den korrekta stavningen. Jämför bokstäver/ljud (sj-, tj-, hj-, lj-, skj-)."
  return q, options, correct, explain

def gen_grammatik(level: str):
  typ_pool_easy = ["verb","adj","substantiv","prep","mening","pronomen"]
  typ_pool_med  = typ_pool_easy + ["tempus"]
  typ_pool_hard = typ_pool_med + ["ordföljd","kongruens","tecken"]
  typ = random.choice({"easy":typ_pool_easy,"medium":typ_pool_med,"hard":typ_pool_hard}[level])

  if typ == "verb":
    opts = [random.choice(GRAMMATIK_VERB), random.choice(GRAMMATIK_ADJ), random.choice(GRAMMATIK_SUBST), "på"]
    q = "Vilket ord är ett verb?"; correct = 0
    explain = "Verb beskriver handlingar eller tillstånd (t.ex. springer, läser, är)."
  elif typ == "adj":
    opts = [random.choice(GRAMMATIK_ADJ), random.choice(GRAMMATIK_VERB), random.choice(GRAMMATIK_SUBST), "i"]
    q = "Vilket ord är ett adjektiv?"; correct = 0
    explain = "Adjektiv beskriver egenskaper (t.ex. stor, röd, snabb)."
  elif typ == "substantiv":
    opts = [random.choice(GRAMMATIK_SUBST), random.choice(GRAMMATIK_VERB), random.choice(GRAMMATIK_ADJ), "under"]
    q = "Vilket ord är ett substantiv?"; correct = 0
    explain = "Substantiv är namn på saker/djur/personer/platser (t.ex. katt, bord, Lisa)."
  elif typ == "prep":
    opts = [random.choice(PREPOSITIONER), "springer", "glad", "katt"]
    q = "Vilket är en preposition?"; correct = 0
    explain = "Prepositioner beskriver läge/riktning (t.ex. på, under, i, bakom)."
  elif typ == "tempus":
    base = random.choice(["läser","skriver","springer","äter","sover","är"])
    mapping = {
      "läser":   (["läste","läser","läst","läsa"], 0),
      "skriver": (["skrev","skriver","skrivit","skriva"], 0),
      "springer":(["sprang","springer","sprungit","springa"], 0),
      "äter":    (["åt","äter","ätit","äta"], 0),
      "sover":   (["sov","sover","sovit","sova"], 0),
      "är":      (["var","är","varit","vara"], 0),
    }
    opts, correct = mapping[base]
    q = f"Välj preteritum av '{base}'."
    explain = "Preteritum är dåtid (igår). Ex: läser→läste, skriver→skrev, är→var."
  elif typ == "mening":
    opts = ["Vi åker hem.","vi åker hem","Vi åker hem","vi Åker hem."]
    q = "Vilken mening är korrekt skriven?"; correct = 0
    explain = "Mening börjar med stor bokstav och slutar med punkt/frågetecken/utropstecken."
  elif typ == "ordföljd":
    opts = ["Igår åt jag glass.","Åt glass igår jag.","Jag igår åt glass.","Igår jag åt glass."]
    q = "Välj korrekt ordföljd."; correct = 0
    explain = "Svensk rak ordföljd: t.ex. 'Igår åt jag glass.'"
  elif typ == "kongruens":
    opts = ["Den stora katten springer.","Det stora katten springer.","Den stor katten springer.","Det stor katten springer."]
    q = "Välj meningen med korrekt kongruens."; correct = 0
    explain = "Kongruens: 'den' + en-ord → 'stora' i bestämd form. 'Den stora katten…' är korrekt."
  else:  # tecken
    opts = ["Vad heter du?","Vad heter du.","Vad heter du!","Vad heter du,"]
    q = "Välj korrekt skiljetecken i meningen."; correct = 0
    explain = "Frågor avslutas med frågetecken (?)."

  options, correct = shuffle_options_with_correct(opts, correct)
  return q, options, correct, explain

def gen_ordforstaelse(level: str):
  typ_pool = ["synonym","motsats","lucka"]
  if level == "hard":
    typ_pool += ["fras","betydelse"]
  typ = random.choice(typ_pool)
  if typ == "synonym":
    bas, syn = random.choice(ORDF_SYNONYMER)
    opts = [syn, "fel", "annat", "okänt"]
    q = f"Synonym till '{bas}'?"; correct = 0
    explain = "Synonym = ord med liknande betydelse."
  elif typ == "motsats":
    bas, mot = random.choice(ORDF_MOTSATS)
    opts = [mot, "lik", "nära", "snabb"]
    q = f"Motsats till '{bas}'?"; correct = 0
    explain = "Motsats = ord som betyder tvärtom."
  elif typ == "lucka":
    namn = random.choice(["Han","Hon","Hen"])
    ord1 = random.choice(["glad","hungrig","trött","rädd"])
    opts = [ord1, "blå", "fem", "långsam"]
    q = f"{namn} är ___."
    correct = 0
    explain = "Välj det ord som passar bäst i meningen."
  elif typ == "fras":
    q = "Vad betyder frasen 'ta det lugnt'?"
    opts = ["Vara försiktig", "Springa fort", "Skrika högt", "Sova länge"]
    correct = 0
    explain = "Frasen betyder: varva ner, inte stressa."
  else:  # betydelse
    q = "Vad betyder 'försiktig'?"
    opts = ["Tänker efter och tar det lugnt", "Alltid snabb", "Alltid glad", "Mycket arg"]
    correct = 0
    explain = "Försiktig = att tänka efter och göra saker varsamt."
  options, correct = shuffle_options_with_correct(opts, correct)
  return q, options, correct, explain

GEN_ITEM_BY_AREA: Dict[str, Callable[[str], Tuple[str,List[str],int,str]]] = {
  "stavning": gen_stavning,
  "grammatik": gen_grammatik,
  "ordforstaelse": gen_ordforstaelse,
}

# ------------- DnD-templates -------------
def dnd_ordklasser(level: str) -> Dict:
  """Sortera ord i Substantiv/Verb eller Substantiv/Adjektiv."""
  if random.random() < 0.5:
    buckets = [{"id":"substantiv","label":"Substantiv"},{"id":"verb","label":"Verb"}]
    tiles = [
      {"id":"t1","text":random.choice(GRAMMATIK_SUBST),"bucket":"substantiv"},
      {"id":"t2","text":random.choice(GRAMMATIK_VERB),"bucket":"verb"},
      {"id":"t3","text":random.choice(GRAMMATIK_SUBST),"bucket":"substantiv"},
      {"id":"t4","text":random.choice(GRAMMATIK_VERB),"bucket":"verb"}
    ]
    explain = "Substantiv = namn på saker/djur/personer/platser. Verb = något man gör."
  else:
    buckets = [{"id":"substantiv","label":"Substantiv"},{"id":"adjektiv","label":"Adjektiv"}]
    tiles = [
      {"id":"t1","text":random.choice(GRAMMATIK_SUBST),"bucket":"substantiv"},
      {"id":"t2","text":random.choice(GRAMMATIK_ADJ),"bucket":"adjektiv"},
      {"id":"t3","text":random.choice(GRAMMATIK_SUBST),"bucket":"substantiv"},
      {"id":"t4","text":random.choice(GRAMMATIK_ADJ),"bucket":"adjektiv"}
    ]
    explain = "Substantiv = namn. Adjektiv beskriver egenskaper (stor, röd, snabb)."
  return {
    "type":"dnd","area":"grammatik","q":"Dra orden till rätt låda.",
    "buckets":buckets,"tiles":tiles,"explain":explain
  }

def dnd_prepositioner(level: str) -> Dict:
  """Lägesord: sortera prepositioner vs. ej prepositioner."""
  non_preps = ["snabb","glad","springer","katt"]
  buckets = [{"id":"prep","label":"Prepositioner"},{"id":"ej","label":"Ej preposition"}]
  tiles = []
  for w in random.sample(PREPOSITIONER, k=2):
    tiles.append({"id":f"t{len(tiles)+1}","text":w,"bucket":"prep"})
  for w in random.sample(non_preps, k=2):
    tiles.append({"id":f"t{len(tiles)+1}","text":w,"bucket":"ej"})
  return {
    "type":"dnd","area":"grammatik","q":"Vilka ord är prepositioner? Dra till rätt låda.",
    "buckets":buckets,"tiles":tiles,"explain":"Prepositioner beskriver läge/riktning (på, i, under, bakom…)."
  }

def dnd_ord_betydelse(level: str) -> Dict:
  """Kategorisera ords betydelse: positiva/negativa känslor (enkel)."""
  pos = ["glad","snäll","modig","lugnt"]
  neg = ["arg","ledsen","rädd","stökigt"]
  buckets = [{"id":"pos","label":"Positiv känsla"},{"id":"neg","label":"Negativ känsla"}]
  tiles = []
  for w in random.sample(pos, k=2):
    tiles.append({"id":f"t{len(tiles)+1}","text":w,"bucket":"pos"})
  for w in random.sample(neg, k=2):
    tiles.append({"id":f"t{len(tiles)+1}","text":w,"bucket":"neg"})
  return {
    "type":"dnd","area":"ordforstaelse","q":"Dra orden till rätt känsla.",
    "buckets":buckets,"tiles":tiles,"explain":"Positiv = bra känsla (glad, snäll). Negativ = jobbig känsla (arg, ledsen)."
  }

def dnd_ort_plats(level: str) -> Dict:
  """Kategorisera platser: ute/inne."""
  ute = ["parken","skogen","stranden"]
  inne = ["matsalen","biblioteket","sporthallen"]
  buckets = [{"id":"ute","label":"Ute"},{"id":"inne","label":"Inne"}]
  tiles = []
  for w in random.sample(ute, k=2):
    tiles.append({"id":f"t{len(tiles)+1}","text":w,"bucket":"ute"})
  for w in random.sample(inne, k=2):
    tiles.append({"id":f"t{len(tiles)+1}","text":w,"bucket":"inne"})
  return {
    "type":"dnd","area":"ordforstaelse","q":"Vilka platser är ute/inne? Dra till rätt låda.",
    "buckets":buckets,"tiles":tiles,"explain":"Ute = utomhus (parken…). Inne = inomhus (biblioteket…)."
  }

DND_TEMPLATES: List[Callable[[str], Dict]] = [
  dnd_ordklasser, dnd_prepositioner, dnd_ord_betydelse, dnd_ort_plats
]

# ------------- Läsförståelse -------------
def build_passage_text(level: str, target_chars: int):
  namn1 = random.choice(NAMN)
  plats = random.choice(PLATSER)
  title = f"{namn1} i {plats}"
  sentences_easy = [
    f"{namn1} var i {plats}.", f"Hen {random.choice(AKTIVITETER)}.",
    f"En {random.choice(SAKER)} blev viktig.", "Till slut var allt bra."
  ]
  sentences_med = [
    f"{namn1} begav sig till {plats} tidigt på morgonen.",
    f"Hen {random.choice(AKTIVITETER)} tillsammans med en vän.",
    f"Under tiden försvann en {random.choice(SAKER)}, vilket gjorde {namn1} orolig.",
    "Efter en stund hittades den och stämningen blev lugn igen."
  ]
  sentences_hard = [
    f"{namn1} gick mot {plats} där mycket var på gång.",
    f"Hen {random.choice(AKTIVITETER)} och försökte samtidigt hålla ordning på sin {random.choice(SAKER)}.",
    "När tempot ökade tappades fokus en kort stund, vilket fick konsekvenser.",
    "Med hjälp av andra återställdes ordningen och situationen kändes trygg igen."
  ]
  pool = {"easy":sentences_easy,"medium":sentences_med,"hard":sentences_hard}[level]
  text = " ".join(pool)
  while len(text) < target_chars:
    text += " " + random.choice(pool)
    if len(text) > target_chars*1.2: break
  return title, text

def passage_questions_for(level: str, title: str, text: str, qpp: int) -> List[Dict]:
  out = []
  plats = None
  for pl in PLATSER:
    if f" {pl}" in title or f" {pl}" in text:
      plats = pl; break
  if not plats: plats = random.choice(PLATSER)
  opts1 = [plats] + random.sample([p for p in PLATSER if p != plats], k=min(3, len(PLATSER)-1))
  opts1 = (opts1 + ["parken","skolan","biblioteket","skogen"])[:4]
  def shuf(opts, c=0):
    o, ci = shuffle_options_with_correct(opts, c); return o, ci
  o1,c1 = shuf(opts1, 0)
  out.append({ "q": "Var utspelar sig texten?", "options": o1, "correct": c1, "explain": "Läsförståelse: Orten/platsen brukar stå nämnd i texten." })
  if qpp >= 2:
    akt = random.choice(AKTIVITETER)
    o2,c2 = shuf([akt, "sover", "äter", "gråter"], 0)
    out.append({ "q": "Vad gör personen i texten?", "options": o2, "correct": c2, "explain": "Hitta verbet/aktiviteten som beskrivs i texten." })
  if qpp >= 3:
    sak = random.choice(SAKER)
    o3,c3 = shuf([sak, "penna", "bok", "cykel"], 0)
    out.append({ "q": "Vad blir viktigt i texten?", "options": o3, "correct": c3, "explain": "Nyckelord i texten kan vara föremål som nämns flera gånger." })
  if qpp >= 4:
    o4,c4 = shuf(["lugnt", "oroligt", "argt", "stökigt"], 0)
    out.append({ "q": "Hur känns slutet av texten?", "options": o4, "correct": c4, "explain": "Notera hur problemet löstes – då blir känslan ofta lugn/trygg." })
  return out

# ------------- CLI & logik -------------
def parse_plan(plan: str) -> Dict[str, int]:
  out = {}
  if not plan: return out
  for part in plan.split(","):
    part = part.strip()
    if not part: continue
    if "=" not in part: raise ValueError(f"Ogiltig plan-del: {part}")
    k,v = part.split("=",1)
    k = k.strip(); v = int(v.strip())
    if k not in AREAS: raise ValueError(f"Okänt område i plan: {k}")
    out[k] = v
  return out

def main():
  ap = argparse.ArgumentParser(description="Generera svenska-frågor (MC, DnD) + passager med förklaringar")
  ap.add_argument("--out", required=True, help="Sökväg till public/banks/svenska.json")
  ap.add_argument("--items", type=int, default=100, help="Antal MC-items att generera")
  ap.add_argument("--plan", type=str, default="", help="Fördela MC-items per område, t.ex. 'stavning=40,grammatik=30,ordforstaelse=30'")
  ap.add_argument("--passages", type=int, default=10, help="Antal läsförståelsepassager att generera")
  ap.add_argument("--qpp-min", type=int, default=2, help="Min frågor per passage")
  ap.add_argument("--qpp-max", type=int, default=3, help="Max frågor per passage")
  ap.add_argument("--passage-chars", type=int, default=220, help="Målad textlängd per passage (tecken)")
  ap.add_argument("--level", choices=["easy","medium","hard"], default="medium", help="Svårighetsgrad")
  ap.add_argument("--dnd", type=int, default=0, help="Antal DnD-items att generera")
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

  next_item_num = next_item_id(items)
  next_pass_num = next_passage_id(passages)

  # Signaturer för dedup (både MC och DnD)
  seen_items = set()
  for it in items:
    seen_items.add(item_signature(it))

  # --- MC-plan ---
  plan = parse_plan(args.plan) if args.plan else {}
  if not plan:
    base = args.items // len(AREAS)
    plan = {a: base for a in AREAS}
    leftover = args.items - base*len(AREAS)
    for a in ["stavning","grammatik","ordforstaelse"]:
      if leftover<=0: break
      plan[a]+=1; leftover-=1

  # --- Generera MC-items ---
  created_items: List[Dict] = []
  for area, n in plan.items():
    gen = GEN_ITEM_BY_AREA[area]
    tries = 0; made = 0
    while made < n and tries < n*50:
      tries += 1
      q, options, correct, explain = gen(args.level)
      item = {
        "id": f"sv-{next_item_num:03d}",
        "area": area,
        "q": q,
        "options": options,
        "correct": int(correct),
        "explain": explain
      }
      if add_item_unique(created_items, item, seen_items):
        next_item_num += 1; made += 1

  # --- Generera DnD-items ---
  for _ in range(max(0, args.dnd)):
    tpl = random.choice(DND_TEMPLATES)
    d = tpl(args.level)
    d["id"] = f"sv-{next_item_num:03d}"
    # dedup
    if add_item_unique(created_items, d, seen_items):
      next_item_num += 1

  # --- Generera passager ---
  created_passages: List[Dict] = []
  for _ in range(args.passages):
    qpp = max(2, min(4, random.randint(args.qpp_min, args.qpp_max)))
    target_len = level_passage_len(args.level, args.passage_chars)
    title, text = build_passage_text(args.level, target_len)
    if any(p.get("title")==title and p.get("text")==text for p in passages+created_passages):
      continue
    pid = f"sv-p-{next_pass_num:03d}"
    next_pass_num += 1
    qs = passage_questions_for(args.level, title, text, qpp)
    out_qs = []
    for i, qd in enumerate(qs, start=1):
      out_qs.append({
        "id": f"{pid}-q{i}",
        "q": qd["q"],
        "options": qd["options"],
        "correct": qd["correct"],
        "explain": qd.get("explain","Läsförståelse: hitta stöd i texten.")
      })
    created_passages.append({"id": pid, "title": title, "text": text, "questions": out_qs})

  # --- DRY RUN ---
  if args.dry:
    print(json.dumps({
      "level": args.level,
      "would_add_items": len(created_items),
      "would_add_passages": len(created_passages),
      "sample_item": (created_items[0] if created_items else None),
      "sample_dnd": (next((x for x in created_items if x.get("type")=="dnd"), None)),
      "sample_passage": (created_passages[0] if created_passages else None)
    }, ensure_ascii=False, indent=2))
    return

  # Backup
  if out_path.exists():
    bak = out_path.with_suffix(out_path.suffix + ".bak")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    bak.write_bytes(out_path.read_bytes())
    print(f"💾 Backup skapad: {bak}")

  # Spara
  items.extend(created_items)
  passages.extend(created_passages)
  bank["svenska"] = {"items": items, "passages": passages}
  out_path.parent.mkdir(parents=True, exist_ok=True)
  out_path.write_text(json.dumps(bank, ensure_ascii=False, indent=2), encoding="utf-8")

  print(f"✅ Klart! La till {len(created_items)} items (inkl. DnD: {sum(1 for i in created_items if i.get('type')=='dnd')}) och {len(created_passages)} passager i {out_path}")
  print(f"Nästa lediga item-id: sv-{next_item_num:03d}, passage-id: sv-p-{next_pass_num:03d}")

if __name__ == "__main__":
  main()