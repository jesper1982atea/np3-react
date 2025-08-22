// Enkel övningsvy (stub) – vi kopplar in riktig frågelogik när bank och state är på plats.
export default function Practice({ setView }){
  return (
    <div className="card">
      <h1>Övningsläge</h1>
      <p>Här kommer övningsfrågor för Svenska och Matematik.</p>
      <div className="row" style={{marginTop:8}}>
        <button className="btn" onClick={()=>alert('Här startas Svenska-övning i nästa steg')}>📖 Svenska</button>
        <button className="btn alt" onClick={()=>alert('Här startas Matte-övning i nästa steg')}>🧮 Matematik</button>
        <button className="btn ghost" onClick={()=>setView?.('home')}>🏠 Hem</button>
      </div>
    </div>
  )
}