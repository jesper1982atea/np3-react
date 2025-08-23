import { useState } from 'react'

export default function ChanceMatrixCard({ q, onAnswer, locked=false, showHint=false, hintText='' }) {
  const { context = {}, statements = [] } = q || {}
  const [ans, setAns] = useState(()=> statements.map(()=> null)) // true/false
  const [submitted, setSubmitted] = useState(false)
  const [isCorrect, setIsCorrect] = useState(null)

  const allAnswered = ans.every(v => v !== null)

  function setVal(i, v){
    if(submitted || locked) return
    setAns(prev => prev.map((x,idx)=> idx===i ? v : x))
  }

  function submit(){
    let ok = true
    statements.forEach((st, i)=> {
      if(!!st.answer !== !!ans[i]) ok = false
    })
    setIsCorrect(ok)
    setSubmitted(true)
    onAnswer?.(ok)
  }

  return (
    <div className="card">
      {q.title && <h2>{q.title}</h2>}
      <h1 style={{marginTop:10}}>{q.q}</h1>

      {/* Visa kontext (ex antal klubbor) om finns */}
      {!!Object.keys(context).length && (
        <div className="hint" style={{marginTop:8}}>
          {Object.entries(context).map(([k,v])=>`${k}: ${v}`).join(' · ')}
        </div>
      )}

      <div className="list" style={{marginTop:10}}>
        {statements.map((st, i)=>(
          <div className="item" key={i} style={{display:'grid', gridTemplateColumns:'1fr auto auto', alignItems:'center', gap:10}}>
            <div>{st.text}</div>
            <label className="row" style={{gap:6}}>
              <input type="radio" name={`s${i}`} disabled={submitted||locked} checked={ans[i]===true}  onChange={()=>setVal(i,true)} />
              Sant
            </label>
            <label className="row" style={{gap:6}}>
              <input type="radio" name={`s${i}`} disabled={submitted||locked} checked={ans[i]===false} onChange={()=>setVal(i,false)} />
              Falskt
            </label>
          </div>
        ))}
      </div>

      {showHint && (q.hint || hintText) && (
        <div className="hint" style={{marginTop:10}}>
          💡 {q.hint || hintText}
        </div>
      )}

      <div className="sticky-actions">
        <div className="row">
          <button className="btn small" disabled={!allAnswered || submitted || locked} onClick={submit}>✅ Skicka</button>
          <button className="btn small ghost" disabled={submitted || locked} onClick={()=>setAns(statements.map(()=>null))}>↺ Rensa</button>
        </div>
      </div>

      {submitted && (
        <div className="hint" style={{marginTop:10}}>
          {isCorrect ? '✅ Rätt!' : '❌ Inte riktigt.'}
          {q.explain && <div style={{marginTop:6}}><b>Förklaring:</b> {q.explain}</div>}
        </div>
      )}
    </div>
  )
}