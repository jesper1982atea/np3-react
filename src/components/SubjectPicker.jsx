// src/components/SubjectPicker.jsx
export default function SubjectPicker({ list, selected, onSelect }){
  if(!list?.length) return <p className="tiny">Inga banker tillgängliga</p>
  return (
    <div className="list" style={{marginTop:8}}>
      {list.map(b => (
        <button
          key={b.id}
          className={`item btn small ${selected===b.id ? '' : 'ghost'}`}
          onClick={()=>onSelect?.(b.id)}
          style={{textAlign:'left'}}
        >
          {b.label}
        </button>
      ))}
    </div>
  )
}