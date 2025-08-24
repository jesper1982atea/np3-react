import { useMemo, useState } from 'react'
import { getSessions, clearSessions } from '../lib/session.js'

function pct(a,c){ return a ? Math.round((c/a)*100) : 0 }
function letter(i){ return (typeof i==='number' && i>=0) ? String.fromCharCode(65+i) : '—' }
function typeIcon(t){ return t==='exam' ? '📝' : (t==='daily' ? '⭐' : '🧩') }

export default function Stats({ profile, setView }){
  const s = profile?.stats || {svenska:{answered:0,correct:0}, matematik:{answered:0,correct:0}}
  const sessions = useMemo(()=> getSessions(), [])
  const [expanded, setExpanded] = useState(null)

  return (
    <div className="card">
      <h1>📊 Statistik</h1>

      {/* Övergripande sammanställning */}
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

      {/* Historik över alla pass */}
      <div className="card" style={{marginTop:14}}>
        <h2>🗂️ Historik</h2>
        {(!sessions || !sessions.length) && (
          <p className="tiny">Inga sparade pass ännu. Kör ett prov, en övning eller dagens för att se resultat här.</p>
        )}
        <div className="list">
          {sessions.slice().reverse().map((sess)=>{
            const total = sess.items?.length || 0
            const correct = sess.items?.filter(x=>x.isCorrect).length || 0
            const acc = pct(total, correct)
            return (
              <div key={sess.id} className="item">
                <div className="row" style={{justifyContent:'space-between', alignItems:'center'}}>
                  <div className="row" style={{gap:10}}>
                    <span className="pill">{typeIcon(sess.type)} {sess.type==='exam'?'Prov':(sess.type==='daily'?'Dagens':'Övning')}</span>
                    <span className="chip">Ämne: {sess.meta?.subject || '—'}</span>
                    <span className="chip">{new Date(sess.startedAt).toLocaleString()}</span>
                  </div>
                  <div className="row" style={{gap:10}}>
                    <span className="pill">Poäng: {correct}/{total} ({acc}%)</span>
                    <button className="btn small ghost" onClick={()=> setExpanded(expanded===sess.id? null : sess.id)}>
                      {expanded===sess.id ? 'Dölj' : 'Visa'} detaljer
                    </button>
                  </div>
                </div>

                {expanded===sess.id && (
                  <div style={{marginTop:10}}>
                    <div className="list">
                      {sess.items.map((it,idx)=> (
                        <div key={it.id || idx} className="item">
                          {it.title && <div style={{fontWeight:700}}>{it.title}</div>}
                          {it.text && <div className="passage" style={{marginTop:6}}>{it.text}</div>}
                          <div style={{marginTop:6}}><b>{idx+1}. {it.q}</b></div>
                          <div className="tiny">Område: {it.area} • Typ: {it.type}</div>
                          <div className="row" style={{marginTop:6, flexWrap:'wrap', gap:8}}>
                            <span className="chip">Ditt svar: {letter(it.chosen)}</span>
                            <span className="chip">Rätt svar: {letter(it.correct)}</span>
                            {it.isCorrect ? <span className="chip" style={{color:'var(--ok)'}}>✔️ Rätt</span> : <span className="chip" style={{color:'var(--error)'}}>✘ Fel</span>}
                          </div>
                          {it.hint && (
                            <div className="hint" style={{marginTop:8}}>💡 Tips: {it.hint}</div>
                          )}
                          {(it.options && it.options.length) && (
                            <ul className="tiny" style={{marginTop:6}}>
                              {it.options.map((op,i)=> (
                                <li key={i} style={{fontWeight: i===it.correct ? 700 : 400}}>
                                  {letter(i)}. {op}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="row" style={{marginTop:10}}>
          <button className="btn small ghost" onClick={()=>setView?.('home')}>⬅️ Tillbaka</button>
          {sessions?.length>0 && (
            <button className="btn small" onClick={()=>{ clearSessions(); location.reload() }}>🗑️ Rensa historik</button>
          )}
        </div>
      </div>
    </div>
  )
}