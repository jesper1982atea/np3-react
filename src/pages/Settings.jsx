// src/pages/Settings.jsx
import { useState } from 'react'

export default function Settings({ profile, saveProfile, setView }){
  const [loc, setLoc] = useState(profile)
  const s = loc.settings

  function upd(part){ const next = { ...loc, ...part }; setLoc(next); saveProfile(next) }
  function updSet(k, v){ upd({ settings: { ...loc.settings, [k]: v } }) }

  function resetStats(){
    const p = { ...loc, stats: { svenska:{answered:0,correct:0}, matematik:{answered:0,correct:0} } }
    setLoc(p); saveProfile(p)
  }
  function clearUsedIds(){
    localStorage.removeItem('practice_sv__usedIds')
    localStorage.removeItem('practice_ma__usedIds')
    localStorage.removeItem('exam_sv__usedIds')
    localStorage.removeItem('exam_ma__usedIds')
    alert('Frågehistorik (no-repeats) nollställd.')
  }
  function clearAdaptiveHistory(){
    localStorage.removeItem('hist_svenska')
    localStorage.removeItem('hist_matematik')
    alert('Adaptiv historik nollställd.')
  }
  function resetAll(){
    if(!confirm('Återställ alla inställningar och poäng?')) return
    const p = {
      points: 0, level: 1, badges: [],
      settings: {
        perQuiz: 10, perExam: 20,
        perQuestionTimerSec: 45, examTimerTotalMin: 25,
        noRepeats: true, helpPenalty: false,
        difficultyMode: 'np', adaptiveDifficulty: true,
        adaptWindow: 10, adaptRaiseAt: 0.85, adaptLowerAt: 0.55
      },
      stats: { svenska:{answered:0,correct:0}, matematik:{answered:0,correct:0} }
    }
    setLoc(p); saveProfile(p)
  }

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
        <h2>🎚️ Svårighetsgrad</h2>
        <div className="list">
          <div className="item">
            <label>Basnivå</label>
            <select
              value={s.difficultyMode || 'np'}
              onChange={e=>updSet('difficultyMode', e.target.value)}
              style={{marginLeft:10}}
            >
              <option value="easy">Lätt</option>
              <option value="np">NP (åk 3)</option>
              <option value="hard">Svårare</option>
            </select>
            <p className="tiny" style={{marginTop:6}}>
              <b>NP</b> försöker matcha nivån i nationella prov åk 3. Lätt/Svårare är under/över den nivån.
            </p>
          </div>

          <div className="item">
            <label className="row" style={{gap:10}}>
              <input
                type="checkbox"
                checked={!!s.adaptiveDifficulty}
                onChange={e=>updSet('adaptiveDifficulty', e.target.checked)}
              />
              Anpassa svårighetsgrad efter prestation
            </label>
            <p className="tiny">Systemet höjer/sänker nivån baserat på senaste svaren.</p>
          </div>

          <div className="row" style={{gap:12}}>
            <div className="item">
              <label>Fönster (senaste N)</label>
              <input
                type="number" min={5} max={30} value={s.adaptWindow ?? 10}
                onChange={e=>updSet('adaptWindow', Math.max(5, Math.min(30, +e.target.value||10)))}
                style={{width:100, marginLeft:10}}
              />
            </div>
            <div className="item">
              <label>Höj vid ≥</label>
              <input
                type="number" step="0.05" min={0.5} max={1} value={s.adaptRaiseAt ?? 0.85}
                onChange={e=>updSet('adaptRaiseAt', Math.min(1, Math.max(0.5, +e.target.value||0.85)))}
                style={{width:100, marginLeft:10}}
              />
            </div>
            <div className="item">
              <label>Sänk vid &lt;</label>
              <input
                type="number" step="0.05" min={0.3} max={0.8} value={s.adaptLowerAt ?? 0.55}
                onChange={e=>updSet('adaptLowerAt', Math.min(0.8, Math.max(0.3, +e.target.value||0.55)))}
                style={{width:100, marginLeft:10}}
              />
            </div>
          </div>

          <div className="row" style={{gap:10, marginTop:8}}>
            <button className="btn small ghost" onClick={()=>{ localStorage.removeItem('hist_svenska'); localStorage.removeItem('hist_matematik'); alert('Adaptiv historik nollställd.') }}>
              ♻️ Nollställ adaptiv historik
            </button>
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
          <button className="btn small ghost" onClick={clearUsedIds}>♻️ Nollställ no-repeats</button>
          <button className="btn small ghost" onClick={clearAdaptiveHistory}>♻️ Nollställ adaptiv historik</button>
          <button className="btn small ghost" onClick={resetStats}>🗑️ Nollställ statistik</button>
          <button className="btn small" onClick={resetAll}>🚨 Återställ allt</button>
        </div>
      </div>
    </div>
  )
}