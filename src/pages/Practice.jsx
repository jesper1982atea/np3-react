// src/pages/Practice.jsx
import { useEffect, useRef, useState } from 'react'
import QuestionCard from '../components/QuestionCard'
import DragDropCard from '../components/DragDropCard'
import { drawSmart, shuffle } from '../lib/draw'

const FALLBACK_EXPLAINS = {
  stavning: "Stavning: Välj den korrekta stavningen. Jämför bokstäver och ljud – särskilt sj-, tj-, hj-, lj-, skj-.",
  grammatik: "Grammatik: Substantiv = namn på saker/djur/personer/platser. Verb = något man gör. Adjektiv = beskriver egenskaper.",
  ordforstaelse: "Ordförståelse: Synonym betyder liknande ord. Motsats betyder tvärtom.",
  'läsförståelse': "Läsförståelse: Leta efter stöd i texten. Svaret står ofta tydligt uttryckt.",
  matematik: "Matematik: Följ räknesättets regler och tänk steg för steg (tiotal/ental)."
}

function buildFallbackExplain(q){
  if(q?.explain) return q.explain
  const text = (q?.q || '').toLowerCase()
  const area = q?.area || (q?.topic === 'svenska' ? (q?.title ? 'läsförståelse' : 'grammatik') : 'matematik')

  if(area === 'grammatik'){
    if(text.includes('substantiv')) return "Substantiv är namn på saker, djur, personer eller platser (t.ex. 'katt', 'bord', 'Lisa')."
    if(text.includes('verb')) return "Verb beskriver handling eller tillstånd (t.ex. 'springer', 'läser', 'är')."
    if(text.includes('adjektiv')) return "Adjektiv beskriver egenskaper (t.ex. 'stor', 'röd', 'snabb')."
    if(text.includes('pronomen')) return "Pronomen ersätter substantiv (t.ex. 'han', 'hon', 'den', 'det')."
    if(text.includes('preposition')) return "Prepositioner beskriver läge/riktning (t.ex. 'på', 'under', 'i', 'bakom')."
    if(text.includes('preteritum') || text.includes('tempus')) return "Preteritum = dåtid (igår). Ex: läser→läste, skriver→skrev."
    return FALLBACK_EXPLAINS.grammatik
  }
  if(area === 'stavning') return FALLBACK_EXPLAINS.stavning
  if(area === 'ordforstaelse') return FALLBACK_EXPLAINS.ordforstaelse
  if(area === 'läsförståelse') return FALLBACK_EXPLAINS['läsförståelse']
  if(q?.topic === 'matematik') return FALLBACK_EXPLAINS.matematik
  return FALLBACK_EXPLAINS.grammatik
}

