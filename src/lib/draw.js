// Slumpa (med eller utan återläggning) och hantera historik
export function shuffle(a){
  const x=(a||[]).slice()
  for(let i=x.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1))
    ;[x[i],x[j]]=[x[j],x[i]]
  }
  return x
}

// Bas: utan återläggning över flera försök (”no-repeats”).
export function drawWithoutReplacement(items, count, storageKey){
  if(!Array.isArray(items)) return []
  const usedKey = `${storageKey}__usedIds`
  const raw = localStorage.getItem(usedKey)
  const used = raw ? new Set(JSON.parse(raw)) : new Set()

  const available = items.filter(x => x && x.id && !used.has(x.id))
  let picked = []

  if (available.length >= count){
    picked = shuffle(available).slice(0, count)
  } else {
    // Ta allt som finns kvar + fyll upp slumpmässigt, och starta en ny cykel
    picked = [...available]
    const pool = shuffle(items)
    let i=0
    while (picked.length < count && i < pool.length){
      const cand = pool[i++]
      if(!cand?.id) continue
      if(!picked.find(p=>p.id===cand.id)) picked.push(cand)
    }
    used.clear()
  }

  picked.forEach(p => p?.id && used.add(p.id))
  localStorage.setItem(usedKey, JSON.stringify([...used]))
  return picked
}

// Med återläggning: rena, oberoende omgångar (alltid random)
export function drawWithReplacement(items, count){
  return shuffle(items).slice(0, Math.min(count, items.length))
}

// Smart: välj metod beroende på inställning
export function drawSmart(items, count, storageKey, noRepeats=true){
  return noRepeats
    ? drawWithoutReplacement(items, count, storageKey)
    : drawWithReplacement(items, count)
}

// Rensa historik (för en ny cykel eller om man bytt bank)
export function clearUsed(storageKey){
  const usedKey = `${storageKey}__usedIds`
  localStorage.removeItem(usedKey)
}

// Hjälp: rensa flera nycklar (ex. både exam/practice och ämnen)
export function clearUsedMany(keys=[]){
  keys.forEach(k => clearUsed(k))
}

export function shuffle(a){
  const x=a.slice();
  for(let i=x.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [x[i],x[j]]=[x[j],x[i]];
  }
  return x;
}

/**
 * Viktad dragning: väljer fler frågor från områden med högre vikt.
 * items: frågebank (blandade areas)
 * count: hur många du vill ha
 * weights: { area -> vikt } t.ex. {addition:1.4, subtraktion:0.9, ...}
 * storageKey: nyckel för no-repeats-uppföljning
 * noRepeats: bool (true = håll reda på använda id:n över sessioner)
 */
export function drawWeighted(items, count, weights, storageKey, noRepeats=true){
  const usedKey = `${storageKey}__usedIds`;
  const used = new Set(JSON.parse(localStorage.getItem(usedKey) || '[]'));

  // gruppera per area
  const byArea = {};
  for(const it of items){
    const area = (it.area || 'okänd').toLowerCase();
    (byArea[area] ||= []).push(it);
  }

  // skapa quota per area enligt vikt
  const areas = Object.keys(byArea);
  const wList = areas.map(a => Math.max(0.001, weights?.[a] ?? 1.0));
  const wSum = wList.reduce((s,v)=>s+v,0) || 1;
  const baseQuotas = areas.map(w => Math.max(0, Math.floor((weights?.[w] ?? 1.0)/wSum * count)));

  // justera så summan blir count
  let picked = [];
  const quotas = {};
  areas.forEach((a,i)=> quotas[a] = baseQuotas[i]);
  let assigned = areas.reduce((s,a)=>s+quotas[a],0);
  // fyll resterande 1 och 1 till tyngsta områden
  while(assigned < count){
    // välj area med högst vikt där det finns kvar
    let best = null, bestW = -1;
    for(const a of areas){
      const w = weights?.[a] ?? 1.0;
      if(w > bestW){ bestW = w; best = a; }
    }
    quotas[best] += 1;
    assigned++;
  }

  // plocka från varje area enligt quota, undvik used
  for(const a of areas){
    const pool = shuffle(byArea[a].filter(x => !used.has(x.id)));
    const need = quotas[a] || 0;
    picked.push(...pool.slice(0, need));
  }

  // om vi inte fick ihop count, fyll upp från övriga (ignorera weight)
  if(picked.length < count){
    const extraPool = shuffle(items.filter(x => !used.has(x.id) && !picked.find(p=>p.id===x.id)));
    picked.push(...extraPool.slice(0, count - picked.length));
  }

  // som sista utväg tillåt återanvändning (om banken är för liten)
  if(picked.length < count){
    const backup = shuffle(items.filter(x => !picked.find(p=>p.id===x.id)));
    picked.push(...backup.slice(0, count - picked.length));
  }

  // markera som använda
  if(noRepeats){
    const newUsed = new Set(used);
    picked.forEach(p => newUsed.add(p.id));
    localStorage.setItem(usedKey, JSON.stringify([...newUsed]));
  }

  return picked.slice(0, count);
}