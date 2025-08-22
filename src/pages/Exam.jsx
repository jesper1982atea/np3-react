import { useEffect, useRef, useState } from 'react'
import QuestionCard from '../components/QuestionCard'
import { drawWithoutReplacement, shuffle } from '../lib/draw'

/**
 * Enkel provvy (stub + fungerande kärna).
 * När den får `bank` + `profile` + `saveProfile` som props kör den ett blandprov.
 */
export default function Exam({ profile, saveProfile, bank, setView }){
  const [setQ, setSetQ] = useState([])
  const [idx, setIdx] = useState(0)
  const [remaining, setRemaining] = useState((profile?.settings?.examTimerTotalMin||25)*60)
  const timerRef = useRef(null)

  useEffect(()=>{
    if(!bank) return
    const n = profile?.settings?.perExam || 20
    const half = Math.floor(n/2)

    const svItems = drawWithoutReplacement(bank.svenska?.items||[], Math.max(half-3,7), 'exam_sv')
      .map(x=>({...x, topic:'svenska'}))

    const passage = (bank.svenska?.passages?.length)
      ? bank.svenska.passages[Math.floor(Math.random()*bank.svenska.passages.length)]
      : null
    const svPassQs = passage
      ? passage.questions.map(q=>({
          ...q, topic:'svenska', title: passage.title, text: passage.text
        }))
      : []

    const svSet = [...svItems, ...shuffle(svPassQs).slice(0,3)]
    const maSet = drawWithoutReplacement(bank.matematik?.items||[], n - svSet.length, 'exam_ma')
      .map(x=>({...x, topic:'matematik'}))

    const all = shuffle([...svSet, ...maSet])
    setSetQ(all); setIdx(0)
    // total timer
    clearInterval(timerRef.current)
    setRemaining((profile?.settings?.examTimerTotalMin||25)*60)
    timerRef.current = setInterval(()=>{
      setRemaining(r=>{
        if(r<=1){
          clearInterval(timerRef.current)
          finish()
        }
        return r-1
      })
    },1000)
  },[bank])

  const choose = (i) => {
    const q = setQ[idx]
    const correct = i===q.correct
    if(profile && saveProfile){
      const p = {...profile}
      if(correct){ p.points = (p.points||0) + 6; if(p.points % 50 === 0) p.level = (p.level||1)+1 }
      const topic = q.topic || 'svenska'
      p.stats = p.stats || {}
      p.stats[topic] = p.stats[topic] || {answered:0,correct:0}
      p.stats[topic].answered++
      if(correct) p.stats[topic].correct++
      saveProfile(p)
    }
    const next = idx+1
    if(next >= setQ.length){ finish() } else { setIdx(next) }
  }

  const finish = () => {
    clearInterval(timerRef.current)
    setView?.('stats')
  }

  if(!bank) return <div className="card">Laddar prov…</div>
  if(setQ.length===0) return <div className="card">Förbereder frågor…</div>

  const q = setQ[idx]
  return (
    <div>
      <div className="row" style={{justifyContent:'space-between'}}>
        <div className="chip">{q.topic==='matematik'?'🧮':'📖'} {q.topic}</div>
        <div className="chip">Fråga {idx+1} / {setQ.length}</div>
        <div className="chip">⏱️ {Math.floor(remaining/60)}:{String(remaining%60).padStart(2,'0')}</div>
      </div>
      <div className="progress"><div className="bar" style={{width:`${Math.round(idx/setQ.length*100)}%`}}/></div>

      <QuestionCard q={q} onChoose={choose} />
      <div className="row" style={{marginTop:10}}>
        <button className="btn small" onClick={()=>setView?.('home')}>🏠 Avbryt</button>
      </div>
    </div>
  )
}