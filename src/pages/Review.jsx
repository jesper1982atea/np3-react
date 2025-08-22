// src/pages/Review.jsx
import { useEffect, useState } from 'react'

function fallbackExplain(q){
  if(q?.explain) return q.explain
  const text = (q?.q || '').toLowerCase()
  const area = q?.area || (q?.topic === 'svenska' ? (q?.title ? 'läsförståelse' : 'grammatik') : 'matematik')

  if(area === 'grammatik'){
    if(text.includes('substantiv')) return "Substantiv är namn på saker, djur, personer eller platser (t.ex. 'katt', 'bord', 'Lisa')."
    if(text.includes('verb')) return "Verb beskriver handlingar eller tillstånd (t.ex. 'springer', 'läser', 'är')."
    if(text.includes('adjektiv')) return "Adjektiv beskriver egenskaper (t.ex. 'stor', 'röd', 'snabb')."
    if(text.includes('pronomen')) return "Pronomen ersätter substantiv (t.ex. 'han', 'hon', 'den', 'det')."
    if(text.includes('preposition')) return "Prepositioner beskriver läge/riktning (t.ex. 'på', 'under', 'i', 'bakom')."
    if(text.includes('preteritum') || text.includes("tempus")) return "Preteritum är dåtid (igår). Ex: läser → läste, skriver → skrev."
    return "Grammatik: Substantiv (namn), verb (handling), adjektiv (beskriver)."
  }
  if(area === 'stavning'){
    return "Stavning: jämför bokstäver och ljud – sj-, tj-, hj-, lj-, skj- kan vara kluriga."
  }
  if(area === 'ordforstaelse'){
    return "Ordförståelse: Synonym = liknande ord. Motsats = tvärtom."
  }
  if(area === 'läsförståelse'){
    return "Läsförståelse: Leta svar i texten. Ofta står svaret tydligt uttryckt."
  }
  if(q?.topic === 'matematik'){
    return "Titta på räknesättet och kontrollera stegen. Använd tiotal/ental vid huvudräkning."
  }
  return "Titta på ledtrådarna i frågan och jämför alternativen noggrant."
}

export default function Review({ saved, setView }){
  const [data, setData] = useState(saved || null)

  useEffect(()=>{
    if(!saved){
      try{
        const raw = localStorage.getItem('exam_last')
        if(raw) setData(JSON.parse(raw))
      }catch(e){ /* ignore */ }
    }
  },[saved])

  if(!data) return (
    <div className="card">
      <h1>📄 Granska provet</h1>
      <p>Inget provresultat hittades.</p>
      <button className="btn alt" onClick={()=>setView?.('exam')}>📝 Starta nytt prov</button>
    </div>
  )

  const total = data.items?.length || 0
  const correct = data.items?.filter(x=>x.isCorrect)?.length || 0
  const pct = total ? Math.round(100*correct/total) : 0

  return (
    <div className="list">
      <div className="card">
        <h1>📄 Granska provet</h1>
        <div className="row" style={{marginTop:6}}>
          <span className="chip">Frågor: {total}</span>
          <span className="chip">Rätt: {correct}</span>
          <span className="chip">Resultat: {pct}%</span>
        </div>
        <div className="row" style={{marginTop:10}}>
          <button className="btn alt" onClick={()=>setView?.('exam')}>📝 Kör nytt prov</button>
          <button className="btn ghost" onClick={()=>setView?.('home')}>🏠 Hem</button>
        </div>
      </div>

      {(data.items||[]).map((q, i)=> {
        const your = typeof q.chosen === 'number' ? q.options[q.chosen] : '—'
        const corr = q.options[q.correct]
        const ok = q.isCorrect === true
        const exp = q.explain || fallbackExplain(q)
        return (
          <div key={q.id || i} className="card">
            <div className="row" style={{justifyContent:'space-between'}}>
              <div className="chip">{q.topic==='matematik'?'🧮 Matematik':'📖 Svenska'}</div>
              <div className="chip" style={{background: ok?'#ecfdf5':'#fef2f2', border:'1px solid #e5e7eb'}}>
                {ok ? '✅ Rätt' : '❌ Fel'}
              </div>
            </div>
            {q.title && <h3 style={{marginTop:8}}>{q.title}</h3>}
            {q.text && <div className="passage" style={{marginTop:6}}>{q.text}</div>}
            <h2 style={{marginTop:10}}>{i+1}. {q.q}</h2>
            <ul className="list" style={{marginTop:8}}>
              {q.options.map((opt, idx)=> {
                const isRight = idx === q.correct
                const isYour = idx === q.chosen
                return (
                  <li key={idx} className="item" style={{
                    borderColor: isRight ? '#16a34a' : (isYour && !isRight ? '#dc2626' : '#e5e7eb'),
                    background: isRight ? '#ecfdf5' : (isYour && !isRight ? '#fef2f2' : '#fff')
                  }}>
                    {String.fromCharCode(65+idx)}. {String(opt)}
                    {isRight && <span className="tiny" style={{marginLeft:8}}>(rätt)</span>}
                    {isYour && !isRight && <span className="tiny" style={{marginLeft:8}}>(ditt svar)</span>}
                  </li>
                )
              })}
            </ul>
            <div className="hint" style={{marginTop:10}}>
              <b>Förklaring:</b> {exp}
            </div>
          </div>
        )
      })}
    </div>
  )
}