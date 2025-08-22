export default function QuestionCard({ q, onChoose, locked=false }){
  if(!q) return null
  return (
    <div className="card">
      {q.title && <h2>{q.title}</h2>}
      {q.text && <div className="passage">{q.text}</div>}
      <h1 style={{marginTop:10}}>{q.q}</h1>

      <div className="choices">
          {(q.options || []).map((opt,i)=> (
        <button key={i} className="choice" onClick={()=>onChoose(i)} disabled={locked}>
          {String.fromCharCode(65+i)}. {String(opt)}   {/* <-- String() om något råkar vara nummer */}
        </button>
      ))}
      </div>

      {q.hint && <div className="hint">💡 Tips: {q.hint}</div>}
    </div>
  )
}