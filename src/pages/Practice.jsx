// src/pages/Practice.jsx
import { useEffect, useRef, useState } from 'react'
import QuestionCard from '../components/QuestionCard'
import { drawWithoutReplacement, shuffle } from '../lib/draw'

export default function Practice({ profile, saveProfile, bank, setView }){
  const [topic, setTopic] = useState('svenska') // 'svenska' | 'matematik'
  const [setQ, setSetQ] = useState([])
  const [idx, setIdx] = useState(0)
  const [state, setState] = useState('idle') // 'idle' | 'running' | 'done'
  const [remaining, setRemaining] = useState(profile?.settings?.perQuestionTimerSec || 45)
  const [lastResult, setLastResult] = useState(null) // true/false
  const timerRef = useRef(null)

  const perQuiz = profile?.settings?.perQuiz || 10
  const perQSec = profile?.settings?.perQuestionTimerSec || 45

  // Starta en ny övning
  function start(topicSel = topic){
    if(!bank) return
    const storageKey = topicSel === 'svenska' ? 'practice_sv' : 'practice_ma'
    let items = []
    if(topicSel === 'svenska'){
      const base = drawWithoutReplacement(bank.svenska?.items||[], Math.max(6, Math.min(perQuiz-2, perQuiz)), storageKey)
      // plocka ev. 0–2 passagefrågor och blanda in
      let extra = []
      if ((bank.svenska?.passages?.length||0) > 0){
        const pass = bank.svenska.passages[Math.floor(Math.random()*bank.svenska.passages.length)]
        extra = shuffle(pass.questions || []).slice(0, Math.min(2, perQuiz- base.length)).map(q=>({
          ...q, title: pass.title, text: pass.text, topic:'svenska'
        }))
      }
      items = shuffle([...base.map(x=>({ ...x, topic:'svenska' })), ...extra]).slice(0, perQuiz)
    }else{
      const base = drawWithoutReplacement(bank.matematik?.items||[], perQuiz, storageKey)
      items = base.map(x=>({ ...x, topic:'matematik' }))
    }

    setTopic(topicSel)
    setSetQ(items)
    setIdx(0)
    setState('running')
    setLastResult(null)
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
          // Timeout räknas som fel och hoppar vidare
          handleChoose(-1, true)
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
          handleChoose(-1, true)
          return perQSec
        }
        return r-1
      })
    }, 1000)
  }

  function handleChoose(chosenIndex, timeout=false){
    const q = setQ[idx]
    const isCorrect = !timeout && chosenIndex === q.correct
    setLastResult(isCorrect)

    // uppdatera profil/poäng/stats
    if(profile && saveProfile){
      const p = { ...profile }
      const t = q.topic || topic
      p.stats = p.stats || {}
      p.stats[t] = p.stats[t] || {answered:0, correct:0}
      p.stats[t].answered++
      if(isCorrect){
        p.stats[t].correct++
        p.points = (p.points||0) + 2 // mindre än provläget
        if(p.points % 50 === 0) p.level = (p.level||1)+1
      }
      saveProfile(p)
    }

    // kort fördröjning för feedback, sen nästa
    setTimeout(()=>{
      const next = idx + 1
      if(next >= setQ.length){
        clearInterval(timerRef.current)
        setState('done')
      }else{
        setIdx(next)
      }
    }, 400)
  }

  function restart(){
    setState('idle')
    setSetQ([])
    setIdx(0)
    setLastResult(null)
    clearInterval(timerRef.current)
    setRemaining(perQSec)
  }

  const progressPct = setQ.length ? Math.round((idx/setQ.length)*100) : 0

  // UI
  if(!bank) return <div className="card">Laddar…</div>

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
          {state!=='running' && <button className="btn small" onClick={()=>start(topic)}>▶️ Starta</button>}
          <button className="btn small alt" onClick={()=>setView?.('home')}>🏠 Hem</button>
        </div>
      </div>

      <div className="card">
        {state==='idle' && <p className="tiny">Välj ämne och klicka <b>Starta</b>.</p>}

        {state==='running' && setQ.length>0 && (
          <>
            <div className="row" style={{justifyContent:'space-between'}}>
              <div className="chip">{(setQ[idx]?.topic||topic)==='matematik'?'🧮 Matematik':'📖 Svenska'}</div>
              <div className="chip">Fråga {idx+1} / {setQ.length}</div>
              <div className="pill">⏱️ {remaining}s</div>
            </div>
            <div className="progress"><div className="bar" style={{width:`${progressPct}%`}}/></div>

            <QuestionCard q={setQ[idx]} onChoose={handleChoose} />
            {lastResult===true && <div className="hint" style={{marginTop:8}}>✅ Rätt!</div>}
            {lastResult===false && <div className="hint" style={{marginTop:8}}>❌ Inte riktigt. Försök nästa!</div>}

            <div className="row" style={{marginTop:10}}>
              <button className="btn small ghost" onClick={()=>handleChoose(-1,false)}>⏭️ Hoppa över</button>
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