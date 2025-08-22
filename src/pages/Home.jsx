export default function Home({ profile, setView }){
  return (
    <div className="card">
      <h1>Välkommen!</h1>
      <p>Välj att <b>öva</b> eller göra ett <b>prov</b>. Tjäna stjärnor och följ framstegen.</p>
      <div className="row" style={{marginTop:8}}>
        <button className="btn" onClick={()=>setView?.('practice')}>🧩 Öva</button>
        <button className="btn alt" onClick={()=>setView?.('exam')}>📝 Provläge</button>
      </div>
    </div>
  )
}