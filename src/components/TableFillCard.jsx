import { useMemo, useState } from 'react'

export default function TableFillCard({ q, onAnswer, locked=false, showHint=false, hintText='' }) {
  const { table, answers = {} } = q || {}
  const [values, setValues] = useState({}) // key|header -> value
  const [submitted, setSubmitted] = useState(false)
  const [isCorrect, setIsCorrect] = useState(null)

  const headers = table?.headers || []
  const rows = table?.rows || []

  const emptyMap = useMemo(()=>{
    const out = {}
    rows.forEach(r=>{
      headers.forEach((h,idx)=>{
        const cell = r.cells?.[idx] ?? ''
        if(cell==='' || cell===null){
          out[`${r.key}|${h}`] = ''
        }
      })
    })
    return out
  }, [headers, rows])

  function handleChange(k, v){
    if(submitted || locked) return
    setValues(prev => ({ ...prev, [k]: v }))
  }

  function submit(){
    let ok = true
    for(const [k, right] of Object.entries(answers)){
      const user = (values[k] ?? '').toString().trim()
      if(user !== right.toString().trim()){ ok = false; break }
    }
    setIsCorrect(ok)
    setSubmitted(true)
    onAnswer?.(ok)
  }

  return (
    <div className="card">
      {q.title && <h2>{q.title}</h2>}
      {q.text  && <div className="passage">{q.text}</div>}
      <h1 style={{marginTop:10}}>{q.q}</h1>

      <div style={{overflowX:'auto', marginTop:10}}>
        <table style={{borderCollapse:'separate', borderSpacing: '0 6px', width:'100%'}}>
          <thead>
            <tr>
              <th style={{textAlign:'left', padding:'6px 8px'}}>—</th>
              {headers.map(h=>(
                <th key={h} style={{textAlign:'left', padding:'6px 8px'}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r,ri)=>(
              <tr key={r.key} className="item">
                <td style={{fontWeight:700, padding:'6px 8px'}}>{r.key}</td>
                {headers.map((h,ci)=>{
                  const cell = r.cells?.[ci] ?? ''
                  const k = `${r.key}|${h}`
                  const isEmpty = (cell==='' || cell===null)
                  return (
                    <td key={k} style={{padding:'6px 8px'}}>
                      {isEmpty ? (
                        <input
                          type="text"
                          inputMode="numeric"
                          disabled={submitted || locked}
                          value={values[k] ?? ''}
                          onChange={(e)=>handleChange(k, e.target.value)}
                          style={{width:'100%', padding:'10px', border:'2px solid #e5e7eb', borderRadius:10}}
                          placeholder="…" />
                      ) : (
                        <div style={{padding:'10px 6px'}}>{cell}</div>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showHint && (q.hint || hintText) && (
        <div className="hint" style={{marginTop:10}}>
          💡 {q.hint || hintText}
        </div>
      )}

      <div className="sticky-actions">
        <div className="row">
          <button className="btn small" disabled={submitted || locked} onClick={submit}>✅ Skicka</button>
          <button className="btn small ghost" disabled={submitted || locked} onClick={()=>setValues(emptyMap)}>↺ Rensa tomma</button>
        </div>
      </div>

      {submitted && (
        <div className="hint" style={{marginTop:10}}>
          {isCorrect ? '✅ Rätt!' : '❌ Inte riktigt.'}
          {q.explain && <div style={{marginTop:6}}><b>Förklaring:</b> {q.explain}</div>}
        </div>
      )}
    </div>
  )
}