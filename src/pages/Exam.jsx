// src/pages/Exam.jsx
import { useEffect, useMemo, useRef, useState } from 'react'
import QuestionCard from '../components/QuestionCard'
import DragDropCard from '../components/DragDropCard'
import TableFillCard from '../components/TableFillCard'
import PieAssignCard from '../components/PieAssignCard'
import ChanceMatrixCard from '../components/ChanceMatrixCard'
import { drawSmart, shuffle } from '../lib/draw'
import { filterByDifficulty } from '../lib/difficulty'

function buildExplain(q){
  // Visa ev. explain/hint om banken har det (end-review)
  return q?.explain || q?.hint || ''
}

export default function Exam({ profile, saveProfile, bank, setView }){
  const [topic, setTopic] = useState('svenska') // 'svenska' | 'matematik'
  const [setQ, setSetQ] = useState([])
  const [idx, setIdx] = useState(0)
  const [state, setState] = useState('idle') // 'idle' | 'running' | 'done'
  const [remaining, setRemaining] = useState(
    (profile?.settings?.examTimerTotalMin || 25) * 60
  )
  const [answers, setAnswers] = useState([]) // [{id, correct:boolean}]
  const timerRef = useRef(null)

  const perExam = profile?.settings?.perExam || 20
  const noRepeats = profile?.settings?.noRepeats !== false
  const totalSec = (profile?.settings?.examTimerTotalMin || 25) * 60

  // Lås prov till NP-nivå
  const TARGET_DIFF = 'np'

  const timeFmt = useMemo(()=>{
    return (s)=>{
      const mm = Math.floor(s/60)
      const ss = s%60
      return `${mm}:${String(ss).padStart(2,'0')}`
    }
  },[])

  function start(topicSel = topic){
    if(!bank) return
    const storageKey = topicSel === 'svenska' ? 'exam_sv' : 'exam_ma'
    let items = []

    if(topicSel === 'svenska'){
      // Fristående (filtrera på NP) + ev. passagefrågor (behåll som NP implicit)
      const all = bank.svenska?.items || []
      const pool = filterByDifficulty(all, TARGET_DIFF)
      const base = drawSmart(pool, Math.max(8, Math.min(perExam-4, perExam)), storageKey, noRepeats)

      let extra = []
      if ((bank.svenska?.passages?.length||0) > 0){
        const pass = bank.svenska.passages[Math.floor(Math.random()*bank.svenska.passages.length)]
        // ta 2-4 frågor från vald passage
        const take = Math.min(4, Math.max(2, perExam - base.length))
        extra = shuffle(pass.questions || []).slice(0, take).map(q=>({
          ...q, title: pass.title, text: pass.text, topic:'svenska'
        }))
      }

      items = shuffle([...base.map(x=>({ ...x, topic:'svenska' })), ...extra]).slice(0, perExam)
    }else{
      // Matematik: blanda MC + NP-special (table/pie/chance/dnd) om de finns
      const all = bank.matematik?.items || []
      const pool = filterByDifficulty(all, TARGET_DIFF)

      // Försök få in några “NP-typer” om de finns
      const special = shuffle(pool.filter(q => ['table-fill','pie-assign','chance-matrix','dnd'].includes(q.type)))
                        .slice(0, Math.min(4, Math.floor(perExam/4)))
      const mcPool = pool.filter(q => !q.type) // vanliga MC utan type
      const restCount = Math.max(0, perExam - special.length)
      const base = drawSmart(mcPool.length ? mcPool : pool, restCount, storageKey, noRepeats)

      items = shuffle([...special, ...base]).slice(0, perExam).map(x => ({ ...x, topic:'matematik' }))
    }

    setTopic(topicSel)
    setSetQ(items)
    setIdx(0)
    setState('running')
    setAnswers([])
    setRemaining(totalSec)

    clearInterval(timerRef.current)
    timerRef.current = setInterval(()=>{
      setRemaining(r=>{
        if(r<=1){
          clearInterval(timerRef.current)
          finishExam() // tid slut -> avsluta
          return 0
        }
        return r-1
      })
    }, 1000)
  }

  useEffect(()=>()=> clearInterval(timerRef.current), [])

  function recordAnswer(isCorrect){
    const q = setQ[idx]
    setAnswers(prev => [...prev, { id: q.id, correct: !!isCorrect }])

    // Gå vidare eller avsluta
    const next = idx + 1
    if(next >= setQ.length){
      finishExam()
    }else{
      setIdx(next)
    }
  }

  function finishExam(){
    clearInterval(timerRef.current)
    setState('done')

    // uppdatera profilpoäng baserat på antal rätt (lite högre än övning)
    const correct = answers.filter(a=>a.correct).length
    const futureCorrect = (answers.length < setQ.length)
      ? correct + 0 // sista frågan loggas via recordAnswer precis innan finish
      : correct

    if(profile && saveProfile){
      const p = { ...profile }
      // poäng: 3p per rätt i prov
      p.points = (p.points||0) + futureCorrect * 3
      if(p.points % 50 === 0) p.level = (p.level||1)+1
      saveProfile(p)
    }
  }

  // MC-val (QuestionCard)
  function handleChoose(idxChoice){
    // idxChoice kan vara -1 i övning för “hoppa över”, men här kör vi NP-stil: inget skipp
    if(idxChoice < 0) return
    const q = setQ[idx]
    const ok = idxChoice === q.correct
    recordAnswer(ok)
  }

  // Binärt från icke-MC (drag/table/pie/chance)
  function handleBinary(ok){
    recordAnswer(!!ok)
  }

  // Resultat
  const result = useMemo(()=>{
    const map = {}; answers.forEach(a => { map[a.id] = a.correct })
    const all = setQ.map(q => ({
      id: q.id,
      q: q.q,
      area: q.area || '',
      type: q.type || 'mc',
      correct: !!map[q.id],
      explain: buildExplain(q)
    }))
    const right = all.filter(x=>x.correct).length
    return { all, right, total: all.length }
  }, [answers, setQ])

  const progressPct = setQ.length ? Math.round((idx/setQ.length)*100) : 0

  if(!bank) return <div className="card">Laddar…</div>

  const current = setQ[idx]

  return (
    <div className="grid">
      <div className="card">
        <h1>📝 Provläge (NP)</h1>
        <div className="row" style={{marginTop:6}}>
          <span className="chip">Frågor: {perExam}</span>
          <span className="chip">⏱️ Tid kvar: {timeFmt(remaining)}</span>
          <span className="chip">Ämne: {topic==='matematik'?'🧮 Matematik':'📖 Svenska'}</span>
          <span className="chip">Nivå: NP</span>
        </div>
        <div className="row" style={{marginTop:10}}>
          {state==='idle' && (
            <>
              <button className="btn small ghost" onClick={()=>start('svenska')}>📖 Svenska</button>
              <button className="btn small ghost" onClick={()=>start('matematik')}>🧮 Matematik</button>
              <button className="btn small alt" onClick={()=>setView?.('home')}>🏠 Hem</button>
            </>
          )}
          {state!=='idle' && (
            <button className="btn small alt" onClick={()=>setView?.('home')}>🏠 Hem</button>
          )}
        </div>
      </div>

      <div className="card">
        {state==='idle' && (
          <p className="tiny">
            Välj ämne och starta. Provet använder <b>NP-nivå</b> på frågorna och har en <b>total tid</b>.
            Inga ledtrådar eller hoppa över – svara och gå vidare.
          </p>
        )}

        {state==='running' && current && (
          <>
            <div className="row" style={{justifyContent:'space-between'}}>
              <div className="chip">{topic==='matematik'?'🧮 Matematik':'📖 Svenska'}</div>
              <div className="chip">Fråga {idx+1} / {setQ.length}</div>
              <div className="pill">⏱️ {timeFmt(remaining)}</div>
            </div>
            <div className="progress"><div className="bar" style={{width:`${progressPct}%`}}/></div>

            {/* Rendera rätt korttyp — NP-stil: ingen hjälp/skip-knapp */}
            {(() => {
              const common = { locked:false, showHint:false, hintText:'' }
              switch(current.type){
                case 'dnd':
                  return <DragDropCard q={current} onAnswer={handleBinary} {...common} />
                case 'table-fill':
                  return <TableFillCard q={current} onAnswer={handleBinary} {...common} />
                case 'pie-assign':
                  return <PieAssignCard q={current} onAnswer={handleBinary} {...common} />
                case 'chance-matrix':
                  return <ChanceMatrixCard q={current} onAnswer={handleBinary} {...common} />
                default:
                  return <QuestionCard q={current} onChoose={handleChoose} locked={false} />
              }
            })()}
          </>
        )}

        {state==='done' && (
          <>
            <h2>📊 Resultat</h2>
            <p>
              Rätt: <b>{result.right}</b> av <b>{result.total}</b>
              {result.total>0 ? ` (${Math.round(100*result.right/result.total)}%)` : ''}
            </p>

            <div className="list" style={{marginTop:10}}>
              {result.all.map((r,i)=>(
                <div key={r.id} className="item">
                  <div className="row" style={{justifyContent:'space-between', alignItems:'center'}}>
                    <div className="chip">{r.type}</div>
                    <div className="chip">{r.area || '—'}</div>
                    <div className="pill">{r.correct ? '✅ Rätt' : '❌ Fel'}</div>
                  </div>
                  <div style={{marginTop:8}}><b>Q{String(i+1).padStart(2,'0')}.</b> {r.q}</div>
                  {r.explain && (
                    <div className="hint" style={{marginTop:8}}>
                      <b>Förklaring:</b> <span style={{whiteSpace:'pre-wrap'}}>{r.explain}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="row" style={{marginTop:12}}>
              <button className="btn" onClick={()=>{ setState('idle'); setSetQ([]); setIdx(0); setAnswers([]); setRemaining(totalSec); }}>
                🔁 Gör prov igen
              </button>
              <button className="btn alt" onClick={()=>setView?.('stats')}>📈 Se statistik</button>
              <button className="btn ghost" onClick={()=>setView?.('home')}>🏠 Hem</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}