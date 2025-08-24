// src/pages/Exam.jsx
import { useEffect, useMemo, useRef, useState } from 'react'
import QuestionCard from '../components/QuestionCard'
import DragDropCard from '../components/DragDropCard'
import TableFillCard from '../components/TableFillCard'
import PieAssignCard from '../components/PieAssignCard'
import ChanceMatrixCard from '../components/ChanceMatrixCard'
import { drawSmart, drawWeighted } from '../lib/draw'
import { normalizeBank } from '../lib/bankUtils'
import { recordOutcome, weaknessWeights } from '../lib/coach'

export default function Exam({ profile, saveProfile, bank, setView }){
  const nb = useMemo(()=> normalizeBank(bank), [bank])
  const subject = nb?.subject || 'svenska'
  const pool = nb?.items || []
  const passages = nb?.passages || []

  const [state, setState] = useState('idle') // idle|running|review|done
  const [qs, setQs] = useState([])
  const [idx, setIdx] = useState(0)
  const [timerMin, setTimerMin] = useState(profile?.settings?.examTimerTotalMin ?? 25)
  const [remaining, setRemaining] = useState((profile?.settings?.examTimerTotalMin ?? 25) * 60)
  const [answers, setAnswers] = useState({})
  const [result, setResult] = useState(null)
  const tRef = useRef(null)

  const noRepeats = profile?.settings?.noRepeats !== false
  const perExam = profile?.settings?.perExam ?? 20

  function start(){
    if(!pool.length && !passages.length) return
    const expanded = [
      ...pool,
      ...passages.flatMap(p => (p.questions||[]).map(q => ({...q, title:p.title, text:p.text})))
    ]
    const areas = Array.from(new Set(expanded.map(x => (x.area||'okänd').toLowerCase())))
    const weights = weaknessWeights(subject, areas, 50)
    const picked = drawWeighted(expanded, perExam, weights, `exam_${subject}`, noRepeats)
      .map(x => ({...x, topic: subject}))
    setQs(picked)
    setIdx(0)
    setState('running')
    setAnswers({})
    setResult(null)
    const totalSec = (profile?.settings?.examTimerTotalMin ?? 25) * 60
    setRemaining(totalSec)
  }

  // total provtimer
  useEffect(()=>{
    if(state!=='running') return
    clearInterval(tRef.current)
    tRef.current = setInterval(()=>{
      setRemaining(r=>{
        if(r<=1){
          clearInterval(tRef.current)
          finish()
          return 0
        }
        return r-1
      })
    },1000)
    return ()=> clearInterval(tRef.current)
  },[state])

  function answerCurrent(i){
    const q = qs[idx]
    setAnswers(a => ({ ...a, [q.id]: i }))
    if (q) q.__chosen = i
  }

  function next(){
    const n = idx+1
    if(n >= qs.length) finish()
    else setIdx(n)
  }

  function prev(){
    if(idx>0) setIdx(idx-1)
  }

  function finish(){
    // rätta
    let correct = 0
    qs.forEach(q => {
      const a = answers[q.id]
      if(a === q.correct) correct++
      // logga utfall för adaptivt lärande
      recordOutcome(subject, q, a === q.correct)
    })

    // bygg resultatsammanställning
    const total = qs.length
    const areaStats = {}
    qs.forEach(q => {
      const a = answers[q.id]
      const ok = (a === q.correct)
      const area = (q.area || 'okänd').toLowerCase()
      areaStats[area] = areaStats[area] || { right:0, total:0 }
      areaStats[area].total++
      if(ok) areaStats[area].right++
    })
    const byArea = Object.entries(areaStats).map(([area,s]) => ({
      area,
      acc: s.total ? Math.round(100*s.right/s.total) : 0,
      total: s.total
    })).sort((x,y)=> x.acc - y.acc)

    setResult({ correct, total, byArea })

    // poäng
    if(profile && saveProfile){
      const p = { ...profile }
      p.stats = p.stats || {}
      p.stats[subject] = p.stats[subject] || {answered:0, correct:0}
      p.stats[subject].answered += qs.length
      p.stats[subject].correct  += correct
      p.points = (p.points||0) + correct * 2
      if(p.points % 50 === 0) p.level = (p.level||1)+1
      saveProfile(p)
    }

    setState('done')
    clearInterval(tRef.current)
  }

  const current = qs[idx]
  const progressPct = qs.length ? Math.round((idx/qs.length)*100) : 0
  const min = Math.floor(remaining/60), sec = String(remaining%60).padStart(2,'0')

  return (
    <div className="grid">
      <div className="card">
        <h1>📝 Provläge</h1>
        <p className="tiny">Ämne: <b>{subject}</b> • Frågor: {perExam} • Tid: {profile?.settings?.examTimerTotalMin ?? 25} min</p>
        <div className="row" style={{marginTop:10}}>
          {state==='idle' && <button className="btn" onClick={start}>▶️ Starta prov</button>}
          <button className="btn alt" onClick={()=>setView?.('settings')}>⚙️ Inställningar</button>
        </div>
      </div>

      <div className="card">
        {state==='running' && current && (
          <>
            <div className="row" style={{justifyContent:'space-between', flexWrap:'wrap'}}>
              <div className="chip">{subject==='matematik'?'🧮 Matematik': (subject==='engelska'?'🇬🇧 Engelska':'📖 Svenska')}</div>
              <div className="chip">Fråga {idx+1}/{qs.length}</div>
              <div className="pill">⏱️ {min}:{sec}</div>
            </div>
            <div className="progress"><div className="bar" style={{width:`${progressPct}%`}}/></div>

            {(() => {
              const common = { locked: false, showHint: false }
              switch(current.type){
                case 'dnd': return <DragDropCard q={current} onAnswer={(ok)=>answerCurrent(ok?current.correct:-1)} {...common} />
                case 'table-fill': return <TableFillCard q={current} onAnswer={(ok)=>answerCurrent(ok?current.correct:-1)} {...common} />
                case 'pie-assign': return <PieAssignCard q={current} onAnswer={(ok)=>answerCurrent(ok?current.correct:-1)} {...common} />
                case 'chance-matrix': return <ChanceMatrixCard q={current} onAnswer={(ok)=>answerCurrent(ok?current.correct:-1)} {...common} />
                default: return <QuestionCard q={current} onChoose={answerCurrent} selected={answers[current?.id] ?? -1} {...common} />
              }
            })()}
            {answers[current?.id] !== undefined && answers[current?.id] > -1 && (
              <div className="row" style={{marginTop:8}}>
                <span className="answer-chip">✅ Valt: {String.fromCharCode(65 + (answers[current.id] || 0))}</span>
                <span className="tiny">Tryck ett annat alternativ för att ändra.</span>
              </div>
            )}

            <div className="row" style={{marginTop:10, flexWrap:'wrap'}}>
              <button className="btn small ghost" onClick={prev} disabled={idx===0}>⬅️ Föregående</button>
              <button className="btn small" onClick={next}>{idx===qs.length-1 ? '✅ Lämna in' : '➡️ Nästa'}</button>
            </div>
          </>
        )}

        {state==='done' && (
          <>
            <h2>🎉 Klart!</h2>
            <p>Resultat sparat i din statistik.</p>
            <div className="row" style={{marginTop:10}}>
              <span className="pill">Poäng: {result?.correct ?? 0} / {result?.total ?? qs.length}</span>
            </div>
            <div className="row" style={{marginTop:10}}>
              <button className="btn" onClick={()=>setState('idle')}>🔁 Nytt prov</button>
              <button className="btn alt" onClick={()=>setView?.('practice')}>🧩 Öva</button>
            </div>

            {/* Detaljer per fråga */}
            <div className="list" style={{marginTop:14}}>
              {qs.map((q,i) => (
                <div key={q.id || i} className="item">
                  {q.title && <div style={{fontWeight:700}}>{q.title}</div>}
                  {q.text && <div className="passage" style={{marginTop:6}}>{q.text}</div>}
                  <div style={{marginTop:6}}><b>{i+1}. {q.q}</b></div>
                  <div className="tiny">Område: {q.area || 'okänd'}</div>
                  <div className="row" style={{marginTop:6, flexWrap:'wrap', gap:8}}>
                    <span className="chip">Rätt svar: {String.fromCharCode(65 + q.correct)}</span>
                    {typeof q.__chosen === 'number' && q.__chosen >= 0
                      ? <span className="chip">Ditt svar: {String.fromCharCode(65 + q.__chosen)}</span>
                      : <span className="chip">Ditt svar: —</span>}
                    {(q.__chosen === q.correct)
                      ? <span className="chip" style={{color:'var(--ok)'}}>✔️ Rätt</span>
                      : <span className="chip" style={{color:'var(--error)'}}>✘ Fel</span>}
                  </div>
                  {q.hint && <div className="hint" style={{marginTop:8}}>💡 Tips: {q.hint}</div>}
                </div>
              ))}

              {/* Rekommendationer per område */}
              {(() => {
                const tips = {
                  'addition': 'Träna tiokamrater och att räkna från det större talet.',
                  'subtraktion': 'Räkna upp till närmaste tia, använd tallinjen.',
                  'multiplikation': 'Öva 2-, 5- och 10-tabellen först.',
                  'division': 'Tänk multiplikation baklänges: 3×?=talet.',
                  'klockan': 'Öva hel/halv/kvart, analog vs digital.',
                  'läsförståelse': 'Markera nyckelord i texten och jämför mot frågan.',
                  'grammatik': 'Substantiv = namn, Verb = gör/är, Adjektiv = beskriver.',
                  'stavning': 'Lyssna på sj-/tj-/hj- ljud, dubbelteckning efter kort vokal.'
                }
                const list = result?.byArea || []
                if(!list.length) return null
                return (
                  <div className="item">
                    <b>Det här kan du öva på:</b>
                    <ul className="tiny" style={{marginTop:6}}>
                      {list.map(e => (
                        <li key={e.area}><b>{e.area}</b>: {e.acc}% rätt av {e.total} frågor. {tips[e.area] || ''}</li>
                      ))}
                    </ul>
                  </div>
                )
              })()}
            </div>
          </>
        )}
      </div>
    </div>
  )
}