// src/lib/storage.js

// Säker wrapper kring localStorage (faller tillbaka till minne om LS är blockerat)
export const SafeStore = (() => {
  const KEY = 'np3_progress_v1'
  let mem = null

  function supported(){
    try{
      const t='__t__'+Math.random()
      localStorage.setItem(t,'1')
      localStorage.removeItem(t)
      return true
    }catch(e){ return false }
  }

  const can = supported()

  function get(){ return can ? JSON.parse(localStorage.getItem(KEY) || 'null') : mem }
  function set(v){
    if(can){
      try{ localStorage.setItem(KEY, JSON.stringify(v)) }
      catch(e){ mem = v }
    } else {
      mem = v
    }
  }
  function clear(){ if(can) localStorage.removeItem(KEY); mem = null }

  return { get, set, clear, can, KEY }
})()

export function loadProfile(){
  const DEF = {
    points: 0,
    level: 1,
    badges: [],
    settings: {
      perQuiz: 10,
      perExam: 20,
      perQuestionTimerSec: 45,
      examTimerTotalMin: 25,
      noRepeats: true,   // undvik upprepning mellan omgångar
      helpPenalty: false // ⬅️ NYTT: poängavdrag när man använder Hjälp?
    },
    stats: {
      svenska: { answered: 0, correct: 0 },
      matematik: { answered: 0, correct: 0 }
    }
  }

  try{
    const s = SafeStore.get()
    if(!s) return DEF
    return {
      ...DEF,
      ...s,
      settings: { ...DEF.settings, ...(s.settings || {}) },
      stats: {
        svenska: { ...DEF.stats.svenska, ...(s.stats?.svenska || {}) },
        matematik: { ...DEF.stats.matematik, ...(s.stats?.matematik || {}) }
      }
    }
  }catch(e){
    return DEF
  }
}

export function saveProfile(p){
  SafeStore.set(p)
}