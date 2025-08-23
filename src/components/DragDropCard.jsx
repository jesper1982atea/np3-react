// src/components/DragDropCard.jsx
import { useEffect, useMemo, useState } from 'react'

export default function DragDropCard({ q, onAnswer, locked=false }) {
  // q: { title?, text?, q, buckets:[{id,label}], tiles:[{id,text,bucket}], explain? }

  const initial = useMemo(()=> {
    const pos = {}
    for (const t of (q.tiles||[])) pos[t.id] = null // ej placerad
    return pos
  }, [q])

  const [placed, setPlaced] = useState(initial)
  const [submitted, setSubmitted] = useState(false)
  const [isCorrect, setIsCorrect] = useState(null)

  useEffect(()=>{ // om fråga byts
    setPlaced(initial); setSubmitted(false); setIsCorrect(null)
  }, [initial])

  const allPlaced = Object.values(placed).every(v => !!v)

  function onDragStart(e, tileId){
    if(locked || submitted) return
    e.dataTransfer.setData('text/plain', tileId)
  }

  function onDrop(e, bucketId){
    if(locked || submitted) return
    e.preventDefault()
    const tileId = e.dataTransfer.getData('text/plain')
    if(!tileId) return
    setPlaced(p => ({ ...p, [tileId]: bucketId }))
  }

  function onDragOver(e){ e.preventDefault() }

  function resetOne(tileId){
    if(submitted) return
    setPlaced(p => ({ ...p, [tileId]: null }))
  }

  function submit(){
    if(!allPlaced) return
    const byId = {}
    for (const t of q.tiles||[]) byId[t.id] = t
    let ok = true
    for (const [tileId, bucketId] of Object.entries(placed)){
      if(byId[tileId]?.bucket !== bucketId){ ok = false; break }
    }
    setSubmitted(true)
    setIsCorrect(ok)
    onAnswer?.(ok) // bubbla upp: ok=true/false
  }

  const tiles = q.tiles || []
  const buckets = q.buckets || []

  return (
    <div className="card">
      {q.title && <h2>{q.title}</h2>}
      {q.text && <div className="passage">{q.text}</div>}
      <h1 style={{marginTop:10}}>{q.q}</h1>

      {/* Oplacerade brickor */}
      <div className="dnd-pool">
        {tiles.filter(t=>!placed[t.id]).map(t => (
          <div
            key={t.id}
            className="dnd-tile"
            draggable={!locked && !submitted}
            onDragStart={(e)=>onDragStart(e,t.id)}
            aria-grabbed="true"
          >
            {t.text}
          </div>
        ))}
      </div>

      {/* Lådor */}
      <div className="dnd-buckets">
        {buckets.map(b => (
          <div
            key={b.id}
            className="dnd-bucket"
            onDrop={(e)=>onDrop(e,b.id)}
            onDragOver={onDragOver}
          >
            <div className="dnd-bucket-title">{b.label}</div>
            <div className="dnd-bucket-body">
              {tiles.filter(t=>placed[t.id]===b.id).map(t => (
                <div key={t.id} className="dnd-tile in-bucket" draggable={!locked && !submitted}
                     onDragStart={(e)=>onDragStart(e,t.id)}>
                  {t.text}
                  {!submitted && <button className="dnd-x" onClick={()=>resetOne(t.id)} title="Ta bort">×</button>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Åtgärder + feedback */}
      <div className="row" style={{marginTop:10}}>
        <button className="btn small" disabled={!allPlaced || submitted} onClick={submit}>✅ Skicka</button>
        <button className="btn small ghost" disabled={submitted} onClick={()=>setPlaced(initial)}>↺ Rensa</button>
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