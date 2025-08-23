// src/lib/difficulty.js

// Rullande träffprocent: senaste windowSize frågor
export function rollingAccuracy(history, windowSize = 10){
  const slice = history.slice(-windowSize)
  if(!slice.length) return null
  const ok = slice.filter(Boolean).length
  return ok / slice.length
}

// Bestäm nivå baserat på basläge + adaptiv regler
export function decideDifficulty(baseMode = 'np', adaptive = true, acc = null, raiseAt = 0.85, lowerAt = 0.55){
  if(!adaptive || acc == null) return baseMode
  const order = ['easy','np','hard']
  let idx = Math.max(0, order.indexOf(baseMode))
  if(acc >= raiseAt && idx < order.length-1) idx++
  else if(acc < lowerAt && idx > 0) idx--
  return order[idx]
}

// Filtrera frågor på nivå, med smart fallback om poolen är tom
export function filterByDifficulty(items, want = 'np'){
  const tag = (q)=> (q.difficulty || 'np')
  const pool = items.filter(q => tag(q) === want)
  if(pool.length) return pool

  const pref = want==='np' ? ['np','easy','hard'] :
               want==='easy' ? ['easy','np','hard'] :
               ['hard','np','easy']
  for(const d of pref){
    const grp = items.filter(q => tag(q) === d)
    if(grp.length) return grp
  }
  return items
}