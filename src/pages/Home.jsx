// src/pages/Home.jsx
export default function Home({ profile, setView }){
  // läs streak för vy
  let streak = 0, last = ''
  try{
    streak = parseInt(localStorage.getItem('daily_streak') || '0',10) || 0
    last = localStorage.getItem('daily_last') || ''
  }catch(_){}

  return (
    <div className="grid">
      <div className="card">
        <h1>Kom igång</h1>
        <p className="muted">Välj att <b>öva</b> eller göra ett <b>prov</b>. Prova även <b>Dagens utmaning</b> för snabb träning och streak!</p>
        <div
          style={{
            display:'grid',
            gap:10,
            gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))',
            alignItems:'stretch'
          }}
        >
          <button className="btn" onClick={()=>setView('daily')}>⭐ Dagens utmaning</button>
          <button className="btn alt" onClick={()=>setView('practice')}>🧩 Öva</button>
          <button className="btn ghost" onClick={()=>setView('exam')}>📝 Provläge</button>
        </div>
        <div className="row" style={{marginTop:10, flexWrap:'wrap'}}>
          <span className="chip">Streak: {streak} 🔥</span>
          <span className="chip">Senast: {last || '—'}</span>
        </div>
      </div>

      <div className="card">
        <h1>Framsteg</h1>
        <p>⭐ Poäng: <b>{profile.points}</b></p>
        <div
          style={{
            display:'grid',
            gap:10,
            gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))',
            alignItems:'stretch'
          }}
        >
          <button className="btn small ghost" onClick={()=>setView('stats')}>📊 Statistik</button>
          <button className="btn small ghost" onClick={()=>setView('settings')}>⚙️ Inställningar</button>
        </div>
      </div>
    </div>
  )
}