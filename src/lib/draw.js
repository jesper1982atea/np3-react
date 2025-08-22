// Slumpa utan återläggning över flera försök (”no-repeats”).
// Vi sparar använda id:n i localStorage under <storageKey>__usedIds
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
    // Ta resterande + fyll upp; nollställ used (ny cykel)
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

export function shuffle(a){
  const x = (a||[]).slice()
  for(let i=x.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1))
    ;[x[i],x[j]] = [x[j],x[i]]
  }
  return x
}