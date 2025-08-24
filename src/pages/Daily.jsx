// src/pages/Daily.jsx
import { useEffect, useMemo, useRef, useState } from 'react'
import QuestionCard from '../components/QuestionCard'
import DragDropCard from '../components/DragDropCard'
import TableFillCard from '../components/TableFillCard'
import PieAssignCard from '../components/PieAssignCard'
import ChanceMatrixCard from '../components/ChanceMatrixCard'
import { drawWeighted, shuffle } from '../lib/draw'
import { normalizeBank } from '../lib/bankUtils'
import { recordOutcome, weaknessWeights } from '../lib/coach'

const DAILY_COUNT = 6
const DAILY_KEY_LAST = 'daily_last'
const DAILY_KEY_STREAK = 'daily_streak'

function todayISO(){
  const d = new Date()
  // YYYY-MM-DD
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth()+1).padStart(2,'0')
  const dd = String(d.getDate()).padStart(2,'0')
  return `${yyyy}-${mm}-${dd}`
}

function isConsecutiveDay(prevIso, nowIso){
  try{
    const [pY,pM,pD] = prevIso.split('-').map(Number)
    const [nY,nM,nD] = nowIso.split('-').map(Number)
    const prev = new Date(pY, pM-1, pD)
    const now  = new Date(nY, nM-1, nD)
    const diff = Math.round((now - prev)/(1000*60*60*24))
    return diff === 1
  }catch(_){ return false }
}

