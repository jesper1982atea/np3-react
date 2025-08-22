// src/components/DragDropCard.jsx
import { useEffect, useMemo, useState } from 'react'

export default function DragDropCard({ q, onAnswer, locked=false }) {
  const initial = useMemo(()=> {
    const pos = {}
    for (const t of (q.tiles||[])) pos[t.id] = null
    return pos
  }, [q])

  const [placed, setPlaced] = useState(initial)
  const [submitted, setSubmitted] = useState(false)
  const [isCorrect, setIsCorrect] = useState(null)

  useEffect(()=>{ setPlaced(initial); setSubmitted(false); setIsCorrect(null) }, [initial])

  const allPlaced = Object.values(placed).every(v => !!v)

  function onDragStart(e, tileId){
    if(locked || submitted) return
    e.dataTransfer.setData('text/plain', tileId)
  }
  function onDrop(e, bucketId){
    if(locked || submitted) return
    e.preventDefault()
    const tileId = e.dataTransfer.getData('text/plain')
    if(tileId) setPlaced(p => ({ ...p, [tileId]: bucketId }))
  }
  function onDragOver(e){ e.preventDefault() }
  function resetOne(tileId){ setPlaced(p => ({ ...p, [tileId]: null })) }

  function submit(){
    if(!allPlaced) return
    const byId = {}; for (const t of q.tiles||[]) byId[t.id] = t
    let ok = true
    for (const [tileId, bucketId] of Object.entries(placed)){
      if(byId[tileId]?.bucket !== bucketId){ ok = false; break }
    }
    setSubmitted(true); setIsCorrect(ok); onAnswer?.(ok)
  }

  return (
    <div className="card">
      <h1>{q.q}</h1>
      <div className="dnd-pool">
        {(q.tiles||[]).filter(t=>!placed[t.id]).map(t=>(
          <div key={t.id} className="dnd-tile" draggable={!locked&&!submitted}
               onDragStart={(e)=>onDragStart(e,t.id)}>{t.text}</div>
        ))}
      </div>
      <div className="dnd-buckets">
        {(q.buckets||[]).map(b=>(
          <div key={b.id} className="dnd-bucket" onDrop={(e)=>onDrop(e,b.id)} onDragOver={onDragOver}>
            <div className="dnd-bucket-title">{b.label}</div>
            <div className="dnd-bucket-body">
              {(q.tiles||[]).filter(t=>placed[t.id]===b.id).map(t=>(
                <div key={t.id} className="dnd-tile in-bucket">
                  {t.text}
                  {!submitted && <button className="dnd-x" onClick={()=>resetOne(t.id)}>×</button>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="row" style={{marginTop:10}}>
        <button className="btn small" disabled={!allPlaced||submitted} onClick={submit}>✅ Skicka</button>
        <button className="btn small ghost" disabled={submitted} onClick={()=>setPlaced(initial)}>↺ Rensa</button>
      </div>
      {submitted && (
        <div className="hint" style={{marginTop:10}}>
          {isCorrect ? '✅ Rätt!' : '❌ Fel.'}
          {q.explain && <div style={{marginTop:6}}><b>Förklaring:</b> {q.explain}</div>}
        </div>
      )}
    </div>
  )
}