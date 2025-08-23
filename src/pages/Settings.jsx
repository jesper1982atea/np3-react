// src/pages/Settings.jsx
import { useState } from 'react'

export default function Settings({ profile, saveProfile, setView }){
  const [loc, setLoc] = useState(profile)

  function upd(part){
    const next = { ...loc, ...part }
    setLoc(next)
    saveProfile(next)
  }
  function updSet(k, v){
    upd({ settings: { ...loc.settings, [k]: v } })
  }

  function resetStats(){
    const p = { ...loc, stats: { svenska:{answered:0,correct:0}, matematik:{answered:0,correct:0} } }
    setLoc(p); saveProfile(p)
  }
  function clearUsedIds(){
    localStorage.removeItem('practice_sv__usedIds')
    localStorage.removeItem('practice_ma__usedIds')
    localStorage.removeItem('exam_sv__usedIds')
    localStorage.removeItem('exam_ma__usedIds')
    alert('Frågehistorik nollställd.')
  }
  function resetAll(){
    if(!confirm('Återställ alla inställningar och poäng?')) return
    const p = {
      points: 0, level: 1, badges: [],
      settings: {
        perQuiz: 10, perExam: 20,
        perQuestionTimerSec: 45, examTimerTotalMin: 25,
        noRepeats: true, helpPenalty: false
      },
      stats: { svenska:{answered:0,correct:0}, matematik:{answered:0,correct:0} }
    }
    setLoc(p); saveProfile(p)
  }

  const s = loc.settings

  return (
    <div className="grid">
      <div className="card">
        <h1>⚙️ Inställningar</h1>
        <div className="row" style={{marginTop:8}}>
          <span className="chip">Poäng: {loc.points}</span>
          <span className="chip">Nivå: {loc.level}</span>
        </div>
        <div className="row" style={{marginTop:10}}>
          <button className="btn small alt" onClick={()=>setView?.('home')}>🏠 Hem</button>
        </div>
      </div>

      <div className="card">
        <h2>🧩 Övningsläge</h2>
        <div className="list">
          <div className="item">
            <label>Antal frågor per övning</label>
            <input
              type="number" min={5} max={30} value={s.perQuiz}
              onChange={e=>updSet('perQuiz', Math.max(5, Math.min(30, +e.target.value||10)))}
              style={{width:120, marginLeft:10}}
            />
          </div>
          <div className="item">
            <label>Tid per fråga (sek)</label>
            <input
              type="number" min={10} max={120} value={s.perQuestionTimerSec}
              onChange={e=>updSet('perQuestionTimerSec', Math.max(10, Math.min(120, +e.target.value||45)))}
              style={{width:120, marginLeft:10}}
            />
          </div>
          <div className="item">
            <label className="row" style={{gap:10}}>
              <input
                type="checkbox"
                checked={!!s.noRepeats}
                onChange={e=>updSet('noRepeats', e.target.checked)}
              />
              Undvik upprepning mellan omgångar (no-repeats)
            </label>
          </div>
          <div className="item">
            <label className="row" style={{gap:10}}>
              <input
                type="checkbox"
                checked={!!s.helpPenalty}
                onChange={e=>updSet('helpPenalty', e.target.checked)}
              />
              Poängavdrag om man använder 🆘 Hjälp (–1 poäng)
            </label>
            <p className="tiny" style={{marginTop:6}}>
              Avdraget görs första gången Hjälp öppnas för en fråga.
            </p>
          </div>
        </div>
      </div>

      <div className="card">
        <h2>📝 Provläge</h2>
        <div className="list">
          <div className="item">
            <label>Antal frågor per prov</label>
            <input
              type="number" min={10} max={40} value={s.perExam}
              onChange={e=>updSet('perExam', Math.max(10, Math.min(40, +e.target.value||20)))}
              style={{width:120, marginLeft:10}}
            />
          </div>
          <div className="item">
            <label>Total provtid (min)</label>
            <input
              type="number" min={10} max={60} value={s.examTimerTotalMin}
              onChange={e=>updSet('examTimerTotalMin', Math.max(10, Math.min(60, +e.target.value||25)))}
              style={{width:120, marginLeft:10}}
            />
          </div>
        </div>
      </div>

      <div className="card">
        <h2>🧹 Underhåll</h2>
        <div className="row" style={{gap:10, flexWrap:'wrap'}}>
          <button className="btn small ghost" onClick={clearUsedIds}>♻️ Nollställ frågehistorik</button>
          <button className="btn small ghost" onClick={resetStats}>🗑️ Nollställ statistik</button>
          <button className="btn small" onClick={resetAll}>🚨 Återställ allt</button>
        </div>
      </div>
    </div>
  )
}