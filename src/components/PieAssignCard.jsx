import { useState } from 'react'

export default function PieAssignCard({ q, onAnswer, locked=false, showHint=false, hintText='' }) {
  const { segments = [], labels = [], solution = {} } = q || {}
  const [assign, setAssign] = useState(()=> {
    const obj = {}; segments.forEach(s=> obj[s.id] = '')
    return obj
  })
  const [submitted, setSubmitted] = useState(false)
  const [isCorrect, setIsCorrect] = useState(null)

  function change(segId, value){
    if(submitted || locked) return
    setAssign(a => ({ ...a, [segId]: value }))
  }

  function submit(){
    let ok = true
    for(const seg of segments){
      if((assign[seg.id]||'') !== (solution[seg.id]||'')){ ok = false; break }
    }
    setIsCorrect(ok)
    setSubmitted(true)
    onAnswer?.(ok)
  }

  return (
    <div className="card">
      {q.title && <h2>{q.title}</h2>}
      {q.text  && <div className="passage">{q.text}</div>}
      <h1 style={{marginTop:10}}>{q.q}</h1>

      {/* Enkel “legend” med andelar (NP-likt: 50%, 25%, 25% etc.) */}
      <div className="list" style={{marginTop:10}}>
        {segments.map(s=>(
          <div className="item" key={s.id} style={{display:'flex', alignItems:'center', gap:10}}>
            <div className="chip" style={{minWidth:72, justifyContent:'center'}}>{s.percent}%</div>
            <select
              disabled={submitted || locked}
              value={assign[s.id] || ''}
              onChange={(e)=>change(s.id, e.target.value)}
              style={{flex:1, padding:'10px', borderRadius:10, border:'2px solid #e5e7eb'}}
            >
              <option value="">— Välj aktivitet —</option>
              {labels.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
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
          <button className="btn small" disabled={submitted || locked} onClick={submit}>✅ Skicka</button>
          <button className="btn small ghost" disabled={submitted || locked} onClick={()=>{ const o={}; segments.forEach(s=>o[s.id]=''); setAssign(o) }}>↺ Rensa</button>
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