// src/pages/Practice.jsx
import { useEffect, useMemo, useRef, useState } from 'react'
import QuestionCard from '../components/QuestionCard'
import DragDropCard from '../components/DragDropCard'
import TableFillCard from '../components/TableFillCard'
import PieAssignCard from '../components/PieAssignCard'
import ChanceMatrixCard from '../components/ChanceMatrixCard'
import { drawWeighted } from '../lib/draw'
import { normalizeBank } from '../lib/bankUtils'
import { recordOutcome, weaknessWeights } from '../lib/coach'
import { beginSession, logAnswer, endSession } from '../lib/session.js'

export default function Practice({ profile, saveProfile, bank, setView }){
  const nb = useMemo(()=> normalizeBank(bank), [bank])
  const subject = nb?.subject || 'svenska'
  const pool = nb?.items || []
  const passages = nb?.passages || []

  // UI state
  const [state, setState] = useState('idle') // idle|running|review|done
  const [qs, setQs] = useState([])
  const [idx, setIdx] = useState(0)
  const [showHelp, setShowHelp] = useState(false)
  const [lastExplain, setLastExplain] = useState('')
  const [lastChoice, setLastChoice] = useState(-1)
  const [remaining, setRemaining] = useState(profile?.settings?.perQuestionTimerSec ?? 45)
  const timerRef = useRef(null)
  const sessionRef = useRef(null)

  const noRepeats = profile?.settings?.noRepeats !== false
  const perQuiz = profile?.settings?.perQuiz ?? 10

  function buildHint(q){
    if(q?.hint) return q.hint
    const area=(q?.area||'').toLowerCase()
    if(subject==='matematik'){
      if(area.includes('addition')) return 'Gör en tia: 8+7 = 8+2+5 → 15.'
      if(area.includes('subtraktion')) return 'Räkna upp från det mindre talet till det större.'
      if(area.includes('multiplikation')) return 'Upprepad addition, träna 2-, 5-, 10-tabellen.'
      if(area.includes('division')) return 'Hur många gånger ryms nämnaren i täljaren?'
      if(area.includes('klock')) return 'Halv = :30, Kvart = :15/:45.'
      return 'Bryt upp i hanterliga steg.'
    }else{
      if(area.includes('grammatik')) return 'Substantiv = namn, Verb = gör/är, Adjektiv = beskriver.'
      if(area.includes('läs')) return 'Markera nyckelord i texten och jämför med frågan.'
      if(area.includes('stavning')) return 'Lyssna efter sj-/tj-/hj- och dubbelteckning.'
      return 'Läs igenom noga och jämför alternativen.'
    }
  }

  function start(){
    if(!pool.length && !passages.length) return
    // Expandera passager till enskilda frågor
    const expanded = [
      ...pool,
      ...passages.flatMap(p => (p.questions||[]).map(q => ({...q, title:p.title, text:p.text})))
    ]
    // Viktning mot svagheter per area
    const areas = Array.from(new Set(expanded.map(x => (x.area||'okänd').toLowerCase())))
    const weights = weaknessWeights(subject, areas, 50)
    const picked = drawWeighted(expanded, perQuiz, weights, `practice_${subject}`, noRepeats)
      .map(x => ({...x, topic: subject}))

    setQs(picked)
    setIdx(0)
    setState('running')
    setShowHelp(false)
    setLastExplain('')
    setLastChoice(-1)

    // starta session
    sessionRef.current = beginSession('practice', { subject, count: picked.length })

    resetTimer()
  }

  // timer per fråga
  useEffect(()=>{
    if(state!=='running') return
    const perQ = profile?.settings?.perQuestionTimerSec ?? 45
    clearInterval(timerRef.current)
    setRemaining(perQ)
    timerRef.current = setInterval(()=>{
      setRemaining(r=>{
        if(r<=1){
          clearInterval(timerRef.current)
          // timeout = obesvarad
          onAnsweredWithChoice(-1)
          return perQ
        }
        return r-1
      })
    },1000)
    return ()=> clearInterval(timerRef.current)
  },[state, idx, profile?.settings?.perQuestionTimerSec])

  function resetTimer(){
    const perQ = profile?.settings?.perQuestionTimerSec ?? 45
    clearInterval(timerRef.current)
    setRemaining(perQ)
    timerRef.current = setInterval(()=>{
      setRemaining(r=>{
        if(r<=1){
          clearInterval(timerRef.current)
          onAnsweredWithChoice(-1)
          return perQ
        }
        return r-1
      })
    },1000)
  }

  function onAnsweredWithChoice(chosenIdx){
    const q = qs[idx]
    const ok = (chosenIdx === q.correct)
    recordOutcome(subject, q, !!ok)

    // logga i sessionshistorik
    logAnswer(sessionRef.current, q, chosenIdx)

    // uppdatera profil/poäng
    if(profile && saveProfile){
      const p = { ...profile }
      p.stats = p.stats || {}
      p.stats[subject] = p.stats[subject] || {answered:0, correct:0}
      p.stats[subject].answered++
      if(ok){
        p.stats[subject].correct++
        let delta = 1
        if(profile?.settings?.hintPenalty && showHelp) delta = Math.max(0, delta - 1)
        p.points = (p.points||0) + delta
        if(p.points % 50 === 0) p.level = (p.level||1)+1
      }
      saveProfile(p)
    }

    // spara valt svar på frågan för slut-sammanställning
    q.__chosen = chosenIdx

    setLastChoice(chosenIdx)
    setLastExplain(q.explain || buildHint(q))
    setState('review')
    clearInterval(timerRef.current)
  }

  function handleChoose(i){ onAnsweredWithChoice(i) }
  function handleBinary(ok){ onAnsweredWithChoice(ok ? qs[idx].correct : -1) }

  function next(){
    const n = idx+1
    if(n >= qs.length){
      setState('done')
      // avsluta och spara session
      endSession(sessionRef.current)
    } else {
      setIdx(n); setShowHelp(false); setLastExplain(''); setLastChoice(-1); setState('running'); resetTimer()
    }
  }

  function restart(){
    setState('idle'); setQs([]); setIdx(0); setShowHelp(false); setLastExplain(''); setLastChoice(-1)
    clearInterval(timerRef.current)
  }

  const current = qs[idx]
  const progressPct = qs.length ? Math.round((idx/qs.length)*100) : 0

  return (
    <div className="grid">
      <div className="card">
        <h1>🧩 Övningsläge</h1>
        <p className="tiny">Ämne: <b>{subject}</b>. Antal frågor: {perQuiz}. No-repeats: {noRepeats ? 'på' : 'av'}.</p>
        <div className="row" style={{marginTop:10}}>
          {state==='idle' && <button className="btn" onClick={start}>▶️ Starta övning</button>}
          <button className="btn alt" onClick={()=>setView?.('settings')}>⚙️ Inställningar</button>
        </div>
      </div>

      <div className="card">
        {(state==='running' || state==='review') && current && (
          <>
            <div className="row" style={{justifyContent:'space-between', flexWrap:'wrap'}}>
              <div className="chip">{subject==='matematik'?'🧮 Matematik': (subject==='engelska'?'🇬🇧 Engelska':'📖 Svenska')}</div>
              <div className="chip">Fråga {idx+1}/{qs.length}</div>
              {state==='running'
                ? <div className="pill">⏱️ {remaining}s</div>
                : <div className="pill">⏸️ Paus</div>}
            </div>
            <div className="progress"><div className="bar" style={{width:`${progressPct}%`}}/></div>

            {(() => {
              const common = { locked: state!=='running', showHint: true, hintText: buildHint(current) }
              switch(current.type){
                case 'dnd': return <DragDropCard q={current} onAnswer={handleBinary} {...common} />
                case 'table-fill': return <TableFillCard q={current} onAnswer={handleBinary} {...common} />
                case 'pie-assign': return <PieAssignCard q={current} onAnswer={handleBinary} {...common} />
                case 'chance-matrix': return <ChanceMatrixCard q={current} onAnswer={handleBinary} {...common} />
                default: return <QuestionCard q={current} onChoose={handleChoose} {...common} />
              }
            })()}

            {/* Hjälp + feedback + knappar */}
            <div className="sticky-actions">
              <div className="row">
                {state==='review' ? (
                  <button className="btn small" onClick={next}>➡️ Nästa</button>
                ) : (
                  <>
                    <button className="btn small ghost" onClick={()=>setShowHelp(h=>!h)}>
                      {showHelp ? '🆘 Hjälp (aktiv)' : '🆘 Hjälp'}
                    </button>
                    <button className="btn small ghost" onClick={()=>onAnsweredWithChoice(-1)}>⏭️ Hoppa över</button>
                  </>
                )}
                <button className="btn small" onClick={restart}>🔁 Avsluta</button>
              </div>
            </div>

            {state==='review' && (
              <>
                <div className="row" style={{marginTop:10, flexWrap:'wrap', gap:8}}>
                  {lastChoice === current.correct
                    ? <span className="chip" style={{color:'var(--ok)'}}>✔️ Rätt</span>
                    : <span className="chip" style={{color:'var(--error)'}}>✘ Fel</span>}
                  <span className="chip">Ditt svar: {lastChoice>=0 ? String.fromCharCode(65+lastChoice) : '—'}</span>
                  <span className="chip">Rätt svar: {String.fromCharCode(65+current.correct)}</span>
                </div>
                <div className="hint" style={{marginTop:10}}>
                  <b>Tips:</b> {lastExplain}
                </div>
              </>
            )}
          </>
        )}

        {state==='done' && (
          <>
            <h2>🎉 Klar!</h2>
            <p>Grymt jobbat. Vill du köra igen eller justera inställningar?</p>
            <div className="row" style={{marginTop:10}}>
              <button className="btn" onClick={start}>▶️ Kör igen</button>
              <button className="btn alt" onClick={()=>setView?.('settings')}>⚙️ Inställningar</button>
              <button className="btn small ghost" onClick={()=>setView?.('review')}>🧾 Visa detaljerad historik</button>
            </div>

            {/* Sammanfattning */}
            <div className="list" style={{marginTop:14}}>
              {(() => {
                const rights = qs.filter(q => (q.__chosen ?? -1) === q.correct).length
                const total = qs.length
                return (
                  <div className="item">
                    <b>Resultat:</b> {rights} / {total}
                  </div>
                )
              })()}

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

              {(() => {
                const areaStats = {}
                qs.forEach(q => {
                  const a = (q.area || 'okänd').toLowerCase()
                  const ok = (q.__chosen === q.correct)
                  areaStats[a] = areaStats[a] || {right:0,total:0}
                  areaStats[a].total++
                  if(ok) areaStats[a].right++
                })
                const entries = Object.entries(areaStats).map(([a,s]) => ({ area:a, acc: s.total? Math.round(100*s.right/s.total):0, total:s.total }))
                entries.sort((x,y)=>x.acc - y.acc)
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
                return (
                  <div className="item">
                    <b>Det här kan du öva på:</b>
                    <ul className="tiny" style={{marginTop:6}}>
                      {entries.map(e => (
                        <li key={e.area}>
                          <b>{e.area}</b>: {e.acc}% rätt av {e.total} frågor. {tips[e.area] || ''}
                        </li>
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