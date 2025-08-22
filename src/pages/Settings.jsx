export default function Settings({ profile, saveProfile, setView }){
  const s = profile?.settings || { perQuiz:10, perExam:20, perQuestionTimerSec:45, examTimerTotalMin:25 }

  const onSave = (e) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const updated = {
      perQuiz: Number(f.get('perQuiz')),
      perExam: Number(f.get('perExam')),
      perQuestionTimerSec: Number(f.get('perQ')),
      examTimerTotalMin: Number(f.get('examMin'))
    }
    if(profile && saveProfile){
      saveProfile({ ...profile, settings: { ...s, ...updated } })
      alert('Sparat!')
    }
  }

  return (
    <form className="card" onSubmit={onSave}>
      <h1>⚙️ Inställningar</h1>
      <div className="list">
        <label className="item">Frågor per övning: <input name="perQuiz" type="number" min="5" max="30" defaultValue={s.perQuiz} /></label>
        <label className="item">Frågor per prov: <input name="perExam" type="number" min="10" max="40" defaultValue={s.perExam} /></label>
        <label className="item">Sekunder per fråga (övning): <input name="perQ" type="number" min="15" max="120" defaultValue={s.perQuestionTimerSec} /></label>
        <label className="item">Provtid totalt (min): <input name="examMin" type="number" min="10" max="60" defaultValue={s.examTimerTotalMin} /></label>
      </div>
      <div className="row" style={{marginTop:10}}>
        <button className="btn" type="submit">💾 Spara</button>
        <button className="btn alt" type="button" onClick={()=>setView?.('home')}>🏠 Hem</button>
      </div>
    </form>
  )
}