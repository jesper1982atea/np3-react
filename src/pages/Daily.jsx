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
import { beginSession, logAnswer, endSession } from '../lib/session.js'

const DAILY_COUNT = 6
const DAILY_KEY_LAST = 'daily_last'
const DAILY_KEY_STREAK = 'daily_streak'

function todayISO(){
  const d = new Date()
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
  const [lastChoice, setLastChoice] = useState(-1)
  const [remaining, setRemaining] = useState(30)
  const timerRef = useRef(null)
  const sessionRef = useRef(null)

  const nb = useMemo(()=> normalizeBank(bank), [bank])
  const items = nb?.items || []
  const subject = nb?.subject || 'svenska'
  const noRepeats = profile?.settings?.noRepeats !== false

  function start(){
    if(!items.length) return
    // 1) viktad slump baserad på svagheter
    const areas = Array.from(new Set(items.map(x => (x.area||'okänd').toLowerCase())))
    const w = weaknessWeights(subject, areas, 50)

    // Dra något fler än vi behöver så vi kan byta ut för att uppfylla krav på typer
    const basePick = drawWeighted(items, DAILY_COUNT + 3, w, `daily_${subject}`, noRepeats)
      .map(x => ({...x, topic: subject}))

    // 2) Bygg ett startset som är riktigt blandat
    let picked = shuffle(basePick).slice(0, DAILY_COUNT)

    // 3) Säkerställ att vi får med önskade frågetyper när de finns
    const hasType = (t) => picked.some(q => (q.type||'mc') === t)
    const poolType = (t) => shuffle(items.filter(q => (q.type||'mc') === t && !picked.find(p => p.id===q.id)))

    if(subject === 'svenska'){
      // minst en drag & drop om möjligt
      if(!hasType('dnd')){
        const cand = poolType('dnd')[0]
        if(cand){ picked[picked.length-1] = {...cand, topic: subject} }
      }
    } else if(subject === 'matematik'){
      // minst en tabell-uppgift (table-fill) om möjligt
      if(!hasType('table-fill')){
        const cand = poolType('table-fill')[0]
        if(cand){ picked[picked.length-1] = {...cand, topic: subject} }
      }
    }

    // 4) Slutlig slump-ordning
    picked = shuffle(picked)

    setQs(picked)
    setIdx(0)
    setState('running')
    setShowHelp(false)
    setLastExplain('')
    setLastChoice(-1)

    // starta sessionlogg
    sessionRef.current = beginSession('daily', { subject, count: picked.length })

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
          onAnsweredWithChoice(-1) // timeout = obesvarad
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
          onAnsweredWithChoice(-1)
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

  function onAnsweredWithChoice(chosenIdx){
    const q = qs[idx]
    const ok = (chosenIdx === q.correct)
    recordOutcome(subject, q, !!ok)

    // logga i sessionshistorik
    logAnswer(sessionRef.current, q, chosenIdx)

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

    // spara valt svar på frågan för sammanfattning
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
    if(n >= qs.length){ completeDaily() }
    else{
      setIdx(n); setShowHelp(false); setLastExplain(''); setLastChoice(-1); setState('running'); resetTimer()
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
    }catch(_){ }

    // avsluta sessionslogg
    endSession(sessionRef.current)

    setState('done')
  }

  function restart(){
    setState('idle'); setQs([]); setIdx(0); setShowHelp(false); setLastExplain(''); setLastChoice(-1)
    clearInterval(timerRef.current); setRemaining(30)
  }

  const current = qs[idx]
  const progressPct = qs.length ? Math.round((idx/qs.length)*100) : 0
  let streak = 0, last = ''
  try{
    streak = parseInt(localStorage.getItem(DAILY_KEY_STREAK) || '0',10) || 0
    last = localStorage.getItem(DAILY_KEY_LAST) || ''
  }catch(_){ }

  // sammanfattningsdata när done
  const summary = state==='done' ? (()=>{
    const rights = qs.filter(q => (q.__chosen ?? -1) === q.correct).length
    const total = qs.length
    const areaStats = {}
    qs.forEach(q => {
      const a = (q.area || 'okänd').toLowerCase()
      const ok = (q.__chosen === q.correct)
      areaStats[a] = areaStats[a] || { right:0, total:0 }
      areaStats[a].total++
      if(ok) areaStats[a].right++
    })
    const entries = Object.entries(areaStats).map(([a,s]) => ({ area:a, acc: s.total? Math.round(100*s.right/s.total):0, total:s.total }))
    entries.sort((x,y)=>x.acc - y.acc)
    return { rights, total, entries }
  })() : null

  const areaTips = {
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
            <h2>🎉 Bra jobbat!</h2>
            <p>Du har klarat dagens utmaning. Kom tillbaka imorgon för streak & bonus.</p>
            <div className="row" style={{marginTop:10}}>
              <button className="btn" onClick={start}>▶️ Kör igen (utan bonus)</button>
              <button className="btn alt" onClick={()=>setView?.('home')}>🏠 Hem</button>
              <button className="btn small ghost" onClick={()=>setView?.('review')}>🧾 Visa detaljerad historik</button>
            </div>

            {/* Sammanfattning */}
            <div className="list" style={{marginTop:14}}>
              <div className="item"><b>Resultat:</b> {summary?.rights ?? 0} / {summary?.total ?? 0}</div>

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

              <div className="item">
                <b>Det här kan du öva på:</b>
                <ul className="tiny" style={{marginTop:6}}>
                  {(summary?.entries || []).map(e => (
                    <li key={e.area}>
                      <b>{e.area}</b>: {e.acc}% rätt av {e.total} frågor. {areaTips[e.area] || ''}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}