export default function Stats({ profile, setView }){
  const s = profile?.stats || {svenska:{answered:0,correct:0}, matematik:{answered:0,correct:0}}
  const pct = (a,c)=> a? Math.round((c/a)*100):0
  return (
    <div className="card">
      <h1>📊 Statistik</h1>
      <div className="grid">
        <div className="card">
          <h2>📖 Svenska</h2>
          <p>Rätt: <b>{s.svenska?.correct||0}</b> / Svarade: <b>{s.svenska?.answered||0}</b> ({pct(s.svenska?.answered||0, s.svenska?.correct||0)}%)</p>
        </div>
        <div className="card">
          <h2>🧮 Matematik</h2>
          <p>Rätt: <b>{s.matematik?.correct||0}</b> / Svarade: <b>{s.matematik?.answered||0}</b> ({pct(s.matematik?.answered||0, s.matematik?.correct||0)}%)</p>
        </div>
      </div>
      <div className="row" style={{marginTop:10}}>
        <button className="btn small ghost" onClick={()=>setView?.('home')}>⬅️ Tillbaka</button>
      </div>
    </div>
  )
}