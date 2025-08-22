export default function PassageCard({ title, text, children }){
  if(!title && !text) return null
  return (
    <div className="card">
      {title && <h2>{title}</h2>}
      {text && <div className="passage">{text}</div>}
      {children}
    </div>
  )
}