export default function Daily({ profile, saveProfile, bank, setView }){
  const [state, setState] = useState('idle') // idle | running | review | done
  const [qs, setQs] = useState([])
  const [idx, setIdx] = useState(0)
  const [showHelp, setShowHelp] = useState(false)
  const [lastExplain, setLastExplain] = useState('')
  const [remaining, setRemaining] = useState(30)
  const timerRef = useRef(null)

  const nb = useMemo(()=> normalizeBank(bank), [bank])
  const items = nb?.items || []
  const subject = nb?.subject || 'svenska'
  const noRepeats = profile?.settings?.noRepeats !== false

  function start(){
    if(!items.length) return
    // viktade områden mot svagheter inom den aktuella banken
    const areas = Array.from(new Set(items.map(x => (x.area||'okänd').toLowerCase())))
    const w = weaknessWeights(subject, areas, 50)
    const set = drawWeighted(items, DAILY_COUNT, w, `daily_${subject}`, noRepeats)
      .map(x => ({...x, topic: subject}))
    setQs(shuffle(set))
    setIdx(0)
    setState('running')
    setShowHelp(false)
    setLastExplain('')
    resetTimer()
  }

  // timer per fråga
  useEffect(()=>{
    if(state!=='running') return
    clearInterval(timerRef.current)
    setRemaining(30)
    timerRef.current = setInterval(()=>{
      setRemaining(r=>{
        if(r<=1){
          clearInterval(timerRef.current)
          onAnswered(false)
          return 30
        }
        return r-1
      })
    },1000)
    return ()=> clearInterval(timerRef.current)
  },[state, idx])

  function resetTimer(){
    clearInterval(timerRef.current)
    setRemaining(30)
    timerRef.current = setInterval(()=>{
      setRemaining(r=>{
        if(r<=1){
          clearInterval(timerRef.current)
          onAnswered(false)
          return 30
        }
        return r-1
      })
    },1000)
  }

  function buildHint(q){
    if(q?.hint) return q.hint
    const area=(q?.area||'').toLowerCase()
    if(subject==='matematik'){
      if(area.includes('addition')) return 'Tänk tiokamrater: gör en tia, räkna från det större talet.'
      if(area.includes('subtraktion')) return 'Räkna upp till jämn tia eller bryt talet i delar.'
      if(area.includes('multiplikation')) return 'Tänk som upprepad addition, dubbla/halvera vid behov.'
      if(area.includes('division')) return 'Multiplikation baklänges: hur många gånger ryms talet?'
      if(area.includes('klock')) return 'Halv = :30, Kvart = :15 / :45.'
      return 'Dela upp problemet i små steg.'
    }else{
      if(area.includes('grammatik')) return 'Substantiv = namn, Verb = handling/tillstånd, Adjektiv = beskriver.'
      if(area.includes('stavning')) return 'Lyssna på ljud: sj-, tj-, hj-, dubbelteckning.'
      if(area.includes('läs')) return 'Markera nyckelord i texten och jämför med frågan.'
      return 'Läs noga igen och jämför alternativen.'
    }
  }

  function onAnswered(ok){
    const q = qs[idx]
    recordOutcome(subject, q, !!ok)

    // poäng
    if(profile && saveProfile){
      const p = { ...profile }
      p.stats = p.stats || {}
      p.stats[subject] = p.stats[subject] || {answered:0, correct:0}
      p.stats[subject].answered++
      if(ok){
        p.stats[subject].correct++
        p.points = (p.points||0) + 2
        if(p.points % 50 === 0) p.level = (p.level||1)+1
      }
      saveProfile(p)
    }

    setLastExplain(q.explain || buildHint(q))
    setState('review')
    clearInterval(timerRef.current)
  }

  function handleChoose(i){ onAnswered(i === qs[idx].correct) }
  function handleBinary(ok){ onAnswered(!!ok) }

  function next(){
    const n = idx+1
    if(n >= qs.length){ completeDaily() }
    else{
      setIdx(n); setShowHelp(false); setLastExplain(''); setState('running'); resetTimer()
    }
  }

  function completeDaily(){
    try{
      const today = todayISO()
      const prev = localStorage.getItem(DAILY_KEY_LAST) || ''
      let s = parseInt(localStorage.getItem(DAILY_KEY_STREAK) || '0',10) || 0
      if(prev === today){ /* redan körd idag */ }
      else if(prev && isConsecutiveDay(prev, today)){ s += 1 }
      else { s = 1 }
      localStorage.setItem(DAILY_KEY_LAST, today)
      localStorage.setItem(DAILY_KEY_STREAK, String(s))

      if(profile && saveProfile){
        const bonus = 3 + Math.min(7, s)
        const p = { ...profile, points: (profile.points||0) + bonus }
        if(p.points % 50 === 0) p.level = (p.level||1)+1
        saveProfile(p)
      }
    }catch(_){}
    setState('done')
  }

  function restart(){
    setState('idle'); setQs([]); setIdx(0); setShowHelp(false); setLastExplain('')
    clearInterval(timerRef.current); setRemaining(30)
  }

  const current = qs[idx]
  const progressPct = qs.length ? Math.round((idx/qs.length)*100) : 0
  let streak = 0, last = ''
  try{
    streak = parseInt(localStorage.getItem(DAILY_KEY_STREAK) || '0',10) || 0
    last = localStorage.getItem(DAILY_KEY_LAST) || ''
  }catch(_){}

  return (
    <div className="grid">
      <div className="card">
        <h1>⭐ Dagens utmaning</h1>
        <p className="tiny">{DAILY_COUNT} snabba frågor ur: <b>{subject}</b>. Viktat mot dina svagare områden.</p>
        <div className="row" style={{flexWrap:'wrap', marginTop:6}}>
          <span className="chip">Senast: {last || '—'}</span>
          <span className="chip">Streak: {streak || 0} 🔥</span>
        </div>
        <div className="row" style={{marginTop:10}}>
          {state==='idle' && <button className="btn small" onClick={start}>▶️ Starta</button>}
          <button className="btn small alt" onClick={()=>setView?.('home')}>🏠 Hem</button>
        </div>
      </div>

      <div className="card">
        {(state==='running' || state==='review') && current && (
          <>
            <div className="row" style={{justifyContent:'space-between', flexWrap:'wrap'}}>
              <div className="chip">{subject==='matematik'?'🧮 Matematik': (subject==='engelska'?'🇬🇧 Engelska':'📖 Svenska')}</div>
              <div className="chip">Fråga {idx+1} / {qs.length}</div>
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

            <div className="sticky-actions">
              <div className="row">
                {state==='review'
                  ? <button className="btn small" onClick={next}>➡️ Nästa</button>
                  : <button className="btn small ghost" onClick={()=>setShowHelp(h=>!h)}>
                      {showHelp ? '🆘 Hjälp (aktiv)' : '🆘 Hjälp'}
                    </button>}
                <button className="btn small" onClick={restart}>🔁 Avsluta</button>
              </div>
            </div>

            {state==='review' && (
              <div className="hint" style={{marginTop:10, whiteSpace:'pre-wrap'}}>
                <b>Tips:</b> {lastExplain}
              </div>
            )}
          </>
        )}

        {state==='done' && (
          <>
            <h2>🎉 Bra jobbat!</h2>
            <p>Du har klarat dagens utmaning. Kom tillbaka imorgon för streak & bonus.</p>
            <div className="row" style={{marginTop:10}}>
              <button className="btn" onClick={start}>▶️ Kör igen (utan bonus)</button>
              <button className="btn alt" onClick={()=>setView?.('home')}>🏠 Hem</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}