export default function Practice({ profile, saveProfile, bank, setView }){
  const [topic, setTopic] = useState('svenska') // 'svenska' | 'matematik'
  const [setQ, setSetQ] = useState([])
  const [idx, setIdx] = useState(0)
  const [state, setState] = useState('idle') // 'idle' | 'running' | 'review' | 'done'
  const [remaining, setRemaining] = useState(profile?.settings?.perQuestionTimerSec || 45)
  const [last, setLast] = useState({correct:null, explain:''})
  const timerRef = useRef(null)

  const perQuiz = profile?.settings?.perQuiz || 10
  const perQSec = profile?.settings?.perQuestionTimerSec || 45
  const noRepeats = profile?.settings?.noRepeats !== false

  function start(topicSel = topic){
    if(!bank) return
    const storageKey = topicSel === 'svenska' ? 'practice_sv' : 'practice_ma'
    let items = []

    if(topicSel === 'svenska'){
      // Plocka fristående + ev. några passagefrågor
      const base = drawSmart(bank.svenska?.items||[], Math.max(6, Math.min(perQuiz-2, perQuiz)), storageKey, noRepeats)
      let extra = []
      if ((bank.svenska?.passages?.length||0) > 0){
        const pass = bank.svenska.passages[Math.floor(Math.random()*bank.svenska.passages.length)]
        extra = shuffle(pass.questions || []).slice(0, Math.min(2, perQuiz- base.length)).map(q=>({
          ...q, title: pass.title, text: pass.text, topic:'svenska'
        }))
      }
      items = shuffle([...base.map(x=>({ ...x, topic:'svenska' })), ...extra]).slice(0, perQuiz)
    }else{
      const base = drawSmart(bank.matematik?.items||[], perQuiz, storageKey, noRepeats)
      items = base.map(x=>({ ...x, topic:'matematik' }))
    }

    setTopic(topicSel)
    setSetQ(items)
    setIdx(0)
    setState('running')
    setLast({correct:null, explain:''})
    resetTimer()
  }

  // Timer per fråga
  useEffect(()=>{
    if(state !== 'running') return
    clearInterval(timerRef.current)
    setRemaining(perQSec)
    timerRef.current = setInterval(()=>{
      setRemaining(r=>{
        if(r<=1){
          clearInterval(timerRef.current)
          // Timeout räknas som fel och gå till review
          onAnswered(false, true)
          return perQSec
        }
        return r-1
      })
    }, 1000)
    return ()=> clearInterval(timerRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, idx, perQSec])

  function resetTimer(){
    clearInterval(timerRef.current)
    setRemaining(perQSec)
    timerRef.current = setInterval(()=>{
      setRemaining(r=>{
        if(r<=1){
          clearInterval(timerRef.current)
          onAnswered(false, true)
          return perQSec
        }
        return r-1
      })
    }, 1000)
  }

  // Kallas när man svarat (MC eller DnD)
  function onAnswered(isCorrect, wasTimeout=false){
    const q = setQ[idx]
    // uppdatera profil
    if(profile && saveProfile){
      const p = { ...profile }
      const t = q.topic || topic
      p.stats = p.stats || {}
      p.stats[t] = p.stats[t] || {answered:0, correct:0}
      p.stats[t].answered++
      if(isCorrect){
        p.stats[t].correct++
        p.points = (p.points||0) + 2 // övning = 2p / rätt
        if(p.points % 50 === 0) p.level = (p.level||1)+1
      }
      saveProfile(p)
    }
    clearInterval(timerRef.current)
    setLast({ correct: isCorrect, explain: buildFallbackExplain(q) })
    setState('review')
  }

  // Flervalsval -> översätt till onAnswered
  function handleChoose(chosenIndex, timeout=false){
    const q = setQ[idx]
    const isCorrect = !timeout && chosenIndex === q.correct
    onAnswered(isCorrect, timeout)
  }

  // DnD-svar -> ok (true/false) -> onAnswered
  function handleDnd(ok){
    onAnswered(!!ok, false)
  }

  function nextQuestion(){
    const next = idx + 1
    if(next >= setQ.length){
      setState('done')
    }else{
      setIdx(next)
      setLast({correct:null, explain:''})
      setState('running')
    }
  }

  function restart(){
    setState('idle')
    setSetQ([])
    setIdx(0)
    setLast({correct:null, explain:''})
    clearInterval(timerRef.current)
    setRemaining(perQSec)
  }

  const progressPct = setQ.length ? Math.round((idx/setQ.length)*100) : 0

  if(!bank) return <div className="card">Laddar…</div>

  const current = setQ[idx]

  return (
    <div className="grid">
      <div className="card">
        <h1>🧩 Övningsläge</h1>
        <div className="row" style={{marginTop:6}}>
          <span className="chip">Frågor: {perQuiz}</span>
          <span className="chip">⏱️ {perQSec}s / fråga</span>
          <span className="chip">Ämne: {topic==='matematik'?'🧮 Matematik':'📖 Svenska'}</span>
        </div>
        <div className="row" style={{marginTop:10}}>
          <button className="btn small ghost" onClick={()=>{restart(); start('svenska')}}>📖 Svenska</button>
          <button className="btn small ghost" onClick={()=>{restart(); start('matematik')}}>🧮 Matematik</button>
          {state!=='running' && state!=='review' && <button className="btn small" onClick={()=>start(topic)}>▶️ Starta</button>}
          <button className="btn small alt" onClick={()=>setView?.('home')}>🏠 Hem</button>
        </div>
      </div>

      <div className="card">
        {state==='idle' && <p className="tiny">Välj ämne och klicka <b>Starta</b>.</p>}

        {(state==='running' || state==='review') && current && (
          <>
            <div className="row" style={{justifyContent:'space-between'}}>
              <div className="chip">{(current.topic||topic)==='matematik'?'🧮 Matematik':'📖 Svenska'}</div>
              <div className="chip">Fråga {idx+1} / {setQ.length}</div>
              {state==='running'
                ? <div className="pill">⏱️ {remaining}s</div>
                : <div className="pill">⏸️ Paus</div>}
            </div>
            <div className="progress"><div className="bar" style={{width:`${progressPct}%`}}/></div>

            {/* Passageheader om svensk läsförståelse */}
            {current?.title && <h3 style={{marginTop:8}}>{current.title}</h3>}
            {current?.text && <div className="passage" style={{marginTop:6}}>{current.text}</div>}

            {/* Själva frågekortet */}
            {current?.type === 'dnd' ? (
              <DragDropCard
                q={current}
                locked={state!=='running'}
                onAnswer={handleDnd} // ok => true/false
              />
            ) : (
              <QuestionCard q={current} onChoose={handleChoose} locked={state!=='running'} />
            )}

            {/* Feedback + knappar */}
            {state==='review' && (
              <div className="hint" style={{marginTop:10}}>
                {last.correct ? '✅ Rätt!' : '❌ Inte riktigt.'}
                <div style={{marginTop:6, whiteSpace:'pre-wrap'}}><b>Förklaring:</b> {last.explain}</div>
              </div>
            )}

            <div className="row" style={{marginTop:10}}>
              {state==='running' && <button className="btn small ghost" onClick={()=>handleChoose(-1,false)}>⏭️ Hoppa över</button>}
              {state==='review' && <button className="btn small" onClick={nextQuestion}>➡️ Nästa</button>}
              <button className="btn small" onClick={restart}>🔁 Avsluta övning</button>
            </div>
          </>
        )}

        {state==='done' && (
          <>
            <h2>🎉 Klart med övningen!</h2>
            <p>Du kan köra igen—systemet undviker att upprepa frågor tills banken är slut.</p>
            <div className="row" style={{marginTop:10}}>
              <button className="btn" onClick={()=>start(topic)}>▶️ Kör igen ({topic==='matematik'?'🧮':'📖'})</button>
              <button className="btn alt" onClick={()=>setView?.('stats')}>📊 Se statistik</button>
              <button className="btn ghost" onClick={()=>setView?.('home')}>🏠 Hem</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}