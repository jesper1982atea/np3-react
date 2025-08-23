#!/usr/bin/env bash
set -euo pipefail

SV_OUT="public/banks/svenska.json"
MA_OUT="public/banks/matematik.json"

echo "📦 Backup (engångs) – hoppa över om du redan har git:"
mkdir -p backups
cp -f "$SV_OUT" "backups/svenska_$(date +%Y%m%d_%H%M%S).json" 2>/dev/null || true
cp -f "$MA_OUT" "backups/matematik_$(date +%Y%m%d_%H%M%S).json" 2>/dev/null || true

echo "🧮 Matematik – 3 batchar (MC + NP-typer)"
for SEED in 101 202 303; do
  python3 make_matematik_bank.py \
    --out "$MA_OUT" \
    --items 250 --table 8 --pie 6 --chance 8 \
    --seed $SEED
done

echo "📖 Svenska – 3 nivåer"
python3 make_svenska_bank.py \
  --out "$SV_OUT" \
  --items 250 --dnd 36 --passages 30 --level easy --seed 41

python3 make_svenska_bank.py \
  --out "$SV_OUT" \
  --items 250 --dnd 36 --passages 30 --level np --seed 42

python3 make_svenska_bank.py \
  --out "$SV_OUT" \
  --items 250 --dnd 36 --passages 30 --level hard --seed 43

echo "✅ Färdigt."