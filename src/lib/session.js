// src/lib/session.js
// Enkel logg av övningar/prov/daily-pass

const KEY = 'np3_sessions_v1'

// Läs alla sessioner från localStorage
function loadAll(){
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]')
  } catch {
    return []
  }
}

// Spara (max 50 senaste)
function saveAll(arr){
  try {
    localStorage.setItem(KEY, JSON.stringify(arr.slice(-50)))
  } catch {
    // ignore
  }
}

// Starta ett nytt pass
export function beginSession(type, meta = {}){
  const id = `${type}-${Date.now()}`
  return {
    id,
    type,                 // 'practice' | 'exam' | 'daily'
    startedAt: new Date().toISOString(),
    finishedAt: null,
    meta,                 // ex { subject, bankId, label, count }
    items: []             // { id, q, options, correct, chosen, isCorrect, area, title?, text?, hint? }
  }
}

// Logga ett svar
export function logAnswer(session, q, chosenIdx){
  if(!session || !q) return
  const isCorrect = (chosenIdx === q.correct)
  session.items.push({
    id: q.id,
    q: q.q,
    options: q.options,
    correct: q.correct,
    chosen: chosenIdx,
    isCorrect,
    area: q.area || 'okänd',
    title: q.title || null,
    text: q.text || null,
    hint: q.hint || null,
    type: q.type || 'mc'
  })
}

// Avsluta ett pass och spara
export function endSession(session){
  if(!session) return null
  session.finishedAt = new Date().toISOString()
  const all = loadAll()
  all.push(session)
  saveAll(all)
  return session
}

// Hämta alla sparade sessioner
export function getSessions(){
  return loadAll()
}

// Hämta senaste sessionen
export function getLastSession(){
  const all = loadAll()
  return all.length ? all[all.length - 1] : null
}

// Rensa alla
export function clearSessions(){
  saveAll([])
}