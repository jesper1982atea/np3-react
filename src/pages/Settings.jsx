// src/pages/Settings.jsx
import { useEffect, useState } from 'react'
import useBanks from '../hooks/useBank' // fallback-aware hook
import SubjectPicker from '../components/SubjectPicker'

export default function Settings({ profile, saveProfile }){
  const { list, getBank } = useBanks() // läses redan av App men vi kan nyttja här också
  const [local, setLocal] = useState(profile?.settings || {})

  useEffect(()=>{ setLocal(profile?.settings || {}) }, [profile])

  function set(k, v){
    const next = { ...local, [k]: v }
    setLocal(next)
  }

  function save(){
    const p = { ...profile, settings: { ...profile.settings, ...local } }
    saveProfile(p)
  }

  const activeId = local?.activeBankId || 'sv-ak3'
  const activeEntry = getBank ? getBank(activeId) : null
  const activeLabel = activeEntry?.meta?.label || (list.find(b=>b.id===activeId)?.label) || activeId

  return (
    <div className="grid">
      <div className="card">
        <h1>Inställningar</h1>
        <div className="list">
          <div className="item">
            <b>Antal frågor (övning)</b>
            <div className="row">
              <input
                type="number" min="3" max="50"
                value={local.perQuiz ?? 10}
                onChange={e=>set('perQuiz', Number(e.target.value))}
              />
              <span className="tiny">Standard: 10</span>
            </div>
          </div>

          <div className="item">
            <b>Prov – total tid (minuter)</b>
            <div className="row">
              <input
                type="number" min="5" max="90"
                value={local.examTimerTotalMin ?? 25}
                onChange={e=>set('examTimerTotalMin', Number(e.target.value))}
              />
            </div>
          </div>

          <div className="item">
            <b>Hjälp (ledtråd) ger poängavdrag?</b>
            <div className="row">
              <label className="row" style={{gap:6}}>
                <input
                  type="checkbox"
                  checked={!!local.hintPenalty}
                  onChange={e=>set('hintPenalty', e.target.checked)}
                />
                <span>Ja, dra av 1 poäng vid hjälp</span>
              </label>
            </div>
          </div>

          <div className="item">
            <b>No-repeats</b>
            <div className="row">
              <label className="row" style={{gap:6}}>
                <input
                  type="checkbox"
                  checked={local.noRepeats !== false}
                  onChange={e=>set('noRepeats', e.target.checked)}
                />
                <span>Undvik upprepning mellan omgångar</span>
              </label>
            </div>
          </div>

          <div className="item">
            <b>Aktiv bank (ämne & årskurs)</b>
            <p className="tiny">Välj vilken bank som används i Dagens/Övning/Prov.</p>
            <div className="row" style={{margin:'6px 0 10px'}}>
              <span className="pill">✅ Aktiv bank: {activeLabel}</span>
            </div>
            <SubjectPicker
              list={list}
              selected={activeId}
              onSelect={(id)=>set('activeBankId', id)}
              getBank={getBank}
            />
          </div>
        </div>

        <div className="row" style={{marginTop:10}}>
          <button className="btn" onClick={save}>💾 Spara</button>
        </div>
      </div>
    </div>
  )
}