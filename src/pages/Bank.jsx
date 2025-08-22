/**
 * Exporterar aktuell bank (läst från public/banks) och kan importera en egen JSON.
 * Importerad bank sparas i sessionStorage ('customBank') tills sidan laddas om.
 * För permanent byte – ersätt filerna i /public/banks/.
 */
export default function Bank(){
  const exportBank = async () => {
    try{
      const [sv, ma] = await Promise.all([
        fetch('/banks/svenska.json').then(r=>r.json()),
        fetch('/banks/matematik.json').then(r=>r.json())
      ])
      const merged = { bankVersion: sv.bankVersion || '1.0', svenska: sv.svenska, matematik: ma.matematik }
      const blob = new Blob([JSON.stringify(merged,null,2)], {type:'application/json'})
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = 'fragabank_ak3.json'; a.click(); URL.revokeObjectURL(url)
    }catch(e){
      alert('Kunde inte exportera: '+e.message)
    }
  }

  const importBank = async (e) => {
    const f = e.target.files?.[0]; if(!f) return
    try{
      const txt = await f.text()
      const obj = JSON.parse(txt)
      if(!obj.svenska || !obj.matematik) throw new Error('Ogiltig struktur (saknar svenska/matematik)')
      sessionStorage.setItem('customBank', JSON.stringify(obj))
      alert('Importerad! (Tillfälligt). För permanent: lägg in din json i /public/banks/ och uppdatera useBank().')
    }catch(err){
      alert('Kunde inte importera: '+err.message)
    }
  }

  return (
    <div className="card">
      <h1>📚 Frågebank</h1>
      <p className="muted">Exportera standardbanken eller importera en egen.</p>
      <div className="row">
        <button className="btn small" onClick={exportBank}>⬇️ Exportera JSON</button>
        <label className="btn small alt" style={{cursor:'pointer'}}>
          ⬆️ Importera JSON
          <input type="file" accept=".json" style={{display:'none'}} onChange={importBank} />
        </label>
      </div>
      <div className="item" style={{marginTop:10}}>
        <pre className="tiny" style={{whiteSpace:'pre-wrap'}}>{`Schema (kort):
{
  "bankVersion": "1.0",
  "svenska": {
    "items": [{ "id":"sv-001", "area":"stavning", "q":"...", "options":["..."], "correct":0 }],
    "passages": [{ "id":"sv-p-001", "title":"...", "text":"...", "questions":[{ "id":"sv-p-001-q1", "q":"...", "options":["..."], "correct":0 }] }]
  },
  "matematik": {
    "items": [{ "id":"ma-001", "area":"addition", "q":"...", "options":["..."], "correct":1 }]
  }
}`}</pre>
      </div>
    </div>
  )
}