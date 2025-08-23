// src/pages/Exam.jsx
import { useEffect, useRef, useState } from 'react'
import QuestionCard from '../components/QuestionCard'
import DragDropCard from '../components/DragDropCard'
import { drawSmart, shuffle } from '../lib/draw'

// Enkel fallback-förklaring om frågan inte har 'explain'
function fallbackExplain(q){
  if(q?.explain) return q.explain
  const text = (q?.q || '').toLowerCase()
  const area = q?.area || (q?.topic === 'svenska' ? (q?.title ? 'läsförståelse' : 'grammatik') : 'matematik')
  if(area === 'grammatik'){
    if(text.includes('substantiv')) return "Substantiv är namn på saker, djur, personer eller platser (t.ex. 'katt', 'bord', 'Lisa')."
    if(text.includes('verb')) return "Verb beskriver handlingar eller tillstånd (t.ex. 'springer', 'läser', 'är')."
    if(text.includes('adjektiv')) return "Adjektiv beskriver egenskaper (t.ex. 'stor', 'röd', 'snabb')."
    if(text.includes('pronomen')) return "Pronomen ersätter substantiv (t.ex. 'han', 'hon', 'den', 'det')."
    if(text.includes('preposition')) return "Prepositioner beskriver läge/riktning (t.ex. 'på', 'under', 'i', 'bakom')."
    if(text.includes('preteritum') || text.includes("tempus")) return "Preteritum är dåtid (igår)."
    return "Grammatik: Substantiv (namn), verb (handling), adjektiv (beskriver)."
  }
  if(area === 'stavning') return "Stavning: jämför bokstäver och ljud – sj-, tj-, hj-, lj-, skj- kan vara kluriga."
  if(area === 'ordforstaelse') return "Ordförståelse: Synonym = liknande ord. Motsats = tvärtom."
  if(area === 'läsförståelse') return "Läsförståelse: Leta svar i texten. Ofta står svaret tydligt uttryckt."
  if(q?.topic === 'matematik') return "Kontrollera räknesättet och lös steg för steg. Använd tiotal/ental."
  return "Titta på ledtrådarna i frågan och jämför alternativen."
}

export default function Exam({ profile, saveProfile, bank, setView }){
  const [setQ, setSetQ] = useState([])
  const [idx, setIdx] = useState(0)
  const [state, setState] = useState('idle') // 'idle' | 'running' | 'done'
  const [remaining, setRemaining] = useState((profile?.settings?.examTimerTotalMin || 25) * 60)
  const [answers, setAnswers] = useState({}) // id -> chosen index (för DnD: 0=ok, -1=fel)
  const timerRef = useRef(null)

  const totalQ = profile?.settings?.perExam || 20
  const noRepeats = profile?.settings?.noRepeats !== false

  // Initiera provet när banken finns
  useEffect(()=>{
    if(!bank) return
    const half = Math.floor(totalQ/2)

    // Svenska: blandning av fristående + ev. passagefrågor
    const svItems = drawSmart(bank.svenska?.items||[], Math.max(half-3,7), 'exam_sv', noRepeats)
      .map(x=>({...x, topic:'svenska'}))

    const passage = (bank.svenska?.passages?.length)
      ? bank.svenska.passages[Math.floor(Math.random()*bank.svenska.passages.length)]
      : null

    const svPassQs = passage
      ? (passage.questions||[]).map(q=>({
          ...q, topic:'svenska', title: passage.title, text: passage.text
        }))
      : []

    const svSet = [...svItems, ...shuffle(svPassQs).slice(0,3)]

    // Matematik fyller upp återstoden
    const maSet = drawSmart(bank.matematik?.items||[], totalQ - svSet.length, 'exam_ma', noRepeats)
      .map(x=>({...x, topic:'matematik'}))

    const all = shuffle([...svSet, ...maSet])

    setSetQ(all)
    setIdx(0)
    setState('running')
    setAnswers({})

    // total provtimer
    clearInterval(timerRef.current)
    const totalSec = (profile?.settings?.examTimerTotalMin || 25) * 60
    setRemaining(totalSec)
    timerRef.current = setInterval(()=> {
      setRemaining(r=>{
        if(r<=1){
          clearInterval(timerRef.current)
          finishExam()
          return 0
        }
        return r-1
      })
    }, 1000)

    return ()=> clearInterval(timerRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bank])

  // Registrera val (flervals eller DnD)
  function choose(i){
    const q = setQ[idx]
    const id = q.id || `q-${idx}`
    setAnswers(a => ({ ...a, [id]: i }))
    const next = idx + 1
    if(next >= setQ.length){
      finishExam()
    } else {
      setIdx(next)
    }
  }

  // Avsluta provet: räkna resultat, spara, ge poäng, gå till review
  function finishExam(){
    clearInterval(timerRef.current)
    const items = setQ.map((q, i) => {
      const id = q.id || `q-${i}`
      const chosen = typeof answers[id] === 'number' ? answers[id] : -1
      const isDnd = q.type === 'dnd'
      const isCorrect = isDnd ? (chosen === 0) : (chosen === q.correct)
      return {
        id: q.id || id,
        topic: q.topic,
        area: q.area,
        title: q.title,
        text: q.text,
        q: q.q,
        options: q.options,
        correct: q.correct,
        chosen,
        isCorrect,
        explain: q.explain || fallbackExplain(q)
      }
    })
    const score = items.filter(x=>x.isCorrect).length
    const payload = {
      when: new Date().toISOString(),
      total: items.length,
      score,
      items
    }
    try{
      localStorage.setItem('exam_last', JSON.stringify(payload))
    }catch(e){ /* ignore */ }

    // Profilpoäng
    if(profile && saveProfile){
      const p = { ...profile }
      p.points = (p.points||0) + score*3 // prov ger mer än övning
      if(p.points % 50 === 0) p.level = (p.level||1)+1
      saveProfile(p)
    }

    setState('done')
    setView?.('review')
  }

  if(!bank) return <div className="card">Laddar…</div>

  const remainMin = Math.floor(remaining/60)
  const remainSec = (remaining%60).toString().padStart(2,'0')

  const current = setQ[idx]

  return (
    <div className="grid">
      <div className="card">
        <h1>📝 Provläge</h1>
        <div className="row" style={{marginTop:6}}>
          <span className="chip">Frågor: {totalQ}</span>
          <span className="chip">Fråga {Math.min(idx+1, setQ.length)} / {setQ.length || totalQ}</span>
          <span className="pill">⏱️ {remainMin}:{remainSec}</span>
        </div>
        <div className="row" style={{marginTop:10}}>
          <button className="btn small alt" onClick={()=>setView?.('home')}>🏠 Avsluta</button>
        </div>
      </div>

      <div className="card">
        {state==='running' && current && (
          <>
            {current.type === 'dnd' ? (
              <DragDropCard
                q={current}
                onAnswer={(ok)=>choose(ok ? 0 : -1)} // DnD: översätt ok->0 (rätt) / -1 (fel)
              />
            ) : (
              <>
                <QuestionCard q={current} onChoose={choose} />
                <div className="row" style={{marginTop:10}}>
                  <button className="btn small ghost" onClick={()=>choose(-1)}>⏭️ Hoppa över</button>
                </div>
              </>
            )}
          </>
        )}

        {state==='done' && (
          <>
            <h2>✅ Provet inlämnat</h2>
            <p>Du skickas till <b>Granska provet</b>…</p>
          </>
        )}
      </div>
    </div>
  )
}