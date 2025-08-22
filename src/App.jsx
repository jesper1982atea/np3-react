import { useState } from 'react'
import './styles.css'
import useBank from './hooks/useBank'
import { loadProfile, saveProfile as persist } from './lib/storage'

// pages
import Home from './pages/Home'
import Practice from './pages/Practice'
import Exam from './pages/Exam'
import Stats from './pages/Stats'
import Settings from './pages/Settings'
import Bank from './pages/Bank'

export default function App(){
  const { bank, loading, error } = useBank()
  const [view, setView] = useState('home')
  const [profile, setProfile] = useState(loadProfile())

  const saveProfile = (p) => { setProfile(p); persist(p) }

  if(loading) return <div className="container"><div className="card">⏳ Laddar frågebank…</div></div>
  if(error) return <div className="container"><div className="card">⚠️ Kunde inte ladda frågebank.</div></div>

  return (
    <div className="container">
      <header>
        <div className="logo">📚 NP åk 3 – Träning & Prov</div>
        <div className="points">
          <span>Lv {profile.level}</span>
          <span>⭐ {profile.points}</span>
        </div>
      </header>

      <div className="tabs">
        <button className="btn small ghost" onClick={()=>setView('home')}>🏠 Startsida</button>
        <button className="btn small ghost" onClick={()=>setView('practice')}>🧩 Öva</button>
        <button className="btn small ghost" onClick={()=>setView('exam')}>📝 Provläge</button>
        <button className="btn small ghost" onClick={()=>setView('stats')}>📊 Statistik</button>
        <button className="btn small ghost" onClick={()=>setView('settings')}>⚙️ Inställningar</button>
        <button className="btn small ghost" onClick={()=>setView('bank')}>📚 Frågebank</button>
      </div>

      {view==='home' && <Home profile={profile} setView={setView} />}
      {view==='practice' && <Practice profile={profile} saveProfile={saveProfile} bank={bank} setView={setView} />}
      {view==='exam' && <Exam profile={profile} saveProfile={saveProfile} bank={bank} setView={setView} />}
      {view==='stats' && <Stats profile={profile} setView={setView} />}
      {view==='settings' && <Settings profile={profile} saveProfile={saveProfile} setView={setView} />}
      {view==='bank' && <Bank />}

      <div className="footer">Prototyp. Data sparas lokalt i din webbläsare.</div>
    </div>
  )
}