// src/components/DragDropCard.jsx
import { useEffect, useMemo, useState } from 'react'

export default function DragDropCard({ q, onAnswer, locked=false, showHint=false, hintText='' }) {
  // q: { title?, text?, q, buckets:[{id,label}], tiles:[{id,text,bucket}], explain? }

  // Enkel touch-detektering
  const isTouch = typeof window !== 'undefined' && (
    'ontouchstart' in window || navigator.maxTouchPoints > 0 || navigator.msMaxTouchPoints > 0
  )

  const initial = useMemo(()=> {
    const pos = {}
    for (const t of (q.tiles||[])) pos[t.id] = null // ej placerad
    return pos
  }, [q])

  const [placed, setPlaced] = useState(initial)
  const [submitted, setSubmitted] = useState(false)
  const [isCorrect, setIsCorrect] = useState(null)
  const [selected, setSelected] = useState(null) // vald bricka vid “tap to place”

  useEffect(()=>{ // om fråga byts
    setPlaced(initial); setSubmitted(false); setIsCorrect(null); setSelected(null)
  }, [initial])

  const allPlaced = Object.values(placed).every(v => !!v)

  // Drag-n-drop (desktop) + Tap-to-place (mobil)
  function onDragStart(e, tileId){
    if(locked || submitted) return
    if(isTouch){
      // Inget native drag på mobil – vi kör tap-to-place
      e.preventDefault()
      return
    }
    e.dataTransfer?.setData?.('text/plain', tileId)
  }
  function onDrop(e, bucketId){
    if(locked || submitted) return
    e.preventDefault?.()
    const tileId = isTouch ? selected : e.dataTransfer?.getData?.('text/plain')
    if(!tileId) return
    setPlaced(p => ({ ...p, [tileId]: bucketId }))
    setSelected(null)
  }
  function onDragOver(e){ e.preventDefault?.() }

  // Tap-to-place
  function tapTile(tileId){
    if(locked || submitted) return
    setSelected(prev => prev === tileId ? null : tileId)
  }
  function tapBucket(bucketId){
    if(locked || submitted) return
    if(!selected) return
    setPlaced(p => ({ ...p, [selected]: bucketId }))
    setSelected(null)
  }

  function resetOne(tileId){
    if(submitted) return
    setPlaced(p => ({ ...p, [tileId]: null }))
  }

  function submit(){
    if(!allPlaced) return
    const byId = {}; for (const t of q.tiles||[]) byId[t.id] = t
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

      {/* Instruktion – särskilt för mobil */}
      <p className="tiny" style={{marginTop:6}}>
        {isTouch
          ? (selected
              ? 'Tryck på en låda för att släppa den valda brickan.'
              : 'Tryck på en bricka och sedan på rätt låda.')
          : 'Dra en bricka till rätt låda. På mobil: tryck på bricka → tryck på låda.'}
      </p>

      {/* Oplacerade brickor */}
      <div className="dnd-pool">
        {tiles.filter(t=>!placed[t.id]).map(t => (
          <div
            key={t.id}
            className="dnd-tile"
            draggable={!isTouch && !locked && !submitted}
            onDragStart={(e)=>onDragStart(e,t.id)}
            onClick={()=>tapTile(t.id)}                      /* tryck för att välja */
            style={selected===t.id ? {outline:'3px solid #2563eb'} : null}
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
            onClick={()=>tapBucket(b.id)}                   /* tryck för att släppa vald */
            style={selected ? {outline:'2px dashed #93c5fd'} : null}
          >
            <div className="dnd-bucket-title">{b.label}</div>
            <div className="dnd-bucket-body">
              {tiles.filter(t=>placed[t.id]===b.id).map(t => (
                <div key={t.id} className="dnd-tile in-bucket"
                     draggable={!isTouch && !locked && !submitted}
                     onDragStart={(e)=>onDragStart(e,t.id)}
                     onClick={()=>tapTile(t.id)}            /* tryck för att välja igen */
                     style={selected===t.id ? {outline:'3px solid #2563eb'} : null}
                >
                  {t.text}
                  {!submitted && <button className="dnd-x" onClick={(e)=>{e.stopPropagation(); resetOne(t.id)}} title="Ta bort">×</button>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Hjälp/ledtråd (visas även för DnD) */}
      {showHint && (q.hint || hintText) && (
        <div className="hint" style={{marginTop:10}}>
          💡 {q.hint || hintText}
        </div>
      )}

      <div className="sticky-actions">
        <div className="row">
          <button className="btn small" disabled={!allPlaced || submitted} onClick={submit}>✅ Skicka</button>
          <button className="btn small ghost" disabled={submitted} onClick={()=>{setPlaced(initial); setSelected(null)}}>↺ Rensa</button>
        </div>
      </div>

      {submitted && (
        <div className="hint" style={{marginTop:10}}>
          {isCorrect ? '✅ Rätt!' : '❌ Inte riktigt.'}
          {(q.explain || hintText) && <div style={{marginTop:6}}><b>Förklaring:</b> {q.explain || hintText}</div>}
        </div>
      )}
    </div>
  )
}